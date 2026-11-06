import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Driver, DriverTaxStatus } from '../../database/entities/driver.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { SettingsService } from '../settings/settings.service';
import { DriverVerificationService } from './driver-verification.service';
import { resolveDriverServiceTypes } from './driver-capabilities';
import { ERROR_CODES, codedBadRequest, codedConflict, codedForbidden } from '../../common/errors/coded-error';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { AppLanguage, localizeMessage } from '../../common/i18n/error-messages';
import {
  DriverLegalEligibility,
  DriverLegalRules,
  LEGAL_REQUIREMENT_CODES,
  LegalDocumentState,
  LegalIneligibilityReason,
  evaluateDriverLegalEligibility,
  isLegalComplianceEnforced,
} from './driver-legal-eligibility';

/** `GET /drivers/me/legal` dagi profil qismi. */
export interface DriverLegalProfile {
  taxStatus: DriverTaxStatus | null;
  pinfl: string | null;
  tin: string | null;
  birthDate: string | null;
  drivingLicenceIssuedAt: string | null;
  taxiLicenceNumber: string | null;
  taxiLicenceRegion: string | null;
  citizenship: string;
}

export type DriverLegalProfileChanges = Partial<DriverLegalProfile>;

/** Xulosa: `blocking` — aynan hozir taksiga chiqishni to'sadimi. */
export interface DriverLegalStatus {
  eligible: boolean;
  enforced: boolean;
  enforcedFrom: string | null;
  appliesToTaxi: boolean;
  blocking: boolean;
  reasons: LegalIneligibilityReason[];
}

export interface DriverLegalSummary {
  profile: DriverLegalProfile;
  eligibility: DriverLegalStatus;
}

/** Haydovchilar ro'yxatidagi qisqa xulosa (`GET /drivers` → `legal`). */
export interface DriverLegalBrief {
  eligible: boolean;
  blocking: boolean;
  issueCount: number;
}

interface ResolvedLegalSettings {
  enforcedFrom: Date | null;
  rules: DriverLegalRules;
}

type LegalDriver = Pick<
  Driver,
  | 'id'
  | 'vehicleType'
  | 'serviceTypes'
  | 'carYear'
  | 'taxStatus'
  | 'pinfl'
  | 'tin'
  | 'birthDate'
  | 'drivingLicenceIssuedAt'
  | 'taxiLicenceNumber'
  | 'taxiLicenceRegion'
  | 'citizenship'
>;

/** Har o'zgarishi `audit_logs` ga yoziladi (security review #4). */
const AUDITED_FIELDS = ['pinfl', 'tin', 'taxStatus'] as const;

/**
 * Huquqiy hujjat tasdiqlangandan keyin haydovchi O'ZI o'zgartira olmaydigan
 * maydonlar (#4) — DRIVERS_APPROVE menejer/admin o'zgartiradi.
 */
const LOCKED_AFTER_APPROVAL: ReadonlyArray<keyof DriverLegalProfile> = ['pinfl', 'tin', 'taxStatus', 'birthDate'];

/** Hujjat bir marta tasdiqlangan (muddati yaqin/o'tgan bo'lsa ham). */
const APPROVED_DOCUMENT_STATUSES: ReadonlySet<string> = new Set(['ok', 'due_soon', 'overdue']);

const PG_UNIQUE_VIOLATION = '23505';

/** JShShIR/STIR niqobi: oxirgi 4 raqam ko'rinadi (`**********1234`). */
export function maskLegalId(value: string | null | undefined): string | null {
  if (!value) return null;
  const visible = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - visible.length))}${visible}`;
}

/** DRIVERS_APPROVE'siz ko'ruvchi uchun profil (#2). */
export function maskLegalProfile(profile: DriverLegalProfile): DriverLegalProfile {
  return { ...profile, pinfl: maskLegalId(profile.pinfl), tin: maskLegalId(profile.tin) };
}

/** Kim tahrirlayapti: haydovchi o'zi yoki DRIVERS_APPROVE menejer/admin. */
interface LegalEditor {
  actorUserId: string | null;
  self: boolean;
}

const PROFILE_FIELDS: ReadonlyArray<keyof DriverLegalProfile> = [
  'taxStatus',
  'pinfl',
  'tin',
  'birthDate',
  'drivingLicenceIssuedAt',
  'taxiLicenceNumber',
  'taxiLicenceRegion',
  'citizenship',
];

/**
 * VMQ 200 / PQ-247 huquqiy profili va TAKSI darvozasi.
 *
 * ⚠️ MAJBURLASH SOZLAMADAN: `legalComplianceEnforcedFrom = null` (standart)
 * yoki kelajak sana — hech kim bloklanmaydi, sabablar haydovchi ilovasida
 * ogohlantirish bo'lib ko'rinadi. Bazadagi mavjud haydovchilarda bu
 * ma'lumot yo'q — majburlash birdaniga yoqilsa butun park oflayn bo'lardi.
 *
 * Faqat TAKSI: yuk/yetkazish boshqa litsenziya rejimida, kuryerni bu
 * qoidalar bilan to'sish noto'g'ri bo'lardi.
 */
@Injectable()
export class DriverLegalService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly settingsService: SettingsService,
    private readonly verificationService: DriverVerificationService,
    // Ixtiyoriy — qo'lda yig'iladigan spec'lar uchun; Nest DI doim beradi.
    @Optional() private readonly auditLog?: AuditLogService,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  async getForUser(userId: string, now: Date = new Date()): Promise<DriverLegalSummary> {
    return this.summarize(await this.findOrThrow({ userId }), now);
  }

  async getForDriverId(driverId: string, now: Date = new Date()): Promise<DriverLegalSummary> {
    return this.summarize(await this.findOrThrow({ id: driverId }), now);
  }

  /** Haydovchining o'zi — tasdiqlangan hujjatdan keyin qulf (#4). */
  async updateForUser(
    userId: string,
    changes: DriverLegalProfileChanges,
    now: Date = new Date(),
  ): Promise<DriverLegalSummary> {
    return this.update(await this.findOrThrow({ userId }), changes, now, { actorUserId: userId, self: true });
  }

  /** DRIVERS_APPROVE menejer/admin (`PATCH /drivers/:id/legal`) — qulf yo'q, jurnal bor. */
  async updateForDriverId(
    driverId: string,
    changes: DriverLegalProfileChanges,
    actorUserId: string | null = null,
    now: Date = new Date(),
  ): Promise<DriverLegalSummary> {
    return this.update(await this.findOrThrow({ id: driverId }), changes, now, { actorUserId, self: false });
  }

  async evaluate(driver: LegalDriver, now: Date = new Date()): Promise<DriverLegalStatus> {
    const settings = await this.resolveSettings();
    const documents = await this.legalDocuments(driver, now);
    return this.toStatus(driver, documents, settings, now);
  }

  /**
   * Ko'p haydovchi uchun qisqa xulosa — sozlama BIR marta, hujjat holatlari
   * BITTA guruhlangan o'qishda (`getLegalDocumentStatesForDrivers`). Panel
   * ro'yxati uchun: har haydovchiga alohida `evaluate` N+1 bo'lardi.
   */
  async summarizeMany(
    drivers: readonly LegalDriver[],
    now: Date = new Date(),
  ): Promise<Map<string, DriverLegalBrief>> {
    const result = new Map<string, DriverLegalBrief>();
    if (drivers.length === 0) return result;
    const settings = await this.resolveSettings();
    const documentsByDriver = await this.verificationService.getLegalDocumentStatesForDrivers(
      drivers,
      LEGAL_REQUIREMENT_CODES,
      now,
    );
    for (const driver of drivers) {
      const status = this.toStatus(driver, documentsByDriver.get(driver.id) ?? [], settings, now);
      result.set(driver.id, {
        eligible: status.eligible,
        blocking: status.blocking,
        issueCount: status.reasons.length,
      });
    }
    return result;
  }

  /** Haydovchi ilovasi tilida (`Accept-Language`). Kodlar o'zgarmaydi. */
  localizeSummary(summary: DriverLegalSummary, language: AppLanguage): DriverLegalSummary {
    if (language === 'uz') return summary;
    return {
      ...summary,
      eligibility: {
        ...summary.eligibility,
        reasons: summary.eligibility.reasons.map((reason) => ({
          code: reason.code,
          message: localizeMessage(reason.message, language),
        })),
      },
    };
  }

  /** `setOnlineStatus` darvozasi — faqat taksi yoqilgan haydovchi uchun. */
  async assertCanGoOnline(driver: LegalDriver, now: Date = new Date()): Promise<void> {
    const status = await this.evaluate(driver, now);
    if (status.blocking) {
      throw codedBadRequest(
        ERROR_CODES.legalNotEligible,
        `Taksi uchun onlayn chiqa olmaysiz: ${this.joinReasons(status.reasons)}. Ilovadagi «Hujjatlar» bo'limida to'ldiring.`,
        { reasons: status.reasons },
      );
    }
  }

  /** Taksi xizmatini YOQISH darvozasi (`DriverServicesService`). */
  async assertCanEnableTaxi(driver: LegalDriver, now: Date = new Date()): Promise<void> {
    const status = await this.evaluate({ ...driver, serviceTypes: [ServiceType.TAXI] }, now);
    if (status.blocking) {
      throw codedBadRequest(
        ERROR_CODES.legalNotEligible,
        `«Taksi» xizmatini yoqib bo'lmadi: ${this.joinReasons(status.reasons)}. Ilovadagi «Hujjatlar» bo'limida to'ldiring.`,
        { reasons: status.reasons },
      );
    }
  }

  /**
   * Shaharlararo qatnov e'lon qilish va xizmatni yoqish darvozasi — bu ham
   * yo'lovchi tashish, shuning uchun taksi bilan BIR XIL talablar (VMQ 200).
   */
  async assertCanCarryIntercity(driver: LegalDriver, now: Date = new Date()): Promise<void> {
    const status = await this.evaluate({ ...driver, serviceTypes: [ServiceType.TAXI] }, now);
    if (status.blocking) {
      throw codedBadRequest(
        ERROR_CODES.legalNotEligible,
        `«Shaharlararo» qatnov uchun hujjatlar yetarli emas: ${this.joinReasons(status.reasons)}. Ilovadagi «Hujjatlar» bo'limida to'ldiring.`,
        { reasons: status.reasons },
      );
    }
  }

  // ------------------------------------------------------------- ichki

  private async findOrThrow(where: { id: string } | { userId: string }): Promise<Driver> {
    const driver = await this.driverRepository.findOne({ where });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return driver;
  }

  private async update(
    driver: Driver,
    changes: DriverLegalProfileChanges,
    now: Date,
    editor: LegalEditor,
  ): Promise<DriverLegalSummary> {
    const defined: DriverLegalProfileChanges = Object.fromEntries(
      PROFILE_FIELDS.filter((field) => changes[field] !== undefined).map((field) => [field, changes[field]]),
    );
    // Faqat haqiqatan o'zgargan maydonlar: o'sha qiymatni qayta yuborish
    // (formadagi butun profil) qulfga ham, jurnalga ham tushmaydi.
    const current = this.toProfile(driver);
    const changed = (Object.keys(defined) as Array<keyof DriverLegalProfile>).filter(
      (field) => (defined[field] ?? null) !== (current[field] ?? null),
    );
    if (changed.length === 0) return this.summarize(driver, now);

    if (editor.self && changed.some((field) => LOCKED_AFTER_APPROVAL.includes(field))) {
      await this.assertSelfEditAllowed(driver, now);
    }

    const patch = Object.fromEntries(changed.map((field) => [field, defined[field]])) as Partial<Driver>;
    const audited = changed.filter((field): field is (typeof AUDITED_FIELDS)[number] =>
      (AUDITED_FIELDS as readonly string[]).includes(field),
    );
    try {
      await this.inTransaction(async (manager) => {
        const repo = manager ? manager.getRepository(Driver) : this.driverRepository;
        // ⚠️ `update(id, patch)` — `save({...driver})` EMAS (#5): eski nusxa
        // `balance` (daftar keshi) va `is_online` ni ustidan yozib yuborardi.
        await repo.update(driver.id, patch);
        if (audited.length > 0) await this.recordAudit(driver, current, defined, audited, editor, manager);
      });
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
    return this.summarize({ ...driver, ...patch }, now);
  }

  /** Taksi huquqiy hujjatlaridan biri tasdiqlangan — haydovchi o'zi o'zgartira olmaydi. */
  private async assertSelfEditAllowed(driver: LegalDriver, now: Date): Promise<void> {
    const documents = await this.legalDocuments(driver, now);
    if (documents.some((doc) => APPROVED_DOCUMENT_STATUSES.has(String(doc.status)))) {
      throw codedForbidden(
        ERROR_CODES.legalProfileLocked,
        "Hujjatingiz tasdiqlangan: JShShIR, STIR, soliq maqomi va tug'ilgan sanani endi faqat dispetcher o'zgartira oladi. Qo'llab-quvvatlash xizmatiga murojaat qiling.",
      );
    }
  }

  private async recordAudit(
    driver: Driver,
    current: DriverLegalProfile,
    next: DriverLegalProfileChanges,
    fields: ReadonlyArray<(typeof AUDITED_FIELDS)[number]>,
    editor: LegalEditor,
    manager: EntityManager | undefined,
  ): Promise<void> {
    if (!this.auditLog) return;
    const show = (field: (typeof AUDITED_FIELDS)[number], value: string | null | undefined): string | null =>
      field === 'taxStatus' ? (value ?? null) : maskLegalId(value);
    const changes = Object.fromEntries(
      fields.map((field) => [field, { from: show(field, current[field]), to: show(field, next[field] ?? null) }]),
    );
    await this.auditLog.record(
      {
        actorUserId: editor.actorUserId,
        action: AUDIT_ACTIONS.driverLegalUpdate,
        targetType: 'driver',
        targetId: driver.id,
        metadata: { self: editor.self, changes },
      },
      manager,
    );
  }

  private inTransaction(work: (manager: EntityManager | undefined) => Promise<void>): Promise<void> {
    return this.dataSource ? this.dataSource.transaction((manager) => work(manager)) : work(undefined);
  }

  /** `uq_drivers_pinfl` / `uq_drivers_tin` (migratsiya 030) → 409 kodli xato. */
  private translateUniqueViolation(err: unknown): unknown {
    const pg = err as { code?: string; constraint?: string; detail?: string };
    if (pg?.code !== PG_UNIQUE_VIOLATION) return err;
    const hint = `${pg.constraint ?? ''} ${pg.detail ?? ''}`;
    const field = hint.includes('tin') && !hint.includes('pinfl') ? 'tin' : 'pinfl';
    return codedConflict(
      ERROR_CODES.legalProfileDuplicate,
      field === 'pinfl'
        ? "Bu JShShIR boshqa haydovchi profilida ro'yxatdan o'tgan"
        : "Bu STIR boshqa haydovchi profilida ro'yxatdan o'tgan",
      { details: { field } },
    );
  }

  private async summarize(driver: LegalDriver, now: Date): Promise<DriverLegalSummary> {
    return { profile: this.toProfile(driver), eligibility: await this.evaluate(driver, now) };
  }

  private toProfile(driver: LegalDriver): DriverLegalProfile {
    return {
      taxStatus: driver.taxStatus ?? null,
      pinfl: driver.pinfl ?? null,
      tin: driver.tin ?? null,
      birthDate: driver.birthDate ?? null,
      drivingLicenceIssuedAt: driver.drivingLicenceIssuedAt ?? null,
      taxiLicenceNumber: driver.taxiLicenceNumber ?? null,
      taxiLicenceRegion: driver.taxiLicenceRegion ?? null,
      citizenship: driver.citizenship ?? 'UZ',
    };
  }

  /** Taksi huquqiy hujjatlari (migratsiya 025) — tekshiruv tizimidan holat. */
  private async legalDocuments(driver: LegalDriver, now: Date) {
    // Xulosadan (`getSummaryForDriver`) EMAS: u yoqilmagan xizmat qoidalarini
    // ham ko'rsatadi, huquqiy xulosaga esa faqat haydovchiga qo'llanadigani kerak.
    const states = await this.verificationService.getLegalDocumentStatesForDrivers(
      [driver],
      LEGAL_REQUIREMENT_CODES,
      now,
    );
    return states.get(driver.id) ?? [];
  }

  private async resolveSettings(): Promise<ResolvedLegalSettings> {
    const settings = await this.settingsService.getLegalComplianceSettings();
    return {
      enforcedFrom: settings.legalComplianceEnforcedFrom
        ? new Date(settings.legalComplianceEnforcedFrom)
        : null,
      rules: {
        minAgeYears: settings.minDriverAgeYears,
        minLicenceExperienceYears: settings.minLicenceExperienceYears,
        maxVehicleAgeYears: settings.maxVehicleAgeYears,
      },
    };
  }

  private toStatus(
    driver: LegalDriver,
    documents: readonly LegalDocumentState[],
    settings: ResolvedLegalSettings,
    now: Date,
  ): DriverLegalStatus {
    const result: DriverLegalEligibility = evaluateDriverLegalEligibility(
      { ...driver, documents },
      settings.rules,
      now,
    );
    const enforced = isLegalComplianceEnforced(settings.enforcedFrom, now);
    const appliesToTaxi = resolveDriverServiceTypes(driver.serviceTypes).includes(ServiceType.TAXI);
    return {
      ...result,
      enforced,
      enforcedFrom: settings.enforcedFrom ? settings.enforcedFrom.toISOString() : null,
      appliesToTaxi,
      blocking: enforced && appliesToTaxi && !result.eligible,
    };
  }

  /** `; ` — xato lug'ati ro'yxatni shu ajratuvchi bo'yicha bo'lak-bo'lak o'giradi. */
  private joinReasons(reasons: LegalIneligibilityReason[]): string {
    return reasons.map((r) => r.message).join('; ');
  }
}
