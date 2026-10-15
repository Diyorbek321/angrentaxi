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
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { formatSom } from '../delivery/vendor-wallet-settlement';
import { DriversService } from './drivers.service';
import { WalletNotifierService } from './wallet-notifier.service';
import { UserRole } from '../../database/entities/user.entity';
import { SettingsService, DEFAULT_MANUAL_ADJUSTMENT_MANAGER_LIMIT } from '../settings/settings.service';
import { ERROR_CODES, codedForbidden } from '../../common/errors/coded-error';

/** Bitta qo'lda tuzatishning mutlaq chegarasi (admin uchun ham), so'm. */
export const MANUAL_ADJUSTMENT_MAX = 5_000_000;

/** Qo'lda tuzatish daftar qatori: `manual_adjustment_<auditLogId>`. */
export const MANUAL_ADJUSTMENT_LEDGER_PREFIX = 'manual_adjustment_';

export type DriverWithWallet = Driver & { walletBalance: number };

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

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      await lockWalletForUpdate(manager, driver.userId);
      const audit = await this.auditLog.record(
        {
          actorUserId,
          action: AUDIT_ACTIONS.walletManualAdjustment,
          targetType: 'driver',
          targetId: driver.id,
          amount,
          note,
          metadata: { driverUserId: driver.userId },
        },
        manager,
      );
      await manager.getRepository(Transaction).save({
        userId: driver.userId,
        orderId: null,
        amount: Math.abs(amount),
        type: amount > 0 ? TransactionType.CREDIT : TransactionType.DEBIT,
        paymentMethod: PaymentMethod.CASH,
        status: TransactionStatus.COMPLETED,
        externalId: `${MANUAL_ADJUSTMENT_LEDGER_PREFIX}${audit.id}`,
      });
      const synced = await this.driversService.adjustBalanceWithin(manager, driver.userId, amount);
      return { auditId: audit.id, ...synced };
    });

    if (result.wentOffline) {
      await this.driversService.takeOfflineInRedis(
        result.driverId,
        `balance went negative after manual adjustment (${result.newBalance})`,
      );
    }

    const sum = formatSom(Math.abs(amount));
    await this.notifier.balanceChanged(driver.userId, {
      delta: amount,
      reason: 'manual_adjustment',
      push:
        amount > 0
          ? {
              title: "Hamyon to'ldirildi",
              body: `Hamyoningizga ${sum} so'm qo'shildi: ${note}`,
              event: 'wallet_manual_adjustment',
            }
          : {
              title: 'Hamyon tuzatildi',
              body: `Hamyoningizdan ${sum} so'm yechildi (tuzatish): ${note}`,
              event: 'wallet_manual_adjustment',
            },
      extra: { auditLogId: result.auditId },
    });

    this.logger.log(
      `Manual wallet adjustment ${amount} for driver ${driver.id} by ${actorUserId} (audit ${result.auditId})`,
    );

    const updated = await this.driversService.findByIdOrThrow(driverId);
    return { ...updated, walletBalance: result.newBalance };
  }

  private async managerLimit(): Promise<number> {
    if (!this.settingsService) return DEFAULT_MANUAL_ADJUSTMENT_MANAGER_LIMIT;
    return (await this.settingsService.getWalletTopupSettings()).manualAdjustmentManagerLimit;
  }
}
