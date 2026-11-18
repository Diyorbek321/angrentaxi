import { BadRequestException, ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ERROR_CODES, codedForbidden } from '../../common/errors/coded-error';
import { PaymentMethod } from '../../database/entities/order.entity';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { UserRole } from '../../database/entities/user.entity';
import { AUDIT_ACTIONS, AuditAction, AuditLogService } from '../audit/audit-log.service';
import { formatSom } from '../delivery/vendor-wallet-settlement';
import { DriversService } from '../drivers/drivers.service';
import { WalletNotifierService } from '../drivers/wallet-notifier.service';
import { localized } from '../notifications/push-text';
import { SettingsService } from '../settings/settings.service';
import { WalletDebtCloseMode } from './dto/close-wallet-debt.dto';
import { MoneyContext } from './money-context';
import { OrderPayoutRelease, releaseOrderPayoutWithin } from './order-payout-release';
import {
  computeBonusBalance,
  computeSpendableBalance,
  lockWalletForUpdate,
  syncDriverBalanceColumn,
} from './wallet-balance.util';
import { listOpenWalletDebts, OpenWalletDebt, orderHasOpenDebt, WalletDebtItem } from './wallet-debt';
import { somToTiyin } from './tiyin';

/** Naqd olinganda hamyonga kirim: qarz DEBIT'i COMPLETED bo'lgach yo'lovchi qoldig'i o'zgarmaydi. */
export const WALLET_DEBT_CASH_TAG = (debtId: string): string => `wallet_debt_cash_${debtId}`;

export type DebtSettlementSource = 'topup' | 'wallet';

export interface WalletDebtView {
  total: number;
  items: WalletDebtItem[];
  /** Hamyondagi haqiqiy (bonussiz) pul — sarflanadigan − bonus. */
  realBalance: number;
  /** Hamyondagi pul bilan hozir yopiladigan qarz bormi (`POST wallet/debt/settle`). */
  canSettleNow: boolean;
  /** Hammasini yopish uchun to'ldirish kerak bo'lgan summa. */
  topUpNeeded: number;
  /** Karta orqali to'ldirish mumkinmi (provayder va `walletTopupEnabled`). */
  topUpAvailable: boolean;
  /** Qarzda eng kam to'ldirish (`min(walletTopupMin, topUpNeeded)`). */
  minTopUp: number;
  supportPhone: string;
}

export interface DebtClosure {
  closed: WalletDebtItem[];
  total: number;
  releases: OrderPayoutRelease[];
}

const NO_CLOSURE: DebtClosure = { closed: [], total: 0, releases: [] };

const tiyin = (som: number): number => somToTiyin(Math.round(som * 100) / 100) ?? 0;

/**
 * Yo'lovchi hamyon qarzini yopishning YAGONA joyi (docs/INCIDENT-POLICY.md §7).
 *
 * Qarz — PENDING hamyon DEBIT'i (`outstanding-wallet-debt.ts`). Yopilganda
 * qator holati o'zgaradi va shu buyurtmaning haydovchi oyoqlari ochiladi —
 * bitta tranzaksiyada, yo'lovchi hamyoni qulfi ostida, avval yo'lovchi keyin
 * haydovchi (`chargeTaxiFee` bilan bir xil tartib). Har qator shartli
 * `pending →` o'tish bilan da'vo qilinadi, ya'ni takroriy yoki parallel
 * chaqiruv hech narsa yozmaydi.
 */
@Injectable()
export class WalletDebtService {
  private readonly logger = new Logger(WalletDebtService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly driversService: DriversService,
    private readonly auditLog: AuditLogService,
    private readonly settingsService: SettingsService,
    @Optional() private readonly notifier?: WalletNotifierService,
  ) {}

  async view(userId: string): Promise<WalletDebtView> {
    const items = await listOpenWalletDebts(this.dataSource.manager, userId);
    const realBalance = await this.realBalance(this.dataSource.manager, userId);
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const topUpNeeded = Math.max(0, total - realBalance);
    const [settings, general] = await Promise.all([
      this.settingsService.getWalletTopupSettings(),
      this.settingsService.getPublicSettings(),
    ]);
    return {
      total,
      items: items.map(({ driverUserId: _internal, ...item }) => item),
      realBalance,
      canSettleNow: items.some((item) => tiyin(item.amount) <= tiyin(realBalance)),
      topUpNeeded,
      topUpAvailable: settings.walletTopupEnabled && this.settingsService.cardPaymentsAvailable(),
      minTopUp: minTopUpFor(settings.walletTopupMin, topUpNeeded),
      supportPhone: general.supportPhone,
    };
  }

  /** To'ldirishning quyi chegarasi: qarz bo'lsa — shu qarzni yopadigan summa ham yetadi. */
  async minTopUpForUser(userId: string, walletTopupMin: number): Promise<number> {
    const items = await listOpenWalletDebts(this.dataSource.manager, userId);
    if (items.length === 0) return walletTopupMin;
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return minTopUpFor(walletTopupMin, total - (await this.realBalance(this.dataSource.manager, userId)));
  }

  /** Yo'lovchi o'zi: hamyonda pul bor (qaytarim, kompensatsiya), lekin qarz ochiq. */
  async settleOwn(userId: string): Promise<WalletDebtView> {
    const closure = await this.dataSource.transaction(async (manager) => {
      const result = await this.settleWithin(manager, userId, 'wallet', userId);
      await syncDriverBalanceColumn(manager, userId);
      return result;
    });
    await this.announce(userId, closure, 'settled');
    return this.view(userId);
  }

  /**
   * Haqiqiy pul qaysi qarzni qoplasa, shuni yopadi — eng eskisidan. Yetmagani
   * o'tkazib yuboriladi, keyingisi (kichigi) yopilishi mumkin.
   *
   * ⚠️ FAQAT HAQIQIY PUL: `sarflanadigan − bonus`. Bonus yechib olinmaydi, u
   * bilan qarz yopilsa haydovchiga yechiladigan pul bo'lib o'tardi.
   *
   * Chaqiruvchi tranzaksiyasida; `syncDriverBalanceColumn` va xabarlar —
   * chaqiruvchida ({@link announce}, commit'dan keyin).
   */
  async settleWithin(
    manager: EntityManager,
    userId: string,
    source: DebtSettlementSource,
    actorUserId: string | null,
    extra: Record<string, unknown> = {},
  ): Promise<DebtClosure> {
    await lockWalletForUpdate(manager, userId);
    const debts = await listOpenWalletDebts(manager, userId);
    if (debts.length === 0) return NO_CLOSURE;

    let available = tiyin(await this.realBalance(manager, userId));
    const closure: DebtClosure = { closed: [], total: 0, releases: [] };
    for (const debt of debts) {
      const cost = tiyin(debt.amount);
      if (cost > available) continue;
      if (!(await this.claim(manager, debt, TransactionStatus.COMPLETED))) continue;
      available -= cost;
      await this.record(manager, closure, debt, userId, {
        action: AUDIT_ACTIONS.walletDebtSettled,
        actorUserId,
        note: null,
        metadata: { source, ...extra },
      });
    }
    return closure;
  }

  /**
   * Menejer yo'li (Angren naqd shahar). Bitta tranzaksiyada, har qarz uchun
   * alohida audit:
   *
   *  · `cash_received` — pul haqiqatan olindi: CREDIT `wallet_debt_cash_<id>`
   *    (naqd) + DEBIT COMPLETED, yo'lovchi qoldig'i o'zgarmaydi.
   *  · `write_off` — DEBIT `refunded` (yig'ilmadi, qoldiqqa ta'siri yo'q).
   *
   * Ikkala holatda ham haydovchi oyoqlari ochiladi: `write_off` da zarar
   * platformada, haydovchi ishlagan pulini baribir oladi.
   */
  async close(
    actor: { id: string; role: UserRole },
    userId: string,
    input: { mode: WalletDebtCloseMode; reason: string; transactionIds?: string[] },
  ): Promise<{ closedCount: number; total: number; debt: WalletDebtView }> {
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('Sabab majburiy: qarz nima uchun yopilayotganini yozing');
    // Menejer ham yo'lovchi bo'la oladi (`PASSENGER_APP_ROLES`).
    if (actor.id === userId) {
      throw new ForbiddenException("O'z qarzingizni o'zingiz yopa olmaysiz. Boshqa xodimga murojaat qiling.");
    }

    const closure = await this.dataSource.transaction(async (manager) => {
      await lockWalletForUpdate(manager, userId);
      const open = await listOpenWalletDebts(manager, userId);
      const wanted = input.transactionIds ? new Set(input.transactionIds) : null;
      const selected = wanted ? open.filter((debt) => wanted.has(debt.id)) : open;
      await this.assertWithinLimit(actor.role, selected);

      const result: DebtClosure = { closed: [], total: 0, releases: [] };
      for (const debt of selected) {
        const status = input.mode === 'cash_received' ? TransactionStatus.COMPLETED : TransactionStatus.REFUNDED;
        if (!(await this.claim(manager, debt, status))) continue;
        if (input.mode === 'cash_received') {
          await manager.getRepository(Transaction).save({
            userId,
            orderId: null,
            amount: debt.amount,
            type: TransactionType.CREDIT,
            paymentMethod: PaymentMethod.CASH,
            status: TransactionStatus.COMPLETED,
            externalId: WALLET_DEBT_CASH_TAG(debt.id),
          });
        }
        await this.record(manager, result, debt, userId, {
          action:
            input.mode === 'cash_received' ? AUDIT_ACTIONS.walletDebtCashReceived : AUDIT_ACTIONS.walletDebtWrittenOff,
          actorUserId: actor.id,
          note: reason,
          metadata: {},
        });
      }
      await syncDriverBalanceColumn(manager, userId);
      return result;
    });

    await this.announce(userId, closure, input.mode === 'write_off' ? 'written_off' : 'settled');
    return { closedCount: closure.closed.length, total: closure.total, debt: await this.view(userId) };
  }

  /** Commit'dan keyin: yo'lovchi va haydovchilarga xabar, manfiyga tushgan haydovchi oflayn. */
  async announce(userId: string, closure: DebtClosure, kind: 'settled' | 'written_off'): Promise<void> {
    if (closure.closed.length === 0) return;
    const sum = formatSom(closure.total);
    const text =
      kind === 'written_off'
        ? localized({
            uz: { title: 'Qarzingiz yopildi', body: `${sum} so'm qarzingiz kechirildi` },
            ru: { title: 'Долг закрыт', body: `Ваш долг ${sum} сум списан` },
          })
        : localized({
            uz: { title: 'Qarzingiz yopildi', body: `${sum} so'm qarzingiz to'landi. Endi buyurtma berishingiz mumkin` },
            ru: { title: 'Долг закрыт', body: `Долг ${sum} сум оплачен. Теперь можно оформлять заказы` },
          });
    await this.notifier?.balanceChanged(userId, {
      delta: kind === 'written_off' ? 0 : -closure.total,
      reason: 'debt_closed',
      push: { text, event: 'wallet_debt_closed' },
    });

    for (const release of closure.releases) {
      if (release.wentOffline) {
        await this.driversService.takeOfflineInRedis(release.driverId, 'balance went negative after payout release');
      }
      if (release.netPayout <= 0) continue;
      const net = formatSom(release.netPayout);
      await this.notifier?.balanceChanged(release.driverUserId, {
        delta: release.netPayout,
        reason: 'debt_payout_released',
        push: {
          text: localized({
            uz: { title: "Kutilayotgan to'lov tushdi", body: `Yo'lovchi qarzi yopildi — hamyoningizga ${net} so'm tushdi` },
            ru: { title: 'Ожидаемая выплата поступила', body: `Долг пассажира закрыт — на кошелёк поступило ${net} сум` },
          }),
          event: 'wallet_debt_payout_released',
        },
      });
    }
  }

  /** `markPaid` commit'idan keyingi xabarni `MoneyContext` ga qo'yadi yoki darhol yuboradi. */
  async afterCommit(ctx: MoneyContext | undefined, userId: string, closure: DebtClosure): Promise<void> {
    const effect = (): Promise<void> => this.announce(userId, closure, 'settled');
    if (ctx) ctx.afterCommit.push(effect);
    else await effect();
  }

  private async realBalance(manager: EntityManager, userId: string): Promise<number> {
    const spendable = await computeSpendableBalance(manager.getRepository(Transaction), userId);
    return Math.max(0, spendable - (await computeBonusBalance(manager, userId)));
  }

  private async assertWithinLimit(role: UserRole, debts: readonly OpenWalletDebt[]): Promise<void> {
    if (role === UserRole.ADMIN) return;
    const { manualAdjustmentManagerLimit: limit } = await this.settingsService.getWalletTopupSettings();
    const total = debts.reduce((sum, debt) => sum + debt.amount, 0);
    if (total > limit) {
      throw codedForbidden(
        ERROR_CODES.manualAdjustmentLimit,
        `Menejer bir martada ko'pi bilan ${formatSom(limit)} so'm qarz yopishi mumkin. Kattaroq summa uchun adminga murojaat qiling.`,
        { details: { limit } },
      );
    }
  }

  /** Shartli o'tish: yutqazgan (parallel/takroriy) chaqiruv `false` oladi. */
  private async claim(
    manager: EntityManager,
    debt: OpenWalletDebt,
    status: TransactionStatus.COMPLETED | TransactionStatus.REFUNDED,
  ): Promise<boolean> {
    const result = await manager
      .getRepository(Transaction)
      .update({ id: debt.id, status: TransactionStatus.PENDING }, { status });
    return Boolean(result.affected);
  }

  private async record(
    manager: EntityManager,
    closure: DebtClosure,
    debt: OpenWalletDebt,
    userId: string,
    entry: { action: AuditAction; actorUserId: string | null; note: string | null; metadata: Record<string, unknown> },
  ): Promise<void> {
    const release = await this.releaseDriverLegs(manager, debt, userId);
    await this.auditLog.record(
      {
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: 'user',
        targetId: userId,
        amount: debt.amount,
        note: entry.note,
        metadata: {
          ...entry.metadata,
          debtId: debt.id,
          orderId: debt.orderId,
          reason: debt.reason,
          driverUserId: release?.driverUserId ?? null,
          driverPayout: release?.netPayout ?? 0,
        },
      },
      manager,
    );
    const { driverUserId: _internal, ...item } = debt;
    closure.closed.push(item);
    closure.total += debt.amount;
    if (release) closure.releases.push(release);
    this.logger.log(`Wallet debt ${debt.id} (${debt.amount}) closed via ${entry.action} for ${userId}`);
  }

  private async releaseDriverLegs(
    manager: EntityManager,
    debt: OpenWalletDebt,
    userId: string,
  ): Promise<OrderPayoutRelease | null> {
    if (!debt.orderId || !debt.driverUserId) return null;
    if (await orderHasOpenDebt(manager, userId, debt.orderId)) return null;
    return releaseOrderPayoutWithin(
      manager,
      (within, driverUserId, delta) => this.driversService.adjustBalanceWithin(within, driverUserId, delta),
      debt.orderId,
      debt.driverUserId,
    );
  }
}

/** Qarz bo'lmasa — sozlama; bo'lsa, qarzni yopadigan summa ham yetadi. */
function minTopUpFor(walletTopupMin: number, needed: number): number {
  return needed > 0 ? Math.min(walletTopupMin, Math.ceil(needed)) : walletTopupMin;
}
