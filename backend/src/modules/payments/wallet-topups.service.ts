import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, EntityManager, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import {
  WalletTopup,
  WalletTopupProvider,
  WalletTopupStatus,
} from '../../database/entities/wallet-topup.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { SettingsService } from '../settings/settings.service';
import { DriversService } from '../drivers/drivers.service';
import { WalletNotifierService } from '../drivers/wallet-notifier.service';
import { formatSom } from '../delivery/vendor-wallet-settlement';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';
import { lockWalletForUpdate, syncDriverBalanceColumn } from './wallet-balance.util';
import { ERROR_CODES, codedBadRequest, codedConflict } from '../../common/errors/coded-error';
import { MoneyContext } from './money-context';
import { sameSomAmount } from './tiyin';
import { ConfigService } from '@nestjs/config';
import { PaymentInitiateOptions } from './payment.interface';
import { localized } from '../notifications/push-text';

/**
 * Provayderga yuboriladigan merchant havolasi: `topup_<uuid>`. Buyurtma
 * to'lovlari yalang UUID bilan boradi — callback qaysi oqimga tegishli
 * ekanini shu prefiks aniq ajratadi.
 */
export const WALLET_TOPUP_REFERENCE_PREFIX = 'topup_';

export const WALLET_TOPUP_LEDGER = {
  credit: (topupId: string): string => `wallet_topup_${topupId}`,
  reversal: (topupId: string): string => `wallet_topup_reversal_${topupId}`,
} as const;

/** To'lanmagan to'ldirish shu vaqtdan keyin `expired` (Payme talabi — 12 soat). */
export const WALLET_TOPUP_TTL_MS = 12 * 60 * 60 * 1000;

export const WALLET_TOPUP_PROVIDERS: readonly WalletTopupProvider[] = ['payme', 'click', 'uzcard'];

/**
 * Bir foydalanuvchida bir vaqtda ochiq (`pending`, muddati o'tmagan)
 * to'ldirishlar soni (security review #13). Bir xil summa+provayder — mavjudi
 * qayta beriladi.
 */
export const WALLET_TOPUP_MAX_PENDING = 3;

/** `bindToProvider` natijasi (security review #1). */
export type TopupBindOutcome = 'bound' | 'wrong_provider' | 'busy' | 'not_payable' | 'not_found';

export interface WalletTopupView {
  id: string;
  amount: number;
  provider: WalletTopupProvider;
  status: WalletTopupStatus;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  /** Shu paytgacha to'lanmasa `expired` bo'ladi. */
  expiresAt: string;
}

export interface WalletTopupCheckout extends WalletTopupView {
  topupId: string;
  checkoutUrl: string;
}

export type TopupOutcomeKind =
  | 'paid'
  | 'already_paid'
  | 'cancelled'
  | 'already_cancelled'
  | 'not_found'
  | 'amount_mismatch'
  | 'invalid_state';

export interface TopupOutcome {
  kind: TopupOutcomeKind;
  topup: WalletTopup | null;
  /** `cancelled` uchun: to'langandan keyin bekor qilindimi (daftarda teskari DEBIT). */
  reversed?: boolean;
}

/**
 * Haydovchi/kuryer hamyonini to'lov tizimi orqali to'ldirish —
 * docs/LEGAL-COMPLIANCE.md §11.
 *
 * Pul daftarga FAQAT `markPaid` da tushadi: bitta DB tranzaksiyasida, hamyon
 * qulfi ostida, `pending → paid` shartli o'tish + CREDIT
 * `wallet_topup_<id>` (unikal indeks) + `drivers.balance` sinxroni. Takroriy
 * callback hech narsa yozmaydi. To'langandan keyin bekor qilish — teskari
 * DEBIT `wallet_topup_reversal_<id>`.
 *
 * Provayder protokollari (Payme JSON-RPC, Click prepare/complete, UZPS)
 * `wallet-topup-callbacks.service.ts` da — bu sinf faqat pul qoidalari.
 */
@Injectable()
export class WalletTopupsService {
  private readonly logger = new Logger(WalletTopupsService.name);

  constructor(
    @InjectRepository(WalletTopup)
    private readonly topupRepository: Repository<WalletTopup>,
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
    private readonly paymeProvider: PaymeProvider,
    private readonly clickProvider: ClickProvider,
    private readonly uzcardProvider: UzcardProvider,
    private readonly driversService: DriversService,
    @Optional() private readonly notifier?: WalletNotifierService,
    // `WALLET_TOPUP_RETURN_URL` — to'lovdan keyin ilovaga qaytish (§21).
    @Optional() private readonly config?: ConfigService,
  ) {}

  static reference(topupId: string): string {
    return `${WALLET_TOPUP_REFERENCE_PREFIX}${topupId}`;
  }

  static isReference(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith(WALLET_TOPUP_REFERENCE_PREFIX);
  }

  // ------------------------------------------------------------ haydovchi

  async create(
    userId: string,
    phone: string,
    input: { amount: number; provider: WalletTopupProvider },
  ): Promise<WalletTopupCheckout> {
    const settings = await this.settingsService.getWalletTopupSettings();
    if (!settings.walletTopupEnabled) {
      throw codedBadRequest(
        ERROR_CODES.walletTopupDisabled,
        "Hamyonni karta orqali to'ldirish hozircha yoqilmagan. Dispetcherga murojaat qiling.",
      );
    }
    const amount = Math.round(input.amount);
    if (amount < settings.walletTopupMin || amount > settings.walletTopupMax) {
      throw codedBadRequest(
        ERROR_CODES.walletTopupAmountOutOfRange,
        `Summa ${formatSom(settings.walletTopupMin)} so'mdan ${formatSom(settings.walletTopupMax)} so'mgacha bo'lishi kerak`,
        { details: { min: settings.walletTopupMin, max: settings.walletTopupMax } },
      );
    }
    if (!this.providerConfigured(input.provider)) {
      throw codedBadRequest(
        ERROR_CODES.walletTopupProviderUnavailable,
        "Bu to'lov tizimi hali ulanmagan. Boshqasini tanlang.",
      );
    }

    const topup = await this.openPendingTopup(userId, amount, input.provider);

    let checkoutUrl: string;
    try {
      const reference = WalletTopupsService.reference(topup.id);
      const result = await this.providerFor(input.provider).initiate(
        amount,
        reference,
        phone,
        this.returnUrlFor(topup.id),
      );
      checkoutUrl = result.url;
      // UZPS: provayder tranzaksiyasi shu yerda paydo bo'ladi — callback
      // aynan shu id bilan kelishi shart (security review #7).
      if (input.provider === 'uzcard' && result.id && !topup.externalId) {
        await this.attachExternalId(topup, result.id);
      }
    } catch (err) {
      await this.topupRepository.update(
        { id: topup.id, status: WalletTopupStatus.PENDING, externalId: IsNull() },
        { status: WalletTopupStatus.FAILED },
      );
      this.logger.error(`Top-up ${topup.id} initiate failed: ${(err as Error).message}`);
      throw codedBadRequest(
        ERROR_CODES.walletTopupProviderError,
        "To'lov tizimiga ulanib bo'lmadi. Birozdan keyin urinib ko'ring.",
      );
    }

    this.logger.log(`Wallet top-up ${topup.id} created: ${amount} so'm via ${input.provider} for ${userId}`);
    return { topupId: topup.id, checkoutUrl, ...toView(topup) };
  }

  async getForUser(userId: string, topupId: string): Promise<WalletTopupView> {
    const topup = await this.topupRepository.findOne({ where: { id: topupId } });
    if (!topup || topup.userId !== userId) {
      throw new NotFoundException("To'ldirish topilmadi");
    }
    return toView(topup);
  }

  async listForUser(userId: string, limit = 20): Promise<WalletTopupView[]> {
    const rows = await this.topupRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map(toView);
  }

  // ------------------------------------------------------------ callback'lar

  async findByReference(reference: unknown): Promise<WalletTopup | null> {
    if (!WalletTopupsService.isReference(reference)) return null;
    const id = reference.slice(WALLET_TOPUP_REFERENCE_PREFIX.length);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return this.topupRepository.findOne({ where: { id } });
  }

  async findByExternalId(externalId: unknown): Promise<WalletTopup | null> {
    if (typeof externalId !== 'string' || !externalId) return null;
    return this.topupRepository.findOne({ where: { externalId } });
  }

  /**
   * Provayder tranzaksiyasini bog'laydi (Payme CreateTransaction, Click
   * prepare). Boshqa provayder tranzaksiyasi allaqachon bog'langan bo'lsa —
   * `false` (bitta to'ldirishni ikki marta to'lab bo'lmaydi).
   */
  async attachExternalId(topup: WalletTopup, externalId: string, manager?: EntityManager): Promise<boolean> {
    if (topup.externalId) return topup.externalId === externalId;
    const repo = manager ? manager.getRepository(WalletTopup) : this.topupRepository;
    const result = await repo.update(
      { id: topup.id, status: WalletTopupStatus.PENDING, externalId: IsNull() },
      { externalId },
    );
    if (result.affected) {
      topup.externalId = externalId;
      return true;
    }
    const fresh = await repo.findOne({ where: { id: topup.id } });
    return fresh?.externalId === externalId;
  }

  /**
   * Merchant protokoli tranzaksiyasini to'ldirishga bog'laydi (Payme
   * `CreateTransaction`, Click Prepare) — security review #1:
   *  · to'ldirish faqat O'Z provayderi orqali to'lanadi (`wrong_provider`);
   *  · birinchi faol tranzaksiya bog'lanadi, boshqasi — `busy`.
   * `externalId` — daftar/markPaid bilan bir xil shakl (`payme_<id>`, `click_<id>`).
   */
  async bindToProvider(
    topupId: string,
    provider: WalletTopupProvider,
    externalId: string,
  ): Promise<TopupBindOutcome> {
    const topup = await this.topupRepository.findOne({ where: { id: topupId } });
    if (!topup) return 'not_found';
    if (topup.provider !== provider) return 'wrong_provider';
    if (topup.status !== WalletTopupStatus.PENDING) return 'not_payable';
    return (await this.attachExternalId(topup, externalId)) ? 'bound' : 'busy';
  }

  /** Callback summasi (so'mda) yozilgan summaga BUTUN TIYINDA tengmi (#10). */
  static amountMatches(topup: WalletTopup, amount: number): boolean {
    return sameSomAmount(amount, Number(topup.amount));
  }

  /**
   * To'lov tasdiqlandi — hamyonga kirim. Bir martalik: faqat `pending` dan
   * o'tadi; `paid` ga qayta kelgan callback `already_paid` (provayderga
   * muvaffaqiyat qaytariladi, daftar o'zgarmaydi).
   */
  async markPaid(
    topupId: string,
    input: { amount?: number; externalId?: string | null; provider?: WalletTopupProvider },
    ctx?: MoneyContext,
  ): Promise<TopupOutcome> {
    const outcome = await this.inTransaction(ctx, async (manager: EntityManager) => {
      const topup = await this.lockTopup(manager, topupId);
      if (!topup) return { kind: 'not_found', topup: null } as TopupOutcome;
      // Boshqa provayderdan kelgan to'lov — bu to'ldirishniki emas (#1).
      if (input.provider && topup.provider !== input.provider) {
        return { kind: 'invalid_state', topup } as TopupOutcome;
      }
      if (input.amount !== undefined && !WalletTopupsService.amountMatches(topup, input.amount)) {
        return { kind: 'amount_mismatch', topup } as TopupOutcome;
      }
      // Bog'langan tranzaksiyadan boshqasi — to'langan bo'lsa ham rad (#1):
      // aks holda ikkinchi provayder `already_paid` ni muvaffaqiyat deb olib,
      // kartadan ikkinchi marta yechardi.
      if (input.externalId && topup.externalId && topup.externalId !== input.externalId) {
        return { kind: 'invalid_state', topup } as TopupOutcome;
      }
      if (topup.status === WalletTopupStatus.PAID) {
        return (input.externalId ? topup.externalId === input.externalId : true)
          ? ({ kind: 'already_paid', topup } as TopupOutcome)
          : ({ kind: 'invalid_state', topup } as TopupOutcome);
      }
      if (topup.status !== WalletTopupStatus.PENDING) return { kind: 'invalid_state', topup } as TopupOutcome;

      const paidAt = new Date();
      await manager.update(
        WalletTopup,
        { id: topup.id, status: WalletTopupStatus.PENDING },
        { status: WalletTopupStatus.PAID, paidAt, externalId: topup.externalId ?? input.externalId ?? null },
      );
      await manager.getRepository(Transaction).save({
        userId: topup.userId,
        orderId: null,
        amount: Number(topup.amount),
        type: TransactionType.CREDIT,
        paymentMethod: PaymentMethod.CARD,
        status: TransactionStatus.COMPLETED,
        externalId: WALLET_TOPUP_LEDGER.credit(topup.id),
      });
      await syncDriverBalanceColumn(manager, topup.userId);
      return {
        kind: 'paid',
        topup: { ...topup, status: WalletTopupStatus.PAID, paidAt },
      } as TopupOutcome;
    });

    if (outcome.kind === 'paid' && outcome.topup) {
      const paid = outcome.topup;
      await this.afterCommit(ctx, () => this.notifyPaid(topupId, paid));
    }
    return outcome;
  }

  private async notifyPaid(topupId: string, topup: WalletTopup): Promise<void> {
    const amount = Number(topup.amount);
    this.logger.log(`Wallet top-up ${topupId} paid: ${amount} so'm credited to ${topup.userId}`);
    await this.notifier?.balanceChanged(topup.userId, {
      delta: amount,
      reason: 'topup',
      push: {
        text: localized({
          uz: { title: "Hamyon to'ldirildi", body: `Hamyoningiz ${formatSom(amount)} so'mga to'ldirildi` },
          ru: { title: 'Кошелёк пополнен', body: `Кошелёк пополнен на ${formatSom(amount)} сум` },
        }),
        event: 'wallet_topup_paid',
      },
      extra: { topupId },
    });
  }

  /**
   * Bekor qilish / muvaffaqiyatsiz to'lov. `pending` → `failedStatus`
   * (daftarga tegmaydi). `paid` → `cancelled` + teskari DEBIT (provayder
   * pulni qaytardi). Takroriy chaqiruv — `already_cancelled`.
   */
  async cancel(
    topupId: string,
    failedStatus: WalletTopupStatus.CANCELLED | WalletTopupStatus.FAILED = WalletTopupStatus.CANCELLED,
    ctx?: MoneyContext,
  ): Promise<TopupOutcome> {
    let wentOfflineDriverId: string | null = null;
    const outcome = await this.inTransaction(ctx, async (manager: EntityManager) => {
      const topup = await this.lockTopup(manager, topupId);
      if (!topup) return { kind: 'not_found', topup: null } as TopupOutcome;
      const cancelledAt = new Date();

      if (topup.status === WalletTopupStatus.PENDING) {
        await manager.update(
          WalletTopup,
          { id: topup.id, status: WalletTopupStatus.PENDING },
          { status: failedStatus, cancelledAt },
        );
        return {
          kind: 'cancelled',
          reversed: false,
          topup: { ...topup, status: failedStatus, cancelledAt },
        } as TopupOutcome;
      }
      if (topup.status !== WalletTopupStatus.PAID) {
        return { kind: 'already_cancelled', topup } as TopupOutcome;
      }

      await manager.update(
        WalletTopup,
        { id: topup.id, status: WalletTopupStatus.PAID },
        { status: WalletTopupStatus.CANCELLED, cancelledAt },
      );
      await manager.getRepository(Transaction).save({
        userId: topup.userId,
        orderId: null,
        amount: Number(topup.amount),
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.CARD,
        status: TransactionStatus.COMPLETED,
        externalId: WALLET_TOPUP_LEDGER.reversal(topup.id),
      });
      const synced = await syncDriverBalanceColumn(manager, topup.userId);
      if (synced.wentOffline) wentOfflineDriverId = synced.driverId;
      return {
        kind: 'cancelled',
        reversed: true,
        topup: { ...topup, status: WalletTopupStatus.CANCELLED, cancelledAt },
      } as TopupOutcome;
    });

    const offlineDriverId = wentOfflineDriverId as string | null;
    const reversed = outcome.kind === 'cancelled' && outcome.reversed ? outcome.topup : null;
    await this.afterCommit(ctx, async () => {
      if (offlineDriverId) {
        await this.driversService.takeOfflineInRedis(offlineDriverId, 'balance went negative after top-up reversal');
      }
      if (reversed) await this.notifyReversed(topupId, reversed);
    });
    return outcome;
  }

  private async notifyReversed(topupId: string, topup: WalletTopup): Promise<void> {
    const amount = Number(topup.amount);
    this.logger.warn(`Wallet top-up ${topupId} reversed after payment: −${amount} so'm`);
    await this.notifier?.balanceChanged(topup.userId, {
      delta: -amount,
      reason: 'topup_reversal',
      push: {
        text: localized({
          uz: {
            title: "To'lov bekor qilindi",
            body: `Hamyonni ${formatSom(amount)} so'mga to'ldirish bekor qilindi — summa hamyondan qaytarib olindi`,
          },
          ru: {
            title: 'Платёж отменён',
            body: `Пополнение кошелька на ${formatSom(amount)} сум отменено — сумма списана с кошелька`,
          },
        }),
        event: 'wallet_topup_reversed',
      },
      extra: { topupId },
    });
  }

  /** Muddati o'tgan `pending` lar → `expired` (daftarga ta'siri yo'q). */
  async expireStale(now: Date = new Date()): Promise<number> {
    const result = await this.topupRepository.update(
      {
        status: WalletTopupStatus.PENDING,
        createdAt: LessThan(new Date(now.getTime() - WALLET_TOPUP_TTL_MS)),
      },
      { status: WalletTopupStatus.EXPIRED, cancelledAt: now },
    );
    return result.affected ?? 0;
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'wallet-topups-expiry' })
  async handleExpiryTick(): Promise<void> {
    try {
      const expired = await this.expireStale();
      if (expired > 0) this.logger.log(`${expired} ta to'lanmagan to'ldirish muddati o'tdi`);
    } catch (err) {
      this.logger.error(`Top-up expiry tick failed: ${(err as Error).message}`);
    }
  }

  // ------------------------------------------------------------ ichki

  /**
   * Yangi `pending` to'ldirish yoki mavjudini qayta berish (#13) — hamyon
   * qulfi ostida, parallel so'rovlar chegarani aylanib o'tmasin.
   * Qayta beriladi: o'sha summa + provayder, hali hech bir provayder
   * tranzaksiyasiga bog'lanmagan (UZPS har `initiate` da yangi tranzaksiya
   * ochadi — u qayta berilmaydi).
   */
  private async openPendingTopup(
    userId: string,
    amount: number,
    provider: WalletTopupProvider,
  ): Promise<WalletTopup> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      await lockWalletForUpdate(manager, userId);
      const open = await manager.find(WalletTopup, {
        where: {
          userId,
          status: WalletTopupStatus.PENDING,
          createdAt: MoreThan(new Date(Date.now() - WALLET_TOPUP_TTL_MS)),
        },
      });
      const reusable = open.find(
        (row) =>
          row.provider === provider &&
          provider !== 'uzcard' &&
          !row.externalId &&
          WalletTopupsService.amountMatches(row, amount),
      );
      if (reusable) return reusable;
      if (open.length >= WALLET_TOPUP_MAX_PENDING) {
        throw codedConflict(
          ERROR_CODES.walletTopupTooManyPending,
          `To'lanmagan to'ldirishlar juda ko'p (${WALLET_TOPUP_MAX_PENDING} ta). Avvalgisini yakunlang yoki muddati o'tishini kuting.`,
          { details: { maxPending: WALLET_TOPUP_MAX_PENDING } },
        );
      }
      return manager.save(
        WalletTopup,
        manager.create(WalletTopup, {
          userId,
          amount,
          provider,
          status: WalletTopupStatus.PENDING,
          externalId: null,
          paidAt: null,
          cancelledAt: null,
        }),
      );
    });
  }

  /** Chaqiruvchi tranzaksiyasi bo'lsa — o'sha ichida, aks holda o'zimiz ochamiz. */
  private inTransaction<T>(ctx: MoneyContext | undefined, work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return ctx ? work(ctx.manager) : this.dataSource.transaction(work);
  }

  /** Tashqi effekt: chaqiruvchi tranzaksiyasi bo'lsa — commit'dan keyin. */
  private async afterCommit(ctx: MoneyContext | undefined, effect: () => Promise<void>): Promise<void> {
    if (ctx) {
      ctx.afterCommit.push(effect);
      return;
    }
    await effect();
  }

  /**
   * `WALLET_TOPUP_RETURN_URL` (masalan `angrengo://wallet/topup/{id}`) —
   * `{id}` to'ldirish id'si bilan. Sozlanmagan — provayder standarti.
   */
  private returnUrlFor(topupId: string): PaymentInitiateOptions | undefined {
    const template = (this.config?.get<string>('WALLET_TOPUP_RETURN_URL') ?? '').trim();
    if (!template) return undefined;
    return { returnUrl: template.split('{id}').join(encodeURIComponent(topupId)) };
  }

  private async lockTopup(manager: EntityManager, topupId: string): Promise<WalletTopup | null> {
    const peek = await manager.findOne(WalletTopup, { where: { id: topupId } });
    if (!peek) return null;
    // Hamyon qulfi — boshqa pul harakatlari bilan ketma-ketlik; qator qulfi —
    // bir xil to'ldirishga parallel kelgan ikki callback.
    await lockWalletForUpdate(manager, peek.userId);
    return manager.findOne(WalletTopup, { where: { id: topupId }, lock: { mode: 'pessimistic_write' } });
  }

  private providerFor(provider: WalletTopupProvider): PaymeProvider | ClickProvider | UzcardProvider {
    if (provider === 'payme') return this.paymeProvider;
    if (provider === 'click') return this.clickProvider;
    return this.uzcardProvider;
  }

  private providerConfigured(provider: WalletTopupProvider): boolean {
    return this.providerFor(provider).isConfigured();
  }
}

export function toView(topup: WalletTopup): WalletTopupView {
  const createdAt = topup.createdAt ? new Date(topup.createdAt) : new Date();
  return {
    id: topup.id,
    amount: Number(topup.amount),
    provider: topup.provider,
    status: topup.status,
    createdAt: createdAt.toISOString(),
    paidAt: topup.paidAt ? new Date(topup.paidAt).toISOString() : null,
    cancelledAt: topup.cancelledAt ? new Date(topup.cancelledAt).toISOString() : null,
    expiresAt: new Date(createdAt.getTime() + WALLET_TOPUP_TTL_MS).toISOString(),
  };
}
