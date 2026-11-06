import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Incident,
  IncidentOutcomeRecord,
  IncidentStatus,
} from '../../database/entities/incident.entity';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import {
  ERROR_CODES,
  codedBadRequest,
  codedConflict,
  codedForbidden,
} from '../../common/errors/coded-error';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_INCIDENT_SETTINGS, IncidentSettings } from '../settings/incident-settings';
import { DriverWalletAdjustmentsService } from '../drivers/driver-wallet-adjustments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutcomeInput, OutcomeProblem, validateOutcomes } from './incident-policy';
import { IncidentOrderContext, loadIncidentOrder } from './incident-orders';
import { AfterCommit, ExecutionScope, IncidentOutcomeExecutor } from './incident-outcome-executor';
import { countConfirmedStrikes } from './incident-strikes';
import { appealDecidedPush, reporterResolvedPush } from './incident-texts';

export interface ResolveIncidentInput {
  status: 'resolved' | 'rejected';
  note: string;
  confirmedAgainstSubject?: boolean;
  outcomes?: OutcomeInput[];
  appealDecision?: 'upheld' | 'overturned';
}

type Actor = Pick<User, 'id' | 'role' | 'permissions'>;

const ACTIVE = [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING];

/**
 * Hodisani hal qilish (docs/INCIDENT-POLICY.md §3): qaror izohi majburiy,
 * natijalar (bir yoki bir nechta) audit va daftar bilan BITTA
 * tranzaksiyada. Xavfsizlik/blok pog'onasi/e'tiroz — faqat admin.
 */
@Injectable()
export class IncidentResolutionService {
  constructor(
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    private readonly dataSource: DataSource,
    private readonly executor: IncidentOutcomeExecutor,
    private readonly auditLog: AuditLogService,
    private readonly wallet: DriverWalletAdjustmentsService,
    @Optional() private readonly settingsService?: SettingsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async resolve(actor: Actor, id: string, input: ResolveIncidentInput, now: Date = new Date()): Promise<Incident> {
    const incident = await this.incidents.findOne({ where: { id } });
    if (!incident) throw new NotFoundException('Murojaat topilmadi');
    if (!ACTIVE.includes(incident.status)) {
      throw codedConflict(ERROR_CODES.incidentStateConflict, "Murojaat allaqachon ko'rib chiqilgan", {
        details: { status: incident.status },
      });
    }
    const isAdmin = actor.role === UserRole.ADMIN;
    const pendingAppeal = incident.appealedAt != null && incident.appealDecision == null;
    if ((incident.escalatedToAdmin || pendingAppeal) && !isAdmin) {
      throw codedForbidden(ERROR_CODES.incidentAdminRequired, 'Bu murojaatni faqat admin hal qiladi');
    }

    const settings = await this.settings();
    const outcomes = this.normalizeOutcomes(input, settings);
    const ctx =
      incident.orderVertical && incident.orderId
        ? await loadIncidentOrder((sql, p) => this.dataSource.query(sql, p), incident.orderVertical, incident.orderId)
        : null;
    const problems = await this.problems(actor, isAdmin, incident, ctx, input, outcomes, pendingAppeal);
    if (problems.length > 0) {
      throw codedBadRequest(ERROR_CODES.incidentOutcomeInvalid, 'Natijalar qoidaga mos emas', { reasons: problems });
    }

    const overturned = pendingAppeal && input.appealDecision === 'overturned';
    const confirmed =
      input.status === 'resolved' && !overturned
        ? (input.confirmedAgainstSubject ?? (pendingAppeal ? incident.confirmedAgainstSubject : false))
        : false;
    const strikes =
      confirmed && incident.subjectUserId
        ? (await countConfirmedStrikes((s, p) => this.dataSource.query(s, p), incident.subjectUserId, settings.strikeWindowDays, now, incident.id)) + 1
        : 0;
    const needsBlockReview = confirmed && strikes >= settings.strikeBlockAt && !outcomes.some((o) => o.type === 'block');

    const after: AfterCommit[] = [];
    const saved = await this.dataSource.transaction(async (manager) => {
      const locked = (await manager.query(
        `SELECT id FROM incidents WHERE id = $1 AND status IN ('open', 'investigating') FOR UPDATE`,
        [incident.id],
      )) as unknown[];
      if (!Array.isArray(locked) || locked.length === 0) {
        throw codedConflict(ERROR_CODES.incidentStateConflict, "Murojaat allaqachon ko'rib chiqilgan", {
          details: { status: 'changed' },
        });
      }
      const scope: ExecutionScope = { manager, incident, ctx, actorUserId: actor.id, note: input.note.trim(), now, after };
      let records: IncidentOutcomeRecord[] = [...(incident.outcomes ?? [])];
      const imposesSanction = outcomes.some((o) => o.type === 'suspension' || o.type === 'block');
      records = await this.undoPrevious(scope, records, { overturned, liftAutomatic: !imposesSanction });
      for (const outcome of outcomes) {
        records.push(await this.executor.execute(scope, outcome));
      }
      const changes: Partial<Incident> = {
        status: input.status === 'rejected' ? IncidentStatus.REJECTED : IncidentStatus.RESOLVED,
        resolutionNote: scope.note,
        resolvedBy: actor.id,
        resolvedAt: now,
        confirmedAgainstSubject: confirmed,
        outcomes: records,
        assignedManagerId: incident.assignedManagerId ?? actor.id,
        // Blok pog'onasi: hal qilingan, lekin admin blokni ko'rib chiqishi kerak.
        escalatedToAdmin: needsBlockReview,
        appealDecision: pendingAppeal ? (input.appealDecision ?? null) : incident.appealDecision,
      };
      await manager.getRepository(Incident).update(incident.id, changes);
      await this.auditLog.record(
        {
          actorUserId: actor.id,
          action: pendingAppeal ? AUDIT_ACTIONS.incidentAppealDecision : AUDIT_ACTIONS.incidentResolve,
          targetType: 'incident',
          targetId: incident.id,
          note: scope.note.slice(0, 500),
          metadata: {
            status: changes.status,
            confirmed,
            strikes,
            outcomes: outcomes.map((o) => o.type),
            ...(pendingAppeal ? { decision: input.appealDecision } : {}),
          },
        },
        manager,
      );
      return { ...incident, ...changes } as Incident;
    });

    this.notifyParties(saved, pendingAppeal, overturned, after);
    await this.executor.runAfter(after);
    return saved;
  }

  private async settings(): Promise<IncidentSettings> {
    return this.settingsService ? this.settingsService.getIncidentSettings() : DEFAULT_INCIDENT_SETTINGS;
  }

  /** Standartlar: to'xtatish kunlari — `suspensionDays`, qaytarish — hamyonga. Rad etilsa — natija yo'q. */
  private normalizeOutcomes(input: ResolveIncidentInput, settings: IncidentSettings): OutcomeInput[] {
    return (input.outcomes ?? [])
      .filter((o) => !(input.status === 'rejected' && o.type === 'no_action'))
      .map((o) => ({
        ...o,
        days: o.type === 'suspension' ? (o.days ?? settings.suspensionDays) : undefined,
        refundMethod: o.type === 'refund' ? (o.refundMethod ?? 'wallet') : undefined,
      }));
  }

  private async problems(
    actor: Actor,
    isAdmin: boolean,
    incident: Incident,
    ctx: IncidentOrderContext | null,
    input: ResolveIncidentInput,
    outcomes: OutcomeInput[],
    pendingAppeal: boolean,
  ): Promise<OutcomeProblem[]> {
    const problems: OutcomeProblem[] = [];
    if (input.status === 'rejected' && outcomes.length > 0) {
      problems.push({ code: 'rejected_with_outcomes', message: "Rad etilgan murojaatda natija bo'lmaydi" });
    }
    if (pendingAppeal && !input.appealDecision) {
      problems.push({ code: 'appeal_decision_required', message: "E'tiroz bo'yicha qarorni tanlang" });
    }
    if (input.confirmedAgainstSubject && !incident.subjectUserId) {
      problems.push({ code: 'no_subject', message: "Bu hodisada shikoyat qilingan shaxs yo'q" });
    }
    const amountLimit = await this.wallet.amountLimitFor(isAdmin);
    return problems.concat(
      validateOutcomes(outcomes, {
        isAdmin,
        canMoveMoney: (actor.permissions ?? []).includes(Permission.DRIVERS_FINANCE),
        subjectRole: incident.subjectRole,
        hasSubject: incident.subjectUserId != null,
        hasCustomer: ctx != null,
        hasDriver: ctx?.driverUserId != null,
        vertical: incident.orderVertical,
        amountLimit,
        maxSuspensionDays: 90,
      }),
    );
  }

  /**
   * Avvalgi sanksiyalarni qaytarish: e'tiroz qabul qilinsa — hammasi
   * (to'xtatish, blok); xavfsizlik bo'yicha avtomatik to'xtatish — admin
   * yangi to'xtatish/blok qo'ymasa olib tashlanadi.
   */
  private async undoPrevious(
    scope: ExecutionScope,
    records: IncidentOutcomeRecord[],
    opts: { overturned: boolean; liftAutomatic: boolean },
  ): Promise<IncidentOutcomeRecord[]> {
    const result: IncidentOutcomeRecord[] = [];
    for (const record of records) {
      if (record.type === 'suspension' && (opts.overturned || (record.automatic && opts.liftAutomatic))) {
        result.push(await this.executor.lift(scope, record));
      } else if (record.type === 'block' && opts.overturned) {
        result.push(await this.executor.unblock(scope, record));
      } else {
        result.push(record);
      }
    }
    return result;
  }

  private notifyParties(incident: Incident, appeal: boolean, overturned: boolean, after: AfterCommit[]): void {
    const notify = this.notifications;
    if (!notify) return;
    if (appeal && incident.subjectUserId) {
      const subject = incident.subjectUserId;
      after.push(() => notify.notifyUserIds([subject], appealDecidedPush(overturned), 'incident_appeal_decided', { incidentId: incident.id }));
    } else if (incident.reporterUserId && incident.source === 'user') {
      const reporter = incident.reporterUserId;
      const rejected = incident.status === IncidentStatus.REJECTED;
      after.push(() => notify.notifyUserIds([reporter], reporterResolvedPush(rejected), 'incident_resolved', { incidentId: incident.id }));
    }
  }
}
