import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '../../../database/entities/transaction.entity';
import { WalletTopupStatus } from '../../../database/entities/wallet-topup.entity';
import { MerchantProvider, MerchantTargetKind } from '../../../database/entities/merchant-transaction.entity';
import { PaymentsService } from '../payments.service';
import { WalletTopupsService } from '../wallet-topups.service';
import { MoneyContext } from '../money-context';

/** Nishonning to'lov nuqtai nazaridan holati. */
export type PaymentTargetStatus = 'payable' | 'paid' | 'closed';

export interface PaymentTarget {
  kind: MerchantTargetKind;
  /** Provayderga yuborilgan havola: buyurtma UUID'i yoki `topup_<id>`. */
  ref: string;
  /** So'mda. */
  amount: number;
  status: PaymentTargetStatus;
}

/** Nishonga ishora — merchant tranzaksiyasi qatoridan ham tuziladi. */
export type TargetRef = Pick<PaymentTarget, 'kind' | 'ref'>;

export type TargetPayOutcome = 'paid' | 'already_paid' | 'amount_mismatch' | 'not_payable' | 'not_found';

/** `bind` natijasi: `busy` — nishon boshqa tranzaksiyaga bog'langan. */
export type TargetBindOutcome = 'bound' | 'busy' | 'not_payable';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Merchant protokollari (Payme, Click) uchun yagona nishon qatlami: havola
 * bo'yicha buyurtma to'lovi yoki hamyonni to'ldirishni topadi va pul
 * amallarini o'sha oqimning o'z servisiga topshiradi. Protokol kodi nishon
 * turini bilmaydi — ikki oqim bitta to'g'ri implementatsiyadan foydalanadi.
 */
@Injectable()
export class PaymentTargetsService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly topups: WalletTopupsService,
  ) {}

  static kindOf(ref: unknown): MerchantTargetKind | null {
    if (WalletTopupsService.isReference(ref)) return 'topup';
    if (typeof ref === 'string' && UUID_RE.test(ref)) return 'order';
    return null;
  }

  /**
   * `provider` berilsa — to'ldirish faqat O'Z provayderi uchun to'lanadigan
   * (security review #1): boshqa provayder ko'radigan holat `closed`.
   */
  async load(ref: unknown, provider?: MerchantProvider): Promise<PaymentTarget | null> {
    const kind = PaymentTargetsService.kindOf(ref);
    if (!kind || typeof ref !== 'string') return null;

    if (kind === 'topup') {
      const topup = await this.topups.findByReference(ref);
      if (!topup) return null;
      if (provider && topup.provider !== provider) {
        return { kind, ref, amount: Number(topup.amount), status: 'closed' };
      }
      const status: PaymentTargetStatus =
        topup.status === WalletTopupStatus.PENDING
          ? 'payable'
          : topup.status === WalletTopupStatus.PAID
            ? 'paid'
            : 'closed';
      return { kind, ref, amount: Number(topup.amount), status };
    }

    const payment = await this.payments.getOrderPayment(ref);
    if (!payment) return null;
    const status: PaymentTargetStatus =
      payment.status === TransactionStatus.PENDING
        ? 'payable'
        : payment.status === TransactionStatus.COMPLETED
          ? 'paid'
          : 'closed';
    return { kind, ref, amount: payment.amount, status };
  }

  /**
   * Provayder tranzaksiyasi yaratildi (Payme `CreateTransaction`, Click
   * Prepare) — to'ldirish shu tranzaksiyaga bog'lanadi (#1). Buyurtma: Payme
   * da unikal indeks (bitta faol tranzaksiya), to'lov esa `externalId` bilan
   * bir martalik — bog'lash shart emas.
   */
  async bind(target: TargetRef, provider: MerchantProvider, externalId: string): Promise<TargetBindOutcome> {
    if (target.kind === 'order') return 'bound';
    const topup = await this.topups.findByReference(target.ref);
    if (!topup) return 'not_payable';
    const outcome = await this.topups.bindToProvider(topup.id, provider, externalId);
    if (outcome === 'bound' || outcome === 'busy') return outcome;
    return 'not_payable';
  }

  /**
   * Pul tushdi. Bir martalik — takror (xuddi shu `externalId`) `already_paid`.
   * `ctx` — merchant tranzaksiyasi (holat da'vosi bilan bitta tranzaksiya, #8).
   */
  async markPaid(
    target: TargetRef,
    input: { amount: number; externalId: string; provider?: MerchantProvider },
    ctx?: MoneyContext,
  ): Promise<TargetPayOutcome> {
    if (target.kind === 'order') {
      return this.payments.completeOrderPayment(target.ref, { amount: input.amount, externalId: input.externalId }, ctx);
    }
    const topup = await this.topups.findByReference(target.ref);
    if (!topup) return 'not_found';
    const outcome = await this.topups.markPaid(topup.id, input, ctx);
    switch (outcome.kind) {
      case 'paid':
      case 'already_paid':
      case 'amount_mismatch':
      case 'not_found':
        return outcome.kind;
      default:
        return 'not_payable';
    }
  }

  /**
   * To'lanmagan tranzaksiya bekor bo'ldi. Buyurtma: hech narsa — mijoz qayta
   * to'lay oladi (karta to'lovi qatori `pending` qoladi). To'ldirish: bir
   * martalik checkout yopiladi (`cancelled`/`failed`).
   */
  async release(target: TargetRef, failed = false, ctx?: MoneyContext): Promise<void> {
    if (target.kind === 'order') return;
    const topup = await this.topups.findByReference(target.ref);
    if (!topup || topup.status !== WalletTopupStatus.PENDING) return;
    await this.topups.cancel(topup.id, failed ? WalletTopupStatus.FAILED : WalletTopupStatus.CANCELLED, ctx);
  }

  /**
   * O'tkazilgan to'lov qaytarildi (provayder refund). Takror — no-op.
   * Buyurtma qaytarimi (ulushni qaytarib olish, fiskal chek, push) o'z
   * tranzaksiyalarida — `ctx` bo'lsa commit'dan KEYIN, bir martalik.
   */
  async refund(target: TargetRef, externalId: string, ctx?: MoneyContext): Promise<void> {
    if (target.kind === 'order') {
      const run = async (): Promise<void> => {
        await this.payments.refundOrderPayment(target.ref, externalId);
      };
      if (ctx) ctx.afterCommit.push(run);
      else await run();
      return;
    }
    const topup = await this.topups.findByReference(target.ref);
    if (!topup || topup.status !== WalletTopupStatus.PAID) return;
    await this.topups.cancel(topup.id, WalletTopupStatus.CANCELLED, ctx);
  }
}
