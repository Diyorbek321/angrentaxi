import { HttpException, HttpStatus, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  Incident,
  IncidentOutcomeRecord,
  IncidentStatus,
  IncidentVertical,
} from '../../database/entities/incident.entity';
import { User } from '../../database/entities/user.entity';
import { ERROR_CODES, codedBadRequest, codedConflict, codedForbidden } from '../../common/errors/coded-error';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_INCIDENT_SETTINGS, IncidentSettings } from '../settings/incident-settings';
import { NotificationsService } from '../notifications/notifications.service';
import { DriversService } from '../drivers/drivers.service';
import { UploadedMemoryFile } from '../drivers/driver-uploads';
import {
  IncidentCategory,
  categoryAllowedFor,
  hasSanctionAgainstSubject,
  isSafetyCategory,
  isUserCategory,
  withinReportWindow,
} from './incident-policy';
import { IncidentOrderContext, loadIncidentOrder, partyOf } from './incident-orders';
import { REPORTER_ROLE_OF_PARTY, SIDE_OF_PARTY, SubjectChoice, resolveSubject } from './incident-subject';
import { INCIDENT_PHOTO_MAX, IncidentPhotoFile, IncidentPhotosStore } from './incident-photos';
import { applySuspension } from './incident-sanctions';
import { safetySuspensionPush } from './incident-texts';
import { isSuspended } from './suspension';

/** Bir foydalanuvchi bir sutkada ko'pi bilan shuncha murojaat (spam/qasd). */
export const INCIDENT_DAILY_LIMIT = 10;

export interface ReportIncidentInput {
  vertical: IncidentVertical;
  orderId: string;
  category: string;
  description: string;
  subject?: SubjectChoice;
}

/** Xabarchi ko'radigan shakl — subyektning shaxsiy ma'lumotisiz. */
export interface ReporterIncidentView {
  id: string;
  vertical: IncidentVertical | null;
  orderId: string | null;
  category: string;
  description: string;
  status: IncidentStatus;
  photoCount: number;
  resolutionNote: string | null;
  /** Xabarchiga tegishli natija: qaytarilgan summa. */
  refundAmount: number;
  createdAt: Date;
  resolvedAt: Date | null;
}

/** Subyekt ko'radigan shakl — xabarchi kimligi va matni YO'Q (ta'qibdan himoya). */
export interface SubjectIncidentView {
  id: string;
  vertical: IncidentVertical | null;
  orderId: string | null;
  category: string;
  status: IncidentStatus;
  resolutionNote: string | null;
  outcomes: Array<Pick<IncidentOutcomeRecord, 'type' | 'amount' | 'days' | 'until' | 'at'>>;
  safetySuspended: boolean;
  resolvedAt: Date | null;
  appeal: { canAppeal: boolean; deadline: string | null; appealedAt: Date | null; decision: string | null };
}

export interface AboutMeView {
  suspension: { until: string; reason: string | null } | null;
  items: SubjectIncidentView[];
}

const SUBJECT_VISIBLE_OUTCOMES = ['warning', 'suspension', 'block', 'penalty'];

/**
 * Foydalanuvchi tomoni: shikoyat qoldirish, foto, "Murojaatlarim", subyekt
 * uchun ogohlantirish/to'xtatishlar va e'tiroz (docs/INCIDENT-POLICY.md §3).
 */
@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    private readonly dataSource: DataSource,
    private readonly photos: IncidentPhotosStore,
    private readonly auditLog: AuditLogService,
    @Optional() private readonly settingsService?: SettingsService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly driversService?: DriversService,
  ) {}

  async settings(): Promise<IncidentSettings> {
    return this.settingsService ? this.settingsService.getIncidentSettings() : DEFAULT_INCIDENT_SETTINGS;
  }

  async report(user: Pick<User, 'id'>, input: ReportIncidentInput, now: Date = new Date()): Promise<Incident> {
    if (!isUserCategory(input.category)) {
      throw codedBadRequest(ERROR_CODES.incidentNotAllowed, "Bu sababni tanlab bo'lmaydi");
    }
    const category = input.category as IncidentCategory;
    const ctx = await loadIncidentOrder((sql, p) => this.dataSource.query(sql, p), input.vertical, input.orderId);
    if (!ctx) throw new NotFoundException('Buyurtma topilmadi');
    const party = partyOf(ctx, user.id);
    if (!party) {
      throw codedForbidden(ERROR_CODES.incidentNotAllowed, 'Siz bu buyurtma ishtirokchisi emassiz');
    }
    if (!categoryAllowedFor(SIDE_OF_PARTY[party], category)) {
      throw codedBadRequest(ERROR_CODES.incidentNotAllowed, "Bu sababni tanlab bo'lmaydi");
    }
    const settings = await this.settings();
    this.assertTiming(ctx, category, now, settings.incidentReportWindowDays);
    await this.assertDailyLimit(user.id, now);

    const subject = resolveSubject(ctx, party, category, input.subject);
    if (subject && subject.userId === user.id) {
      throw codedBadRequest(ERROR_CODES.incidentNotAllowed, "O'zingiz haqingizda shikoyat qoldirib bo'lmaydi");
    }

    const existing = await this.incidents.findOne({
      where: {
        reporterUserId: user.id,
        orderVertical: ctx.vertical,
        orderId: ctx.orderId,
        status: In([IncidentStatus.OPEN, IncidentStatus.INVESTIGATING]),
        source: In(['user', 'low_rating']),
      },
    });
    if (existing?.source === 'user') {
      throw codedConflict(ERROR_CODES.incidentAlreadyOpen, "Bu buyurtma bo'yicha murojaatingiz ko'rib chiqilmoqda", {
        details: { incidentId: existing.id },
      });
    }

    const safety = isSafetyCategory(category) && (subject?.role === 'driver' || subject?.role === 'passenger');
    const created = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Incident);
      const base = {
        reporterUserId: user.id,
        reporterRole: REPORTER_ROLE_OF_PARTY[party],
        subjectUserId: subject?.userId ?? null,
        subjectRole: subject?.role ?? null,
        orderVertical: ctx.vertical,
        orderId: ctx.orderId,
        category,
        description: input.description.trim(),
        source: 'user' as const,
        escalatedToAdmin: safety,
        safetySuspended: safety,
      };
      // Past baho qoralamasi shu buyurtmada bo'lsa — u haqiqiy shikoyatga aylanadi (takror yo'q).
      const saved = existing
        ? await repo.save({ ...existing, ...base, description: `${base.description}\n— ${existing.description}`.slice(0, 1000) })
        : await repo.save(repo.create(base));
      if (safety && subject) {
        const outcome = await this.safetySuspend(manager, saved, subject.userId, settings.suspensionDays, now);
        saved.outcomes = [outcome];
        await repo.update(saved.id, { outcomes: saved.outcomes });
      }
      return saved;
    });

    if (safety && subject) await this.afterSafetySuspension(created, subject);
    return created;
  }

  async addPhoto(userId: string, incidentId: string, file: UploadedMemoryFile | undefined): Promise<Incident> {
    if (!file?.buffer) {
      throw codedBadRequest(ERROR_CODES.incidentNotAllowed, 'Fayl yuborilmadi (multipart maydoni "file" kutilgan)');
    }
    const incident = await this.incidents.findOne({ where: { id: incidentId } });
    if (!incident || incident.reporterUserId !== userId) throw new NotFoundException('Murojaat topilmadi');
    if (incident.status !== IncidentStatus.OPEN && incident.status !== IncidentStatus.INVESTIGATING) {
      throw codedConflict(ERROR_CODES.incidentStateConflict, "Ko'rib chiqilgan murojaatga foto qo'shib bo'lmaydi", {
        details: { status: incident.status },
      });
    }
    if ((incident.photoKeys ?? []).length >= INCIDENT_PHOTO_MAX) {
      throw codedBadRequest(ERROR_CODES.incidentNotAllowed, `Ko'pi bilan ${INCIDENT_PHOTO_MAX} ta foto`);
    }
    const key = await this.photos.save(file);
    // Parallel yuklashda ham 3 tadan oshmasin — shartli yozuv.
    const result = await this.incidents
      .createQueryBuilder()
      .update(Incident)
      .set({ photoKeys: () => `photo_keys || :key::jsonb` })
      .where('id = :id AND jsonb_array_length(photo_keys) < :max', { id: incidentId, max: INCIDENT_PHOTO_MAX })
      .setParameter('key', JSON.stringify([key]))
      .execute();
    if (!result.affected) {
      throw codedBadRequest(ERROR_CODES.incidentNotAllowed, `Ko'pi bilan ${INCIDENT_PHOTO_MAX} ta foto`);
    }
    return { ...incident, photoKeys: [...(incident.photoKeys ?? []), key] };
  }

  /** Foto: xabarchi yoki xodim (`isStaff`). Subyekt ko'rmaydi. */
  async openPhoto(
    viewer: { id: string; isStaff: boolean },
    incidentId: string,
    index: number,
  ): Promise<IncidentPhotoFile> {
    const incident = await this.incidents.findOne({ where: { id: incidentId } });
    if (!incident || (!viewer.isStaff && incident.reporterUserId !== viewer.id)) {
      throw new NotFoundException('Murojaat topilmadi');
    }
    const key = incident.photoKeys?.[index];
    const file = key ? await this.photos.open(key) : null;
    if (!file) throw new NotFoundException('Foto topilmadi');
    return file;
  }

  async listMine(userId: string): Promise<ReporterIncidentView[]> {
    const rows = await this.incidents.find({
      where: { reporterUserId: userId, source: In(['user', 'low_rating']) },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map((i) => ({
      id: i.id,
      vertical: i.orderVertical,
      orderId: i.orderId,
      category: i.category,
      description: i.description,
      status: i.status,
      photoCount: (i.photoKeys ?? []).length,
      resolutionNote: i.status === IncidentStatus.RESOLVED || i.status === IncidentStatus.REJECTED ? i.resolutionNote : null,
      refundAmount: (i.outcomes ?? [])
        .filter((o) => o.type === 'refund' && o.targetUserId === userId)
        .reduce((sum, o) => sum + (o.amount ?? 0), 0),
      createdAt: i.createdAt,
      resolvedAt: i.resolvedAt,
    }));
  }

  async aboutMe(userId: string, now: Date = new Date()): Promise<AboutMeView> {
    const settings = await this.settings();
    const [rows, user] = await Promise.all([
      this.incidents.find({ where: { subjectUserId: userId }, order: { createdAt: 'DESC' }, take: 50 }),
      this.dataSource.getRepository(User).findOne({
        where: { id: userId },
        select: ['id', 'suspendedUntil', 'suspensionReason'],
      }),
    ]);
    const visible = rows.filter(
      (i) =>
        i.safetySuspended ||
        (i.status === IncidentStatus.RESOLVED && (i.confirmedAgainstSubject || hasSanctionAgainstSubject(i.outcomes ?? []))) ||
        i.appealedAt != null,
    );
    return {
      suspension:
        user && isSuspended(user, now)
          ? { until: new Date(user.suspendedUntil as Date).toISOString(), reason: user.suspensionReason }
          : null,
      items: visible.map((i) => this.subjectView(i, settings, now)),
    };
  }

  async appeal(userId: string, incidentId: string, note: string, now: Date = new Date()): Promise<SubjectIncidentView> {
    const incident = await this.incidents.findOne({ where: { id: incidentId } });
    if (!incident || incident.subjectUserId !== userId) throw new NotFoundException('Murojaat topilmadi');
    const settings = await this.settings();
    const reason = this.appealBlocker(incident, settings, now);
    if (reason) {
      throw codedConflict(ERROR_CODES.incidentAppealNotAllowed, "Bu qarorga e'tiroz bildirib bo'lmaydi", {
        details: { reason },
      });
    }
    const updated = await this.incidents
      .createQueryBuilder()
      .update(Incident)
      .set({
        status: IncidentStatus.INVESTIGATING,
        appealedAt: now,
        appealNote: note.trim().slice(0, 1000),
        escalatedToAdmin: true,
      })
      .where('id = :id AND status = :status AND appealed_at IS NULL', { id: incidentId, status: IncidentStatus.RESOLVED })
      .execute()
      .catch((error: { code?: string }) => {
        // Xabarchining shu buyurtmada boshqa ochiq shikoyati bor (qisman unikal indeks).
        if (error?.code === '23505') return { affected: 0 };
        throw error;
      });
    if (!updated.affected) {
      throw codedConflict(ERROR_CODES.incidentAppealNotAllowed, "Bu qarorga e'tiroz bildirib bo'lmaydi", {
        details: { reason: 'already_appealed' },
      });
    }
    const fresh = { ...incident, status: IncidentStatus.INVESTIGATING, appealedAt: now, appealNote: note };
    return this.subjectView(fresh, settings, now);
  }

  private appealBlocker(incident: Incident, settings: IncidentSettings, now: Date): string | null {
    if (incident.appealedAt) return 'already_appealed';
    if (incident.status !== IncidentStatus.RESOLVED || !incident.resolvedAt) return 'not_resolved';
    if (!incident.confirmedAgainstSubject && !hasSanctionAgainstSubject(incident.outcomes ?? [])) return 'no_sanction';
    const deadline = new Date(incident.resolvedAt).getTime() + settings.incidentAppealWindowDays * 86_400_000;
    if (now.getTime() > deadline) return 'window_closed';
    return null;
  }

  private subjectView(i: Incident, settings: IncidentSettings, now: Date): SubjectIncidentView {
    const deadline = i.resolvedAt
      ? new Date(new Date(i.resolvedAt).getTime() + settings.incidentAppealWindowDays * 86_400_000).toISOString()
      : null;
    return {
      id: i.id,
      vertical: i.orderVertical,
      orderId: i.orderId,
      category: i.category,
      status: i.status,
      resolutionNote: i.status === IncidentStatus.RESOLVED ? i.resolutionNote : null,
      outcomes: (i.outcomes ?? [])
        .filter((o) => SUBJECT_VISIBLE_OUTCOMES.includes(o.type) && (!o.targetUserId || o.targetUserId === i.subjectUserId))
        .map((o) => ({ type: o.type, amount: o.amount, days: o.days, until: o.until, at: o.at })),
      safetySuspended: i.safetySuspended,
      resolvedAt: i.resolvedAt,
      appeal: {
        canAppeal: this.appealBlocker(i, settings, now) === null,
        deadline,
        appealedAt: i.appealedAt,
        decision: i.appealDecision,
      },
    };
  }

  /** Muddat: tugagan buyurtma — `windowDays` ichida; davom etayotgan safar — faqat xavfsizlik. */
  private assertTiming(ctx: IncidentOrderContext, category: IncidentCategory, now: Date, windowDays: number): void {
    if (ctx.active && isSafetyCategory(category)) return;
    if (!withinReportWindow(ctx.endedAt, now, windowDays)) {
      throw codedBadRequest(
        ERROR_CODES.incidentWindowClosed,
        `Shikoyat buyurtma tugaganidan keyin ${windowDays} kun ichida qoldiriladi`,
        { details: { days: windowDays } },
      );
    }
  }

  private async assertDailyLimit(userId: string, now: Date): Promise<void> {
    const count = await this.incidents.count({
      where: { reporterUserId: userId, createdAt: MoreThanOrEqual(new Date(now.getTime() - 86_400_000)) },
    });
    if (count >= INCIDENT_DAILY_LIMIT) {
      throw new HttpException("Bugun juda ko'p murojaat yubordingiz — ertaga urinib ko'ring", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** Xavfsizlik toifasi: subyekt darhol to'xtatiladi, admin qaror qiladi (tizim amali). */
  private async safetySuspend(
    manager: EntityManager,
    incident: Incident,
    subjectUserId: string,
    days: number,
    now: Date,
  ): Promise<IncidentOutcomeRecord> {
    const until = await applySuspension(
      manager,
      subjectUserId,
      new Date(now.getTime() + days * 86_400_000),
      "Xavfsizlik shikoyati — admin ko'rib chiqmoqda",
    );
    const audit = await this.auditLog.record(
      {
        actorUserId: null,
        action: AUDIT_ACTIONS.incidentSafetySuspension,
        targetType: 'user',
        targetId: subjectUserId,
        note: incident.category,
        metadata: { incidentId: incident.id, until: until.toISOString(), days },
      },
      manager,
    );
    return {
      type: 'suspension',
      days,
      until: until.toISOString(),
      targetUserId: subjectUserId,
      automatic: true,
      auditLogId: audit.id,
      actorUserId: null,
      at: now.toISOString(),
    };
  }

  private async afterSafetySuspension(incident: Incident, subject: { userId: string; role: string }): Promise<void> {
    const until = incident.outcomes?.[0]?.until;
    try {
      if (subject.role === 'driver') await this.driversService?.forceOffline(subject.userId);
      if (until) {
        await this.notifications?.notifyUserIds([subject.userId], safetySuspensionPush(new Date(until)), 'incident_suspended', {
          incidentId: incident.id,
        });
      }
    } catch (error) {
      this.logger.warn(`Safety suspension side effects failed for ${incident.id}: ${(error as Error).message}`);
    }
  }
}
