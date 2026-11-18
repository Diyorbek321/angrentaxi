import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalAcceptance } from '../../database/entities/legal-acceptance.entity';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { codedBadRequest, codedConflict, ERROR_CODES } from '../../common/errors/coded-error';
import {
  LEGAL_DOCUMENTS,
  LEGAL_VERSIONS,
  LegalDocument,
  LegalStatus,
  isLegalDocument,
  legalDocumentStatus,
  requiredLegalDocuments,
} from './legal-versions';

export type LegalAcceptanceSource = 'login' | 'sheet';

export interface LegalAcceptanceItem {
  document: LegalDocument;
  version: string;
}

export interface LegalAcceptanceMeta {
  ip: string | null;
  userAgent: string | null;
  source: LegalAcceptanceSource;
}

export interface LegalDocumentSummary {
  document: LegalDocument;
  version: string;
  summary: { uz: string; ru: string };
  /** Joriy versiyani qabul qilgan foydalanuvchilar. */
  acceptedCurrent: number;
  /** Shu hujjat talab qilinadigan faol foydalanuvchilar (rol bo'yicha). */
  requiredUsers: number;
  /** Har versiya bo'yicha qabul qilganlar (yangisi birinchi). */
  versions: Array<{ version: string; users: number; lastAcceptedAt: string | null }>;
}

const DRIVER_TERMS_GATE_ENV = 'LEGAL_DRIVER_TERMS_GATE';

/**
 * Oferta roziligi: holat, qabul qilish, haydovchi darvozasi va admin xulosasi.
 * Matnlar va versiyalar — `legal-versions.ts`.
 */
@Injectable()
export class LegalAcceptanceService {
  constructor(
    @InjectRepository(LegalAcceptance)
    private readonly repo: Repository<LegalAcceptance>,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async getStatus(user: Pick<User, 'id' | 'role'>): Promise<LegalStatus> {
    const rows = await this.repo.find({ where: { userId: user.id }, order: { acceptedAt: 'DESC' } });
    // Joriy versiya qabul qilingan bo'lsa — u; aks holda eng oxirgisi.
    const accepted = new Map<string, string>();
    for (const row of rows) {
      const current = isLegalDocument(row.document) ? LEGAL_VERSIONS[row.document].version : null;
      if (row.version === current) accepted.set(row.document, row.version);
      else if (!accepted.has(row.document)) accepted.set(row.document, row.version);
    }
    return legalDocumentStatus(user.role, accepted);
  }

  /**
   * Faqat JORIY versiyani qabul qiladi: ilova eski matnni ko'rsatib, unga
   * rozilik yozib qo'ymasin (409 — ilova holatni qayta yuklaydi).
   * Takror qabul — jim (unikal indeks, `ON CONFLICT DO NOTHING`).
   */
  async accept(
    user: Pick<User, 'id' | 'role'>,
    items: LegalAcceptanceItem[],
    meta: LegalAcceptanceMeta,
  ): Promise<LegalStatus> {
    const required = requiredLegalDocuments(user.role);
    for (const item of items) {
      if (!required.includes(item.document)) {
        throw new BadRequestException(`Bu hujjat sizning hisobingizga tegishli emas: ${item.document}`);
      }
      const current = LEGAL_VERSIONS[item.document].version;
      if (item.version !== current) {
        throw codedConflict(
          ERROR_CODES.legalVersionOutdated,
          "Hujjatning yangi tahriri chiqdi — sahifani yangilab, qaytadan o'qing.",
          { details: { document: item.document, version: current } },
        );
      }
    }
    for (const item of items) {
      await this.repo.query(
        `INSERT INTO "legal_acceptances" ("user_id", "document", "version", "ip", "user_agent", "source")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("user_id", "document", "version") DO NOTHING`,
        [user.id, item.document, item.version, meta.ip?.slice(0, 64) ?? null, meta.userAgent?.slice(0, 256) ?? null, meta.source],
      );
    }
    return this.getStatus(user);
  }

  /**
   * Onlayn chiqish darvozasi: haydovchi ofertasining JORIY tahriri qabul
   * qilinmagan bo'lsa — 400 `LEGAL_TERMS_NOT_ACCEPTED`.
   *
   * STANDART O'CHIQ: faqat `LEGAL_DRIVER_TERMS_GATE=on` yoqadi. Sabab —
   * v21 va undan eski APK'da rozilik oynasi yo'q: yoqiq deploy qilinsa,
   * yangi APK o'rnatilmaguncha HECH BIR haydovchi onlayn chiqa olmasdi.
   * Yangi APK tarqalgach serverdagi `.env.prod` da yoqiladi.
   */
  async assertDriverTermsAccepted(userId: string): Promise<void> {
    if (this.config?.get<string>(DRIVER_TERMS_GATE_ENV) !== 'on') return;
    const version = LEGAL_VERSIONS['driver-terms'].version;
    const accepted = await this.repo.count({ where: { userId, document: 'driver-terms', version } });
    if (accepted > 0) return;
    throw codedBadRequest(
      ERROR_CODES.legalTermsNotAccepted,
      "Onlayn chiqish uchun haydovchi ofertasining yangi tahririni qabul qiling. " +
        "Ilovani yangilang va «Shartlar» oynasida «Qabul qilaman» tugmasini bosing.",
      { details: { document: 'driver-terms', version } },
    );
  }

  /** Admin: har hujjat bo'yicha versiyalar va qabul qilganlar soni. */
  async summary(): Promise<{ documents: LegalDocumentSummary[] }> {
    const counts = (await this.repo.query(
      `SELECT document, version, COUNT(DISTINCT user_id) AS users, MAX(accepted_at) AS last_accepted_at
         FROM legal_acceptances GROUP BY document, version ORDER BY document, MAX(accepted_at) DESC`,
    )) as Array<{ document: string; version: string; users: string; last_accepted_at: string | Date | null }>;
    const roles = (await this.repo.query(
      `SELECT role, COUNT(*) AS users FROM users WHERE status <> $1 GROUP BY role`,
      [UserStatus.BLOCKED],
    )) as Array<{ role: UserRole; users: string }>;

    const usersByRole = new Map(roles.map((r) => [r.role, Number(r.users)]));
    const documents = LEGAL_DOCUMENTS.map((document): LegalDocumentSummary => {
      const info = LEGAL_VERSIONS[document];
      const versions = counts
        .filter((c) => c.document === document)
        .map((c) => ({
          version: c.version,
          users: Number(c.users),
          lastAcceptedAt: c.last_accepted_at ? new Date(c.last_accepted_at).toISOString() : null,
        }));
      const requiredUsers = Object.values(UserRole)
        .filter((role) => requiredLegalDocuments(role).includes(document))
        .reduce((sum, role) => sum + (usersByRole.get(role) ?? 0), 0);
      return {
        document,
        version: info.version,
        summary: info.summary,
        acceptedCurrent: versions.find((v) => v.version === info.version)?.users ?? 0,
        requiredUsers,
        versions,
      };
    });
    return { documents };
  }
}
