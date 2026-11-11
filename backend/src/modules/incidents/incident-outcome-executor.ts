import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Incident, IncidentOutcomeRecord } from '../../database/entities/incident.entity';
import { Driver } from '../../database/entities/driver.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { lockWalletForUpdate } from '../payments/wallet-balance.util';
import { INCIDENT_PENALTY_LEDGER_PREFIX } from '../orders/outstanding-wallet-debt';
import {
  DriverWalletAdjustmentsService,
  WalletMovementResult,
} from '../drivers/driver-wallet-adjustments.service';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { LocalizedPush } from '../notifications/push-text';
import { OutcomeInput } from './incident-policy';
import { IncidentOrderContext } from './incident-orders';
import { applySuspension, liftSuspension } from './incident-sanctions';
import { penaltyPush, refundPush, suspensionLiftedPush, suspensionPush, warningPush } from './incident-texts';

export const INCIDENT_REFUND_LEDGER_PREFIX = 'incident_refund_';
export const INCIDENT_COMPENSATION_LEDGER_PREFIX = 'incident_compensation_';

/** Commit'dan KEYIN bajariladigan oqibatlar (push, oflayn, hamyon hodisasi). */
export type AfterCommit = () => Promise<void>;

export interface ExecutionScope {
  manager: EntityManager;
  incident: Incident;
  ctx: IncidentOrderContext | null;
  actorUserId: string;
  note: string;
  now: Date;
  after: AfterCommit[];
}

/**
 * Hodisa natijalarini bajaradi — HAR biri audit yozuvi (+ kerak bo'lsa
 * daftar qatori) bilan, chaqiruvchining BITTA tranzaksiyasida
 * (INCIDENT-POLICY tamoyil 2). Push va Redis — commit'dan keyin (`after`).
 */
@Injectable()
export class IncidentOutcomeExecutor {
  private readonly logger = new Logger(IncidentOutcomeExecutor.name);

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly wallet: DriverWalletAdjustmentsService,
    private readonly usersService: UsersService,
    @Optional() private readonly driversService?: DriversService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async execute(scope: ExecutionScope, outcome: OutcomeInput): Promise<IncidentOutcomeRecord> {
    switch (outcome.type) {
      case 'warning':
        return this.warning(scope);
      case 'suspension':
        return this.suspension(scope, outcome.days ?? 1);
      case 'block':
        return this.block(scope);
      case 'refund':
        return outcome.refundMethod === 'card'
          ? this.cardRefund(scope, outcome.amount ?? 0)
          : this.walletRefund(scope, outcome.amount ?? 0);
      case 'compensation':
        return this.driverMovement(scope, scope.ctx?.driverUserId ?? null, outcome.amount ?? 0, 'compensation');
      case 'penalty':
        return scope.incident.subjectRole === 'driver'
          ? this.driverMovement(scope, scope.incident.subjectUserId, -(outcome.amount ?? 0), 'penalty')
          : this.passengerPenalty(scope, outcome.amount ?? 0);
      default:
        return this.record(scope, { type: 'no_action' }, null);
    }
  }

  /** To'xtatishni olib tashlaydi (admin qarori / e'tiroz qabul qilindi). Yozuvning yangi shakli. */
  async lift(scope: ExecutionScope, previous: IncidentOutcomeRecord): Promise<IncidentOutcomeRecord> {
    const userId = previous.targetUserId ?? scope.incident.subjectUserId;
    if (!userId || !previous.until || previous.liftedAt) return previous;
    const lifted = await liftSuspension(scope.manager, userId, new Date(previous.until));
    await this.auditLog.record(
      {
        actorUserId: scope.actorUserId,
        action: AUDIT_ACTIONS.incidentSuspensionLifted,
        targetType: 'user',
        targetId: userId,
        note: scope.note,
        metadata: { incidentId: scope.incident.id, until: previous.until, lifted },
      },
      scope.manager,
    );
    if (lifted) this.push(scope, userId, suspensionLiftedPush(), 'incident_suspension_lifted');
    return { ...previous, liftedAt: scope.now.toISOString() };
  }

  /** Blokni bekor qiladi (e'tiroz qabul qilindi). */
  async unblock(scope: ExecutionScope, previous: IncidentOutcomeRecord): Promise<IncidentOutcomeRecord> {
    const userId = previous.targetUserId ?? scope.incident.subjectUserId;
    if (!userId || previous.liftedAt) return previous;
    await scope.manager.query(
      `UPDATE users SET status = 'active', block_reason = NULL WHERE id = $1 AND status = 'blocked'`,
      [userId],
    );
    await this.auditLog.record(
      {
        actorUserId: scope.actorUserId,
        action: AUDIT_ACTIONS.userUnblock,
        targetType: 'user',
        targetId: userId,
        note: scope.note,
        metadata: { incidentId: scope.incident.id },
      },
      scope.manager,
    );
    return { ...previous, liftedAt: scope.now.toISOString() };
  }

  private async warning(scope: ExecutionScope): Promise<IncidentOutcomeRecord> {
    const subject = this.subjectOrThrow(scope);
    const audit = await this.audit(scope, AUDIT_ACTIONS.incidentWarning, subject, null);
    this.push(scope, subject, warningPush(scope.note), 'incident_warning');
    return this.record(scope, { type: 'warning', targetUserId: subject }, audit);
  }

  private async suspension(scope: ExecutionScope, days: number): Promise<IncidentOutcomeRecord> {
    const subject = this.subjectOrThrow(scope);
    const until = await applySuspension(
      scope.manager,
      subject,
      new Date(scope.now.getTime() + days * 86_400_000),
      scope.note,
    );
    const audit = await this.audit(scope, AUDIT_ACTIONS.incidentSuspension, subject, null, {
      days,
      until: until.toISOString(),
    });
    const isDriver = scope.incident.subjectRole === 'driver';
    scope.after.push(async () => {
      if (isDriver) await this.driversService?.forceOffline(subject);
    });
    this.push(scope, subject, suspensionPush(until, scope.note), 'incident_suspended');
    return this.record(scope, { type: 'suspension', targetUserId: subject, days, until: until.toISOString() }, audit);
  }

  /** Mavjud blok: status + sabab shu tranzaksiyada, oqibatlar (oflayn, socket, push) — commit'dan keyin. */
  private async block(scope: ExecutionScope): Promise<IncidentOutcomeRecord> {
    const subject = this.subjectOrThrow(scope);
    await scope.manager.query(`UPDATE users SET status = 'blocked', block_reason = $2 WHERE id = $1`, [
      subject,
      scope.note.slice(0, 300),
    ]);
    const audit = await this.auditLog.record(
      {
        actorUserId: scope.actorUserId,
        action: AUDIT_ACTIONS.userBlock,
        targetType: 'user',
        targetId: subject,
        note: scope.note.slice(0, 500),
        metadata: { incidentId: scope.incident.id, role: scope.incident.subjectRole },
      },
      scope.manager,
    );
    scope.after.push(() => this.usersService.runBlockListeners(subject));
    return this.record(scope, { type: 'block', targetUserId: subject }, audit);
  }

  private async walletRefund(scope: ExecutionScope, amount: number): Promise<IncidentOutcomeRecord> {
    const customer = scope.ctx?.customerId;
    if (!customer) throw new BadRequestException("Qaytarish uchun mijoz yo'q");
    await lockWalletForUpdate(scope.manager, customer);
    const audit = await this.audit(scope, AUDIT_ACTIONS.incidentRefund, customer, amount, { refundMethod: 'wallet' });
    // Buyurtmaga BOG'LANMAYDI: chek va karta to'lovi qidiruvi buyurtmaning DEBIT qatorlariga tayanadi.
    await scope.manager.getRepository(Transaction).save({
      userId: customer,
      orderId: null,
      amount,
      type: TransactionType.CREDIT,
      paymentMethod: PaymentMethod.WALLET,
      status: TransactionStatus.COMPLETED,
      externalId: `${INCIDENT_REFUND_LEDGER_PREFIX}${audit.id}`,
    });
    this.push(scope, customer, refundPush(amount), 'incident_refund');
    return this.record(scope, { type: 'refund', amount, refundMethod: 'wallet', targetUserId: customer }, audit);
  }

  /** Kartali ovqat/market: mavjud qo'lda qaytarish navbatiga (`refund_due`, §2) qo'shiladi. */
  private async cardRefund(scope: ExecutionScope, amount: number): Promise<IncidentOutcomeRecord> {
    const ctx = scope.ctx;
    if (!ctx || (ctx.vertical !== 'food' && ctx.vertical !== 'market') || ctx.paymentMethod !== 'card') {
      throw new BadRequestException("Kartaga qaytarish faqat kartada to'langan ovqat/market buyurtmasida");
    }
    const pendingAlready = ctx.refundStatus === 'pending' ? (ctx.refundDue ?? 0) : 0;
    if (ctx.totalPrice !== null && pendingAlready + amount > ctx.totalPrice) {
      throw new BadRequestException("Qaytariladigan summa buyurtma summasidan oshmasligi kerak");
    }
    const table = ctx.vertical === 'food' ? 'food_orders' : 'market_orders';
    await scope.manager.query(
      `UPDATE ${table}
          SET refund_due = CASE WHEN refund_status = 'pending' THEN COALESCE(refund_due, 0) + $2 ELSE $2 END,
              refund_status = 'pending'
        WHERE id = $1`,
      [ctx.orderId, amount],
    );
    const audit = await this.audit(scope, AUDIT_ACTIONS.incidentRefund, ctx.customerId, amount, {
      refundMethod: 'card',
      vendorOrderId: ctx.orderId,
    });
    return this.record(scope, { type: 'refund', amount, refundMethod: 'card', targetUserId: ctx.customerId }, audit);
  }

  private async driverMovement(
    scope: ExecutionScope,
    driverUserId: string | null,
    signedAmount: number,
    kind: 'compensation' | 'penalty',
  ): Promise<IncidentOutcomeRecord> {
    if (!driverUserId) throw new BadRequestException("Bu hodisada haydovchi yo'q");
    const driver = await scope.manager.findOne(Driver, { where: { userId: driverUserId } });
    if (!driver) throw new BadRequestException('Haydovchi profili topilmadi');
    const result: WalletMovementResult = await this.wallet.applyWithin(scope.manager, {
      actorUserId: scope.actorUserId,
      driverId: driver.id,
      driverUserId,
      amount: signedAmount,
      note: scope.note.slice(0, 500),
      action: kind === 'compensation' ? AUDIT_ACTIONS.incidentCompensation : AUDIT_ACTIONS.incidentPenalty,
      ledgerPrefix: kind === 'compensation' ? INCIDENT_COMPENSATION_LEDGER_PREFIX : INCIDENT_PENALTY_LEDGER_PREFIX,
      metadata: { incidentId: scope.incident.id },
    });
    scope.after.push(() =>
      this.wallet.finalize(result, {
        amount: signedAmount,
        note: scope.note,
        reason: kind === 'compensation' ? 'incident_compensation' : 'incident_penalty',
      }),
    );
    return {
      type: kind,
      amount: Math.abs(signedAmount),
      targetUserId: driverUserId,
      auditLogId: result.auditId,
      actorUserId: scope.actorUserId,
      at: scope.now.toISOString(),
    };
  }

  /**
   * Yo'lovchi jarimasi — mavjud qarz mexanizmi: PENDING hamyon DEBIT'i.
   * To'lanmaguncha yangi buyurtma berilmaydi (`outstanding-wallet-debt.ts`).
   */
  private async passengerPenalty(scope: ExecutionScope, amount: number): Promise<IncidentOutcomeRecord> {
    const subject = this.subjectOrThrow(scope);
    await lockWalletForUpdate(scope.manager, subject);
    const audit = await this.audit(scope, AUDIT_ACTIONS.incidentPenalty, subject, amount);
    await scope.manager.getRepository(Transaction).save({
      userId: subject,
      orderId: null,
      amount,
      type: TransactionType.DEBIT,
      paymentMethod: PaymentMethod.WALLET,
      status: TransactionStatus.PENDING,
      externalId: `${INCIDENT_PENALTY_LEDGER_PREFIX}${audit.id}`,
    });
    this.push(scope, subject, penaltyPush(amount, scope.note), 'incident_penalty');
    return this.record(scope, { type: 'penalty', amount, targetUserId: subject }, audit);
  }

  private subjectOrThrow(scope: ExecutionScope): string {
    if (!scope.incident.subjectUserId) throw new BadRequestException("Bu hodisada shikoyat qilingan shaxs yo'q");
    return scope.incident.subjectUserId;
  }

  private async audit(
    scope: ExecutionScope,
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    targetUserId: string,
    amount: number | null,
    metadata: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    return this.auditLog.record(
      {
        actorUserId: scope.actorUserId,
        action,
        targetType: 'user',
        targetId: targetUserId,
        amount,
        note: scope.note.slice(0, 500),
        metadata: { incidentId: scope.incident.id, ...metadata },
      },
      scope.manager,
    );
  }

  private record(
    scope: ExecutionScope,
    fields: Omit<IncidentOutcomeRecord, 'auditLogId' | 'actorUserId' | 'at'>,
    audit: { id: string } | null,
  ): IncidentOutcomeRecord {
    return { ...fields, auditLogId: audit?.id ?? null, actorUserId: scope.actorUserId, at: scope.now.toISOString() };
  }

  private push(scope: ExecutionScope, userId: string, text: LocalizedPush, event: string): void {
    scope.after.push(async () => {
      await this.notifications?.notifyUserIds([userId], text, event, { incidentId: scope.incident.id });
    });
  }

  /** Commit'dan keyingi oqibatlar — har biri alohida, xato faqat log. */
  async runAfter(after: readonly AfterCommit[]): Promise<void> {
    for (const step of after) {
      try {
        await step();
      } catch (error) {
        this.logger.warn(`Incident side effect failed: ${(error as Error).message}`);
      }
    }
  }
}
