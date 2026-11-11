import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../../../database/entities/order.entity';
import { TransactionStatus } from '../../../database/entities/transaction.entity';
import { CardChargeAttempt, CardChargeStatus } from '../../../database/entities/card-charge-attempt.entity';
import { PaymentsService } from '../payments.service';
import { SavedCardsService } from './saved-cards.service';
import {
  PAYME_RECEIPT_CANCELLED,
  PAYME_RECEIPT_PAID,
  PaymeCallResult,
  PaymeSubscribeClient,
} from './payme-subscribe.client';

/** Ketma-ket shuncha KARTA radi (`PAYME_CARD_DECLINE_CODES`) — karta o'chiriladi. */
export const MAX_CONSECUTIVE_CARD_FAILURES = 3;

/** Javobi noaniq urinish shuncha vaqtdan keyin Payme'dan qayta so'raladi. */
export const RECONCILE_AFTER_MS = 2 * 60 * 1000;

/** To'lanmagan (holat 4 emas) chek shuncha vaqtdan keyin bekor qilinadi. */
export const RECONCILE_CANCEL_AFTER_MS = 15 * 60 * 1000;

/** Bir tikda ko'riladigan urinishlar. */
const RECONCILE_BATCH = 50;

export type AutoChargeOutcome =
  | 'disabled'
  | 'not_card_order'
  | 'nothing_to_charge'
  | 'no_card'
  | 'in_progress'
  | 'paid'
  | 'declined'
  | 'provider_error'
  | 'pending_reconcile'
  | 'review';

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === PG_UNIQUE_VIOLATION || e?.driverError?.code === PG_UNIQUE_VIOLATION;
}

/**
 * Safar tugagach yo'lovchining asosiy kartasidan avtomatik yechish
 * (Yandex modeli; docs/specs/saqlangan-kartalar.md v2).
 *
 * Pul daftari bu yerda YOZILMAYDI. `receipts.pay` paytida Payme bizning
 * Merchant API'mizni (`CheckPerform` → `Create` → `PerformTransaction`)
 * chaqiradi va buyurtma to'lovi mavjud, sinalgan yo'l bilan
 * (`PaymentsService.completeOrderPayment` → `settleOrderPayout`) yopiladi.
 * Bu xizmat faqat: to'lovni boshlaydi, urinishni yozadi, noaniq natijani
 * keyin aniqlaydi.
 *
 * Har bir holat o'tishi shartli (`WHERE status = 'pending'`): parallel cron
 * yoki kech kelgan javob yakuniy holatni qayta yoza olmaydi.
 */
@Injectable()
export class CardAutoChargeService {
  private readonly logger = new Logger(CardAutoChargeService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(CardChargeAttempt)
    private readonly attempts: Repository<CardChargeAttempt>,
    private readonly payments: PaymentsService,
    private readonly savedCards: SavedCardsService,
    private readonly payme: PaymeSubscribeClient,
    private readonly config: ConfigService,
  ) {}

  /** Safar yakunidan keyin chaqiriladi; hech qachon xato otmaydi. */
  async chargeCompletedOrderSafely(orderId: string): Promise<AutoChargeOutcome | 'error'> {
    try {
      return await this.chargeCompletedOrder(orderId);
    } catch (err) {
      this.logger.error(`Auto-charge for order ${orderId} failed: ${(err as Error).message}`);
      return 'error';
    }
  }

  async chargeCompletedOrder(orderId: string): Promise<AutoChargeOutcome> {
    if (!this.savedCards.isEnabled()) return 'disabled';

    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.paymentMethod !== PaymentMethod.CARD || order.status !== OrderStatus.COMPLETED) {
      return 'not_card_order';
    }

    const payment = await this.payments.getOrderPayment(orderId);
    if (!payment || payment.status !== TransactionStatus.PENDING || payment.amount <= 0) {
      return 'nothing_to_charge';
    }

    const chargeable = await this.savedCards.getChargeableCard(order.passengerId);
    if (!chargeable) return 'no_card';

    let attempt: CardChargeAttempt;
    try {
      attempt = await this.attempts.save(
        this.attempts.create({
          orderId,
          savedCardId: chargeable.card.id,
          amount: payment.amount,
          providerReceiptId: null,
          status: 'pending',
          failureReason: null,
        }),
      );
    } catch (err) {
      if (isUniqueViolation(err)) return 'in_progress';
      throw err;
    }

    const receipt = await this.payme.createReceipt(payment.amount, orderId);
    if (!receipt.ok) {
      // Chek yaratilmadi — pul yechilmagan. Karta aybdor emas.
      await this.transition(attempt.id, 'failed', receipt.reason);
      return 'provider_error';
    }
    await this.attempts.update({ id: attempt.id, status: 'pending' }, { providerReceiptId: receipt.value });

    const paid = await this.payme.payReceipt(receipt.value, chargeable.token);
    if (paid.ok && paid.value === PAYME_RECEIPT_PAID) {
      return this.settle(attempt.id, chargeable.card.id, orderId);
    }
    if (!paid.ok && !paid.ambiguous) {
      return this.handleRejectedPay(attempt.id, chargeable.card.id, orderId, receipt.value, paid);
    }
    // Timeout yoki oraliq holat: pul ketgan bo'lishi mumkin — cron aniqlaydi.
    this.logger.warn(`Auto-charge for order ${orderId} is ambiguous; will reconcile receipt ${receipt.value}`);
    return 'pending_reconcile';
  }

  /**
   * Flag o'chirilsa ham ishlaydi (faqat Payme kalitlari kerak): pul ketgan
   * bo'lishi mumkin bo'lgan `pending` urinishlar tashlab ketilmasin.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'card-auto-charge-reconcile' })
  async reconcileTick(): Promise<void> {
    if (!this.payme.isConfigured()) return;
    try {
      await this.reconcilePending();
    } catch (err) {
      this.logger.error(`Card charge reconcile tick failed: ${(err as Error).message}`);
    }
  }

  /**
   * Noaniq qolgan urinishlarni Payme chek holati bo'yicha yopadi.
   * `updatedAt` bo'yicha — har ko'rilgan urinish navbat oxiriga o'tadi,
   * hal bo'lmaydiganlar yangilarini to'sib qo'ymaydi.
   */
  async reconcilePending(now: Date = new Date()): Promise<number> {
    const stale = await this.attempts.find({
      where: { status: 'pending', updatedAt: LessThan(new Date(now.getTime() - RECONCILE_AFTER_MS)) },
      order: { updatedAt: 'ASC' },
      take: RECONCILE_BATCH,
    });
    let resolved = 0;
    for (const attempt of stale) {
      if (await this.reconcileOne(attempt, now)) resolved += 1;
    }
    return resolved;
  }

  private async reconcileOne(attempt: CardChargeAttempt, now: Date): Promise<boolean> {
    if (!attempt.providerReceiptId) {
      // Chek yaratilmay qolgan (jarayon uzildi) — pul yechilmagan.
      return this.transition(attempt.id, 'failed', 'receipt_not_created');
    }
    const state = await this.payme.getReceiptState(attempt.providerReceiptId);
    if (state.ok && state.value === PAYME_RECEIPT_PAID) {
      const outcome = await this.settle(attempt.id, attempt.savedCardId, attempt.orderId);
      return outcome !== 'in_progress';
    }
    if (state.ok && state.value === PAYME_RECEIPT_CANCELLED) {
      return this.transition(attempt.id, 'failed', 'receipt_cancelled');
    }
    if (state.ok && now.getTime() - attempt.createdAt.getTime() > RECONCILE_CANCEL_AFTER_MS) {
      // Payme chekni to'lanmagan deb biladi va uzoq vaqt o'tdi — bekor
      // qilamiz. Bekor qilish rad etilsa (shu orada to'langan) — keyingi tik.
      const cancelled = await this.payme.cancelReceipt(attempt.providerReceiptId);
      if (cancelled.ok && cancelled.value === PAYME_RECEIPT_CANCELLED) {
        return this.transition(attempt.id, 'failed', 'receipt_expired');
      }
    }
    // Keyingi tikda qayta — `updatedAt` surilib, navbat oxiriga o'tadi.
    await this.attempts.update(
      { id: attempt.id, status: 'pending' },
      { failureReason: state.ok ? `state_${state.value}` : state.reason.slice(0, 64) },
    );
    return false;
  }

  /**
   * Payme to'landi dedi. Daftar Merchant callback'i bilan yopilgan bo'lishi
   * kerak; yopilmagan bo'lsa — `review`: qayta yechish bloklanadi va inson
   * tekshiradi (yo'lovchidan ikkinchi marta olinmasin).
   */
  private async settle(attemptId: string, cardId: string, orderId: string): Promise<AutoChargeOutcome> {
    const payment = await this.payments.getOrderPayment(orderId);
    if (payment?.status !== TransactionStatus.COMPLETED) {
      this.logger.error(
        `Order ${orderId} paid by saved card at Payme but ledger is ${payment?.status ?? 'missing'} — ` +
          `attempt ${attemptId} moved to review`,
      );
      await this.transition(attemptId, 'review', 'ledger_not_settled');
      return 'review';
    }
    const moved = await this.transition(attemptId, 'paid', null);
    if (!moved) return 'in_progress';
    await this.savedCards.recordChargeSuccess(cardId);
    return 'paid';
  }

  /**
   * Payme `receipts.pay` ni rad etdi. Kartaning rad hisoblagichi faqat
   * haqiqiy KARTA radi kodlarida oshadi (`PAYME_CARD_DECLINE_CODES`) —
   * kalit xatosi, 429 yoki merchant rad etishi kartani o'chirmasin.
   * Chek bekor qilishdan oldin holati tekshiriladi.
   */
  private async handleRejectedPay(
    attemptId: string,
    cardId: string,
    orderId: string,
    receiptId: string,
    paid: Extract<PaymeCallResult<number>, { ok: false }>,
  ): Promise<AutoChargeOutcome> {
    const state = await this.payme.getReceiptState(receiptId);
    if (state.ok && state.value === PAYME_RECEIPT_PAID) {
      // Rad javobiga qaramay chek to'langan — haqiqat Payme'da.
      return this.settle(attemptId, cardId, orderId);
    }
    if (!state.ok) {
      // Holatni bila olmadik — bekor qilmaymiz, cron hal qiladi.
      return 'pending_reconcile';
    }

    await this.transition(attemptId, 'failed', paid.reason);
    const cancelled = await this.payme.cancelReceipt(receiptId);
    if (!cancelled.ok) this.logger.warn(`Payme receipt ${receiptId} cancel failed: ${cancelled.reason}`);

    if (paid.rpcCode === undefined || !this.cardDeclineCodes().has(paid.rpcCode)) {
      return 'provider_error';
    }
    const { deactivated } = await this.savedCards.recordChargeFailure(cardId, MAX_CONSECUTIVE_CARD_FAILURES);
    if (deactivated) this.logger.warn(`Saved card ${cardId} deactivated after repeated declines`);
    return 'declined';
  }

  private cardDeclineCodes(): Set<number> {
    const raw = this.config.get<string>('PAYME_CARD_DECLINE_CODES', '') ?? '';
    return new Set(
      raw
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((code) => Number.isInteger(code) && code !== 0),
    );
  }

  /** Faqat `pending` dan o'tadi; o'tdi — true. */
  private async transition(attemptId: string, status: CardChargeStatus, reason: string | null): Promise<boolean> {
    const result = await this.attempts.update(
      { id: attemptId, status: 'pending' },
      { status, failureReason: reason === null ? null : reason.slice(0, 64) },
    );
    return (result.affected ?? 0) > 0;
  }
}
