import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Between, DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import {
  DriverShiftPass,
  DriverShiftPassStatus,
} from '../../database/entities/driver-shift-pass.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { SettingsService } from '../settings/settings.service';
import { DriversService } from '../drivers/drivers.service';
import { FiscalReceiptsService } from '../fiscal/fiscal-receipts.service';
import { computeSpendableBalance, lockWalletForUpdate } from '../payments/wallet-balance.util';
import {
  ShiftPassComparison,
  ShiftPassLike,
  assertCanBuyShiftPass,
  compareShiftPassWithCommission,
  effectiveShiftPassStatus,
  shiftPassCovers,
  shiftPassProRataRefund,
  shiftPassWindow,
} from './shift-pass-policy';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { WalletNotifierService } from '../drivers/wallet-notifier.service';
import { formatSom } from '../delivery/vendor-wallet-settlement';
import { localized } from '../notifications/push-text';

/** Hamyon daftaridagi smena qatori belgisi: `shift_pass_<passId>`. */
export const SHIFT_PASS_LEDGER_PREFIX = 'shift_pass_';
/** Bekor qilingan smena qaytarimi: `shift_pass_refund_<passId>` (unikal indeks). */
export const SHIFT_PASS_REFUND_LEDGER_PREFIX = 'shift_pass_refund_';

const COMPARISON_PERIOD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ShiftPassView {
  id: string;
  driverId: string;
  startsAt: string;
  endsAt: string;
  price: number;
  status: DriverShiftPassStatus;
  serviceTypes: string[];
  transactionId: string | null;
  createdAt: string | null;
}

/** `POST /admin/shift-passes/:id/cancel` javobi. */
export interface ShiftPassCancelResult extends ShiftPassView {
  cancelledAt: string;
  cancelReason: string;
  /** Hamyonga qaytarilgan summa; `refund: false` bo'lsa `null`. */
  refundAmount: number | null;
}

export interface AdminShiftPassItem extends ShiftPassView {
  driverPhone: string | null;
  driverName: string | null;
}

export interface AdminShiftPassList {
  from: string;
  to: string;
  /** Oraliqdagi barcha smenalar soni (sahifalash uchun). */
  total: number;
  page: number;
  limit: number;
  totals: {
    /** Davrda boshlangan smenalar (bekor qilinganlar bilan). */
    count: number;
    /** Platforma daromadi, so'm — bekor qilinganlarsiz. */
    revenue: number;
    cancelled: number;
    /** Oraliqdagilardan hozir faol (bekor qilinmagan, `startsAt ≤ hozir < endsAt`). */
    activeNow: number;
  };
  items: AdminShiftPassItem[];
}

/** Standart va eng katta sahifa — avvalgi qat'iy chegara (eski mijozlar o'zgarishsiz). */
const ADMIN_LIST_LIMIT = 500;

export interface AdminShiftPassListOptions {
  page?: number;
  limit?: number;
  now?: Date;
}

export interface MyShiftPassInfo {
  enabled: boolean;
  price: number;
  durationHours: number;
  serviceTypes: string[];
  current: ShiftPassView | null;
  comparison: ShiftPassComparison;
}

/**
 * Haydovchi smenasi (kunlik obuna) — docs/LEGAL-COMPLIANCE.md §8.
 *
 * Sotib olish = hamyondan DEBIT (`shift_pass_<id>`, platforma daromadi) +
 * smena yozuvi, bitta DB tranzaksiyasida va haydovchi hamyoni qulfi ostida
 * (ikki parallel so'rov bir balansdan ikki smena ololmaydi va ustma-ust
 * tushmaydi). Fiskal yozuv commit'dan keyin, best-effort.
 */
@Injectable()
export class ShiftPassesService {
  private readonly logger = new Logger(ShiftPassesService.name);

  constructor(
    @InjectRepository(DriverShiftPass)
    private readonly passRepository: Repository<DriverShiftPass>,
    private readonly settingsService: SettingsService,
    private readonly driversService: DriversService,
    private readonly dataSource: DataSource,
    @Optional() private readonly fiscalReceipts?: FiscalReceiptsService,
    @Optional() private readonly auditLog?: AuditLogService,
    @Optional() private readonly notifier?: WalletNotifierService,
  ) {}

  /**
   * Admin smenani bekor qiladi (§15). Bitta tranzaksiyada, haydovchi hamyoni
   * qulfi ostida: holat → `cancelled` (shartli — ikki marta bekor qilinmaydi),
   * `refund` bo'lsa pro-rata CREDIT `shift_pass_refund_<id>` +
   * `drivers.balance` sinxroni, va jurnal yozuvi. Bekor qilingan smena
   * keyingi safarlarni qamramaydi (`shiftPassCovers`).
   */
  async cancel(
    actorUserId: string,
    passId: string,
    input: { refund: boolean; reason: string },
  ): Promise<ShiftPassCancelResult> {
    const reason = input.reason.trim();
    const now = new Date();

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const passRepo = manager.getRepository(DriverShiftPass);
      const pass = await passRepo.findOne({ where: { id: passId } });
      if (!pass) throw new NotFoundException('Smena topilmadi');
      if (pass.status === DriverShiftPassStatus.CANCELLED) {
        throw new ConflictException('Smena allaqachon bekor qilingan');
      }
      await lockWalletForUpdate(manager, pass.driverId);

      const refundAmount = input.refund ? shiftPassProRataRefund(asPolicyWithPrice(pass), now) : null;
      const claimed = await passRepo.update(
        { id: pass.id, status: pass.status },
        { status: DriverShiftPassStatus.CANCELLED, cancelledAt: now, cancelReason: reason, refundAmount },
      );
      if (!claimed.affected) throw new ConflictException('Smena allaqachon bekor qilingan');

      if (refundAmount && refundAmount > 0) {
        await manager.getRepository(Transaction).save({
          userId: pass.driverId,
          orderId: null,
          amount: refundAmount,
          type: TransactionType.CREDIT,
          paymentMethod: PaymentMethod.WALLET,
          status: TransactionStatus.COMPLETED,
          externalId: `${SHIFT_PASS_REFUND_LEDGER_PREFIX}${pass.id}`,
        });
        await this.driversService.adjustBalanceWithin(manager, pass.driverId, refundAmount);
      }

      await this.auditLog?.record(
        {
          actorUserId,
          action: AUDIT_ACTIONS.shiftPassCancel,
          targetType: 'shift_pass',
          targetId: pass.id,
          amount: refundAmount ?? 0,
          note: reason,
          metadata: { driverUserId: pass.driverId, price: Number(pass.price), refundRequested: input.refund },
        },
        manager,
      );
      return { pass: { ...pass, status: DriverShiftPassStatus.CANCELLED }, refundAmount };
    });

    if (result.refundAmount && result.refundAmount > 0) {
      await this.recordFiscalRefund(result.pass, result.refundAmount);
      await this.notifier?.balanceChanged(result.pass.driverId, {
        delta: result.refundAmount,
        reason: 'shift_pass_refund',
        push: {
          text: localized({
            uz: {
              title: 'Smena bekor qilindi',
              body: `Smenangiz bekor qilindi: hamyoningizga ${formatSom(result.refundAmount)} so'm qaytarildi`,
            },
            ru: {
              title: 'Смена отменена',
              body: `Ваша смена отменена: на кошелёк возвращено ${formatSom(result.refundAmount)} сум`,
            },
          }),
          event: 'shift_pass_cancelled',
        },
        extra: { shiftPassId: result.pass.id },
      });
    }
    this.logger.log(
      `Shift pass ${passId} cancelled by ${actorUserId}; refund=${result.refundAmount ?? 'none'}`,
    );
    return {
      ...toView(result.pass, now),
      cancelledAt: now.toISOString(),
      cancelReason: reason,
      refundAmount: result.refundAmount,
    };
  }

  async buy(driverUserId: string): Promise<ShiftPassView> {
    const settings = await this.settingsService.getShiftPassSettings();
    const now = new Date();
    let offlineDriverId: string | null = null;

    const pass = await this.dataSource.transaction(async (manager: EntityManager) => {
      await lockWalletForUpdate(manager, driverUserId);
      const passRepo = manager.getRepository(DriverShiftPass);
      const transactionRepo = manager.getRepository(Transaction);

      const active = await this.activePasses(passRepo, driverUserId, now);
      const balance = await computeSpendableBalance(transactionRepo, driverUserId);
      assertCanBuyShiftPass({
        enabled: settings.shiftPassEnabled,
        price: settings.shiftPassPrice,
        balance,
        hasActivePass: active.length > 0,
      });

      const id = randomUUID();
      const debit = await transactionRepo.save({
        userId: driverUserId,
        orderId: null,
        amount: settings.shiftPassPrice,
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.WALLET,
        status: TransactionStatus.COMPLETED,
        externalId: `${SHIFT_PASS_LEDGER_PREFIX}${id}`,
      });

      const saved = await passRepo.save({
        id,
        driverId: driverUserId,
        ...shiftPassWindow(now, settings.shiftPassDurationHours),
        price: settings.shiftPassPrice,
        status: DriverShiftPassStatus.ACTIVE,
        serviceTypes: [...settings.shiftPassServiceTypes],
        transactionId: debit.id,
      } as DriverShiftPass);

      // `drivers.balance` komissiya kabi kamayadi (platformaga to'lov).
      const adjustment = await this.driversService.adjustBalanceWithin(
        manager,
        driverUserId,
        -settings.shiftPassPrice,
      );
      if (adjustment.wentOffline) offlineDriverId = adjustment.driverId;
      return saved;
    });

    if (offlineDriverId) {
      await this.driversService.takeOfflineInRedis(offlineDriverId, 'balance went negative after shift pass purchase');
    }
    await this.recordFiscal(pass);
    this.logger.log(`Driver ${driverUserId} bought shift pass ${pass.id} (${pass.price} so'm)`);
    return toView(pass);
  }

  /** Komissiya siyosati uchun: shu payt va xizmat turini qamragan smena bormi. */
  async hasActivePassFor(driverUserId: string, serviceType: string, at: Date): Promise<boolean> {
    const candidates = await this.passRepository.find({
      where: { driverId: driverUserId, status: DriverShiftPassStatus.ACTIVE },
      order: { endsAt: 'DESC' },
      take: 5,
    });
    return candidates.some((pass) => shiftPassCovers(asPolicy(pass), serviceType, at));
  }

  /** Daromad ekrani: `from` dan keyin BOSHLANGAN, bekor qilinmagan smenalar narxi. */
  async totalCostSince(driverUserId: string, from: Date): Promise<number> {
    const rows = (await this.passRepository.query(
      `SELECT COALESCE(SUM(price), 0) AS total
         FROM driver_shift_passes
        WHERE driver_id = $1 AND starts_at >= $2 AND status <> 'cancelled'`,
      [driverUserId, from],
    )) as Array<{ total: string }>;
    return parseFloat(rows[0]?.total ?? '0') || 0;
  }

  async getMine(driverUserId: string): Promise<MyShiftPassInfo> {
    const settings = await this.settingsService.getShiftPassSettings();
    const now = new Date();
    await this.expireStale(driverUserId, now);
    const [current] = await this.activePasses(this.passRepository, driverUserId, now);
    const comparison = await this.comparison(driverUserId, settings.shiftPassPrice, settings.shiftPassServiceTypes, now);
    return {
      enabled: settings.shiftPassEnabled,
      price: settings.shiftPassPrice,
      durationHours: settings.shiftPassDurationHours,
      serviceTypes: settings.shiftPassServiceTypes,
      current: current ? toView(current) : null,
      comparison,
    };
  }

  /** Admin: `[from, to]` oralig'ida BOSHLANGAN smenalar + jami (eng ko'pi 500 qator). */
  async listForAdmin(
    from: Date,
    to: Date,
    options: AdminShiftPassListOptions = {},
  ): Promise<AdminShiftPassList> {
    const now = options.now ?? new Date();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(ADMIN_LIST_LIMIT, Math.max(1, options.limit ?? ADMIN_LIST_LIMIT));
    const [[rows, total], totalsRows] = await Promise.all([
      this.passRepository.findAndCount({
        where: { startsAt: Between(from, to) },
        relations: ['driver'],
        order: { startsAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.passRepository.query(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(price) FILTER (WHERE status <> 'cancelled'), 0) AS revenue,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                COUNT(*) FILTER (WHERE status <> 'cancelled' AND starts_at <= $3 AND ends_at > $3) AS active_now
           FROM driver_shift_passes
          WHERE starts_at BETWEEN $1 AND $2`,
        [from, to, now],
      ) as Promise<Array<{ count: string; revenue: string; cancelled: string; active_now?: string }>>,
    ]);
    const items = rows.map((pass) => ({
      ...toView(pass, now),
      driverPhone: pass.driver?.phone ?? null,
      driverName: [pass.driver?.firstName, pass.driver?.lastName].filter(Boolean).join(' ') || null,
    }));
    const totals = totalsRows[0];
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      total,
      page,
      limit,
      totals: {
        count: parseInt(totals?.count ?? '0', 10) || 0,
        revenue: parseFloat(totals?.revenue ?? '0') || 0,
        cancelled: parseInt(totals?.cancelled ?? '0', 10) || 0,
        activeNow: parseInt(totals?.active_now ?? '0', 10) || 0,
      },
      items,
    };
  }

  // ------------------------------------------------------------- ichki

  private async activePasses(
    repo: Repository<DriverShiftPass>,
    driverUserId: string,
    now: Date,
  ): Promise<DriverShiftPass[]> {
    const rows = await repo.find({
      where: { driverId: driverUserId, status: DriverShiftPassStatus.ACTIVE },
      order: { endsAt: 'DESC' },
      take: 5,
    });
    return rows.filter((pass) => effectiveShiftPassStatus(asPolicy(pass), now) === 'active');
  }

  /** Bazadagi `active` → `expired` (faqat ko'rinish uchun; qamrov sanadan hisoblanadi). */
  private async expireStale(driverUserId: string, now: Date): Promise<void> {
    try {
      await this.passRepository.update(
        { driverId: driverUserId, status: DriverShiftPassStatus.ACTIVE, endsAt: LessThan(now) },
        { status: DriverShiftPassStatus.EXPIRED },
      );
    } catch (err) {
      this.logger.warn(`Shift pass expiry update failed for ${driverUserId}: ${(err as Error).message}`);
    }
  }

  /**
   * Oxirgi 7 kun: smena qamraydigan xizmatlarda to'langan komissiya va ish
   * kunlari (Toshkent sanasi bo'yicha, `completed_at` UTC'da saqlangan deb).
   */
  private async comparison(
    driverUserId: string,
    passPrice: number,
    serviceTypes: string[],
    now: Date,
  ): Promise<ShiftPassComparison> {
    const from = new Date(now.getTime() - COMPARISON_PERIOD_DAYS * DAY_MS);
    const rows = (await this.passRepository.query(
      `SELECT
         (SELECT COALESCE(SUM(t.amount), 0)
            FROM transactions t JOIN orders o ON o.id = t.order_id
           WHERE t.user_id = $1 AND t.external_id = 'commission'
             AND t.status IN ('completed', 'pending')
             AND t.created_at >= $2 AND o.service_type::text = ANY($3)) AS commission,
         (SELECT COUNT(DISTINCT ((o.completed_at + interval '5 hours')::date))
            FROM orders o
           WHERE o.driver_id = $1 AND o.status = 'completed'
             AND o.completed_at >= $2 AND o.service_type::text = ANY($3)) AS working_days`,
      [driverUserId, from, serviceTypes],
    )) as Array<{ commission: string; working_days: string }>;
    return compareShiftPassWithCommission({
      periodDays: COMPARISON_PERIOD_DAYS,
      commissionPaid: parseFloat(rows[0]?.commission ?? '0') || 0,
      workingDays: parseInt(rows[0]?.working_days ?? '0', 10) || 0,
      passPrice,
    });
  }

  /** Qaytarim — asl smena chekiga bog'langan fiskal qaytarish cheki (§20). Xato bekor qilishni buzmaydi. */
  private async recordFiscalRefund(pass: DriverShiftPass, refundAmount: number): Promise<void> {
    if (!this.fiscalReceipts) return;
    try {
      await this.fiscalReceipts.recordShiftPassRefund({
        passId: pass.id,
        driverUserId: pass.driverId,
        refundAmount,
      });
    } catch (err) {
      this.logger.error(`Fiskal qaytarish yozuvi (smena ${pass.id}) yaratilmadi: ${(err as Error).message}`);
    }
  }

  private async recordFiscal(pass: DriverShiftPass): Promise<void> {
    if (!this.fiscalReceipts) return;
    try {
      await this.fiscalReceipts.recordForShiftPass({
        passId: pass.id,
        driverUserId: pass.driverId,
        price: pass.price,
      });
    } catch (err) {
      this.logger.error(`Fiskal yozuv (smena ${pass.id}) yaratilmadi: ${(err as Error).message}`);
    }
  }
}

function asPolicyWithPrice(pass: DriverShiftPass): { startsAt: Date; endsAt: Date; price: number } {
  return { startsAt: new Date(pass.startsAt), endsAt: new Date(pass.endsAt), price: Number(pass.price) };
}

function asPolicy(pass: DriverShiftPass): ShiftPassLike {
  return {
    startsAt: new Date(pass.startsAt),
    endsAt: new Date(pass.endsAt),
    status: pass.status,
    serviceTypes: pass.serviceTypes ?? [],
  };
}

export function toView(pass: DriverShiftPass, now: Date = new Date()): ShiftPassView {
  return {
    id: pass.id,
    driverId: pass.driverId,
    startsAt: new Date(pass.startsAt).toISOString(),
    endsAt: new Date(pass.endsAt).toISOString(),
    price: Number(pass.price),
    status: effectiveShiftPassStatus(asPolicy(pass), now) as DriverShiftPassStatus,
    serviceTypes: pass.serviceTypes ?? [],
    transactionId: pass.transactionId ?? null,
    createdAt: pass.createdAt ? new Date(pass.createdAt).toISOString() : null,
  };
}
