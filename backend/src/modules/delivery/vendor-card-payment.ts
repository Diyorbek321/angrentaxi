import { BadRequestException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { assertCashWithinLimit } from './vendor-cash';
import { formatSom } from './vendor-wallet-settlement';

/**
 * Kartali ovqat/market buyurtmasi — to'lovdan oldin sotuvchiga ketmaydi
 * (docs/INCIDENT-POLICY.md §1).
 *
 * "To'langan" — buyurtmaning (mijoz nomidagi) COMPLETED karta DEBIT
 * tranzaksiyasi bor. Uni `PaymentsService.initiatePayment` PENDING yaratadi,
 * provayder callback'i (Payme/Click merchant, Uzcard) COMPLETED qiladi.
 * Alohida `paid_at` ustuni yo'q: manba bitta, qaytarilgan (REFUNDED) to'lov
 * ham avtomatik "to'lanmagan" bo'ladi.
 *
 * To'lanmagan kartali buyurtmani sotuvchi qabul qila olmaydi, yetkazilsa
 * ham sotuvchiga karta tushumi yozilmaydi, `cardPaymentTimeoutMinutes`
 * dan keyin esa avtomatik bekor qilinadi.
 */

export const CARD_PAYMENT_PENDING_MESSAGE =
  "Mijoz karta to'lovini hali tugatmagan — to'lov kelguncha buyurtmani qabul qilib bo'lmaydi";

export const CARD_PAYMENTS_UNAVAILABLE_MESSAGE =
  "Karta orqali to'lov hozircha mavjud emas — naqd to'lovni tanlang";

/** Avtomatik bekor qilinganda `cancelReason` (mijoz va sotuvchi ko'radi). */
export const CARD_PAYMENT_EXPIRED_REASON = "Karta to'lovi muddatida qilinmadi";

/** Bir tick'da ko'rib chiqiladigan buyurtmalar — uzoq to'xtashdan keyin ham yuk cheklangan. */
export const UNPAID_CARD_EXPIRY_BATCH = 100;

/**
 * `Raw` uchun: buyurtma id'si (`alias`) bo'yicha COMPLETED karta DEBIT yo'q.
 * Muddat cron'i to'langan, lekin hali qabul qilinmagan buyurtmalarni
 * har daqiqada qayta ko'rmasin.
 */
export function notPaidByCardSql(alias: string): string {
  return `NOT EXISTS (SELECT 1 FROM "transactions" t
    WHERE t."order_id" = ${alias}
      AND t."type" = '${TransactionType.DEBIT}'
      AND t."payment_method" = '${PaymentMethod.CARD}'
      AND t."status" = '${TransactionStatus.COMPLETED}')`;
}

export interface VendorPaymentRef {
  id: string;
  customerId: string;
  paymentMethod: string;
  status: string;
}

export function isCardOrder(order: Pick<VendorPaymentRef, 'paymentMethod'>): boolean {
  return order.paymentMethod === 'card';
}

function cardDebitWhere(order: Pick<VendorPaymentRef, 'id' | 'customerId'>, status: TransactionStatus) {
  return {
    orderId: order.id,
    userId: order.customerId,
    type: TransactionType.DEBIT,
    paymentMethod: PaymentMethod.CARD,
    status,
  };
}

/** Naqd — doim `true`; karta — COMPLETED karta to'lovi bormi. */
export async function isVendorOrderPaid(
  repo: Pick<Repository<Transaction>, 'count'>,
  order: VendorPaymentRef,
): Promise<boolean> {
  if (!isCardOrder(order)) return true;
  return (await repo.count({ where: cardDebitWhere(order, TransactionStatus.COMPLETED) })) > 0;
}

/** Sotuvchi qabul qilish/oldinga surishdan oldin. */
export async function assertVendorOrderPaid(
  repo: Pick<Repository<Transaction>, 'count'>,
  order: VendorPaymentRef,
): Promise<void> {
  if (!(await isVendorOrderPaid(repo, order))) {
    throw new BadRequestException(CARD_PAYMENT_PENDING_MESSAGE);
  }
}

/**
 * Ro'yxat uchun — to'langan kartali buyurtmalar id'lari, BITTA so'rov
 * bilan (har buyurtmaga alohida so'rov emas).
 */
export async function paidCardOrderIds(
  repo: Pick<Repository<Transaction>, 'find'>,
  orders: readonly VendorPaymentRef[],
): Promise<Set<string>> {
  const candidates = orders.filter((order) => isCardOrder(order) && order.status !== 'cancelled');
  if (candidates.length === 0) return new Set();
  const payerOf = new Map(candidates.map((order) => [order.id, order.customerId]));
  const rows = await repo.find({
    select: { orderId: true, userId: true },
    where: {
      orderId: In([...payerOf.keys()]),
      type: TransactionType.DEBIT,
      paymentMethod: PaymentMethod.CARD,
      status: TransactionStatus.COMPLETED,
    },
  });
  return new Set(
    rows
      .filter((row) => row.orderId !== null && payerOf.get(row.orderId) === row.userId)
      .map((row) => row.orderId as string),
  );
}

/** JSON'dagi `paymentPending`: kartali, bekor qilinmagan va to'lanmagan. */
export function cardPaymentPending(order: Pick<VendorPaymentRef, 'paymentMethod' | 'status'>, paid: boolean): boolean {
  return isCardOrder(order) && order.status !== 'cancelled' && !paid;
}

/**
 * Bekor qilingan buyurtmaning ochiq (PENDING) karta to'lovlari yopiladi:
 * provayder keyin "to'lash"ga urinsa, nishon `closed` — pul bekor
 * qilingan buyurtmaga tushmaydi (`merchant/payment-targets.service.ts`).
 */
export async function closePendingCardPayments(
  repo: Pick<Repository<Transaction>, 'update'>,
  order: Pick<VendorPaymentRef, 'id' | 'customerId'>,
): Promise<void> {
  await repo.update(cardDebitWhere(order, TransactionStatus.PENDING), { status: TransactionStatus.FAILED });
}

export interface CheckoutPaymentInput {
  isCash: boolean;
  totalPrice: number;
  /** Naqd chegarasi, so'm; 0 — o'chiq. */
  cashLimit: number;
  /** Faqat platforma kuryeri yetkazsa (`delivery/vendor-cash.ts`). */
  cashLimitApplies: boolean;
  cardAvailable: boolean;
}

/**
 * Buyurtma yaratishda to'lov usuli tekshiruvi:
 *  · karta provayderi yo'q — kartali buyurtma rad;
 *  · savat naqd chegarasidan oshgan va karta yo'q — umuman buyurtma berib
 *    bo'lmaydi (aniq sabab bilan);
 *  · aks holda — oddiy naqd chegarasi (`assertCashWithinLimit`).
 */
export function assertCheckoutPaymentAllowed(input: CheckoutPaymentInput): void {
  const overCashLimit = input.cashLimitApplies && input.cashLimit > 0 && input.totalPrice > input.cashLimit;
  if (!input.cardAvailable && overCashLimit) {
    throw new BadRequestException(
      `Naqd to'lov ${formatSom(input.cashLimit)} so'mgacha, karta orqali to'lov esa hozircha mavjud emas — savatni kamaytiring.`,
    );
  }
  if (!input.isCash && !input.cardAvailable) {
    throw new BadRequestException(CARD_PAYMENTS_UNAVAILABLE_MESSAGE);
  }
  assertCashWithinLimit(input.isCash && input.cashLimitApplies, input.totalPrice, input.cashLimit);
}
