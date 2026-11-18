import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Driver } from '../../database/entities/driver.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { lockWalletForUpdate } from '../payments/wallet-balance.util';
import { AUDIT_ACTIONS, AuditAction, AuditLogService } from '../audit/audit-log.service';
import { formatSom } from '../delivery/vendor-wallet-settlement';
import { DriversService } from './drivers.service';
import { WalletChangeReason, WalletNotifierService } from './wallet-notifier.service';
import { UserRole } from '../../database/entities/user.entity';
import { SettingsService, DEFAULT_MANUAL_ADJUSTMENT_MANAGER_LIMIT } from '../settings/settings.service';
import { ERROR_CODES, codedForbidden } from '../../common/errors/coded-error';
import { localized } from '../notifications/push-text';

/** Bitta qo'lda tuzatishning mutlaq chegarasi (admin uchun ham), so'm. */
export const MANUAL_ADJUSTMENT_MAX = 5_000_000;

/** Qo'lda tuzatish daftar qatori: `manual_adjustment_<auditLogId>`. */
export const MANUAL_ADJUSTMENT_LEDGER_PREFIX = 'manual_adjustment_';

export type DriverWithWallet = Driver & { walletBalance: number };

export interface WalletMovementInput {
  actorUserId: string | null;
  driverId: string;
  driverUserId: string;
  /** Ishorali: + kirim, − chiqim. */
  amount: number;
  note: string;
  action: AuditAction;
  /** Daftar belgisi: `<prefix><auditLogId>`. */
  ledgerPrefix: string;
  metadata?: Record<string, unknown>;
}

export interface WalletMovementResult {
  auditId: string;
  driverId: string;
  driverUserId: string;
  newBalance: number;
  wentOffline: boolean;
}

/**
 * Hamyonni qo'lda to'ldirish/tuzatish — `PATCH /drivers/:id/balance`
 * (docs/LEGAL-COMPLIANCE.md §12).
 *
 *  · Izoh MAJBURIY: pul harakati sababsiz qolmasin.
 *  · Jurnal yozuvi (`audit_logs`), daftar qatori va `drivers.balance`
 *    sinxroni — BITTA tranzaksiyada, hamyon qulfi ostida.
 *  · Commit'dan keyin haydovchiga push + `wallet:updated`.
 */
@Injectable()
export class DriverWalletAdjustmentsService {
  private readonly logger = new Logger(DriverWalletAdjustmentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly driversService: DriversService,
    private readonly auditLog: AuditLogService,
    private readonly notifier: WalletNotifierService,
    // `manualAdjustmentManagerLimit` (#6). Ixtiyoriy — qo'lda yig'iladigan spec'lar uchun.
    @Optional() private readonly settingsService?: SettingsService,
  ) {}

  async adjust(
    actorUserId: string,
    driverId: string,
    amount: number,
    rawNote: string,
    actorRole: UserRole = UserRole.ADMIN,
  ): Promise<DriverWithWallet> {
    const note = (rawNote ?? '').trim();
    if (!note) {
      throw new BadRequestException("Izoh majburiy: balans nima sababdan o'zgarayotganini yozing");
    }
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException("Summa noldan farqli bo'lishi kerak");
    }
    // So'm — butun son (daftar va boshqa barcha oqimlar ham butun so'mda).
    if (!Number.isInteger(amount) || Math.abs(amount) > MANUAL_ADJUSTMENT_MAX) {
      throw new BadRequestException(
        `Summa butun son va ${formatSom(MANUAL_ADJUSTMENT_MAX)} so'mdan oshmasligi kerak`,
      );
    }
    if (actorRole !== UserRole.ADMIN) {
      const limit = await this.managerLimit();
      if (Math.abs(amount) > limit) {
        throw codedForbidden(
          ERROR_CODES.manualAdjustmentLimit,
          `Menejer bir martada ko'pi bilan ${formatSom(limit)} so'm tuzatishi mumkin. Kattaroq summa uchun adminga murojaat qiling.`,
          { details: { limit } },
        );
      }
    }

    const driver = await this.driversService.findByIdOrThrow(driverId);

    const result = await this.dataSource.transaction((manager: EntityManager) =>
      this.applyWithin(manager, {
        actorUserId,
        driverId: driver.id,
        driverUserId: driver.userId,
        amount,
        note,
        action: AUDIT_ACTIONS.walletManualAdjustment,
        ledgerPrefix: MANUAL_ADJUSTMENT_LEDGER_PREFIX,
      }),
    );
    await this.finalize(result, { amount, note, reason: 'manual_adjustment' });

    this.logger.log(
      `Manual wallet adjustment ${amount} for driver ${driver.id} by ${actorUserId} (audit ${result.auditId})`,
    );

    const updated = await this.driversService.findByIdOrThrow(driverId);
    return { ...updated, walletBalance: result.newBalance };
  }

  /**
   * Hamyon harakati chaqiruvchining tranzaksiyasi ICHIDA: qulf → jurnal →
   * daftar qatori → `drivers.balance` sinxroni. Hodisa natijalari
   * (kompensatsiya/jarima, INCIDENT-POLICY §3) ham shu yo'ldan — boshqa
   * natijalar bilan BITTA tranzaksiyada. Commit'dan keyin {@link finalize}.
   *
   * ⚠️ Summa va chegara tekshiruvi chaqiruvchida (bu yerda faqat yozuv).
   */
  async applyWithin(manager: EntityManager, input: WalletMovementInput): Promise<WalletMovementResult> {
    await lockWalletForUpdate(manager, input.driverUserId);
    const audit = await this.auditLog.record(
      {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: 'driver',
        targetId: input.driverId,
        amount: input.amount,
        note: input.note,
        metadata: { driverUserId: input.driverUserId, ...(input.metadata ?? {}) },
      },
      manager,
    );
    await manager.getRepository(Transaction).save({
      userId: input.driverUserId,
      orderId: null,
      amount: Math.abs(input.amount),
      type: input.amount > 0 ? TransactionType.CREDIT : TransactionType.DEBIT,
      paymentMethod: PaymentMethod.CASH,
      status: TransactionStatus.COMPLETED,
      externalId: `${input.ledgerPrefix}${audit.id}`,
    });
    const synced = await this.driversService.adjustBalanceWithin(manager, input.driverUserId, input.amount);
    return { auditId: audit.id, driverUserId: input.driverUserId, ...synced };
  }

  /** Commit'dan keyin: manfiyga tushgan bo'lsa oflayn (Redis) + push + `wallet:updated`. */
  async finalize(
    result: WalletMovementResult,
    push: { amount: number; note: string; reason: WalletChangeReason },
  ): Promise<void> {
    if (result.wentOffline) {
      await this.driversService.takeOfflineInRedis(
        result.driverId,
        `balance went negative after ${push.reason} (${result.newBalance})`,
      );
    }
    const { amount, note } = push;
    const sum = formatSom(Math.abs(amount));
    await this.notifier.balanceChanged(result.driverUserId, {
      delta: amount,
      reason: push.reason,
      push: {
        // `note` — operator yozgan izoh, tarjima qilinmaydi.
        text:
          amount > 0
            ? localized({
                uz: { title: "Hamyon to'ldirildi", body: `Hamyoningizga ${sum} so'm qo'shildi: ${note}` },
                ru: { title: 'Кошелёк пополнен', body: `На кошелёк зачислено ${sum} сум: ${note}` },
              })
            : localized({
                uz: { title: 'Hamyon tuzatildi', body: `Hamyoningizdan ${sum} so'm yechildi (tuzatish): ${note}` },
                ru: { title: 'Корректировка кошелька', body: `С кошелька списано ${sum} сум (корректировка): ${note}` },
              }),
        event: `wallet_${push.reason}`,
      },
      extra: { auditLogId: result.auditId },
    });
  }

  /** Bir martalik pul amali chegarasi: admin — mutlaq, menejer — `manualAdjustmentManagerLimit`. */
  async amountLimitFor(isAdmin: boolean): Promise<number> {
    if (isAdmin) return MANUAL_ADJUSTMENT_MAX;
    return Math.min(await this.managerLimit(), MANUAL_ADJUSTMENT_MAX);
  }

  private async managerLimit(): Promise<number> {
    if (!this.settingsService) return DEFAULT_MANUAL_ADJUSTMENT_MANAGER_LIMIT;
    return (await this.settingsService.getWalletTopupSettings()).manualAdjustmentManagerLimit;
  }
}
