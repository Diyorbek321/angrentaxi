import { BadRequestException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { PaymentMethod } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { vendorReturnRefund } from './delivery-return';
import { isCardOrder } from './vendor-card-payment';
import { AUDIT_ACTIONS, AuditEntryInput } from '../audit/audit-log.service';
import type { LocalizedPush } from '../notifications/push-text';
import { deliveryFailedVendorText, deliveryReturnedText } from '../notifications/delivery-incident-texts';

/**
 * Sotuvchi buyurtmasining qaytarish hisob-kitobi (docs/INCIDENT-POLICY.md
 * §2) — ovqat va market uchun bitta joyda, ikki nusxa ajralib ketmasin.
 *
 *  · holat `returning|ready/shipped → returned` (shartli yozuv, bir marta);
 *  · sotuvchiga TUSHUM YOZILMAYDI (`settle*Earnings` chaqirilmaydi);
 *  · `returnCharge` — mijozdan olinadigan kuryer safari summasi (yetkazish +
 *    kutish + qaytarish). Naqdda u mijoz qarzi bo'lib allaqachon yozilgan
 *    (`orders-completion.service.ts`), kartada esa to'langan puldan ushlanadi
 *    va qolgani `refundDue` — karta qaytarish API'si yo'q, QO'LDA bajariladi
 *    (`refundStatus = 'pending'`, menejer "Istisnolar"da ko'radi).
 */
export interface VendorReturnOrder {
  id: string;
  customerId: string;
  paymentMethod: string;
  status: string;
}

export interface VendorReturnOutcome {
  applied: boolean;
  refundDue: number;
  /** Kartada to'langan pul qarzni qoplamagan qism (juda arzon tovar) — jurnal uchun. */
  uncovered: number;
}

/** Mijoz shu buyurtma uchun karta bilan haqiqatan to'lagan summa. */
export async function cardPaidAmount(
  transactions: Pick<Repository<Transaction>, 'find'>,
  order: Pick<VendorReturnOrder, 'id' | 'customerId'>,
): Promise<number> {
  const rows = await transactions.find({
    where: {
      orderId: order.id,
      userId: order.customerId,
      type: TransactionType.DEBIT,
      paymentMethod: PaymentMethod.CARD,
      status: TransactionStatus.COMPLETED,
    },
  });
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

export async function applyVendorReturned<T extends VendorReturnOrder>(
  deps: {
    repo: Pick<Repository<T>, 'update'>;
    transactions: Pick<Repository<Transaction>, 'find'>;
  },
  input: {
    order: T;
    /** Qaytarishdan oldingi holatlar (`returning` + kuryer yo'ldagi holat). */
    fromStatuses: string[];
    returnedStatus: string;
    customerOwes: number;
    now: Date;
  },
): Promise<VendorReturnOutcome> {
  const { order, customerOwes, now } = input;
  const card = isCardOrder(order);
  const { refundDue, uncovered } = card
    ? vendorReturnRefund(await cardPaidAmount(deps.transactions, order), customerOwes)
    : { refundDue: 0, uncovered: 0 };

  const result = await deps.repo.update(
    { id: order.id, status: In(input.fromStatuses) } as never,
    {
      status: input.returnedStatus,
      returnedAt: now,
      returnCharge: customerOwes,
      refundDue: card ? refundDue : null,
      refundStatus: card && refundDue > 0 ? 'pending' : null,
    } as never,
  );
  return { applied: Boolean(result.affected), refundDue, uncovered };
}

/** Sotuvchi "Qaytib keldi" ni faqat qaytarilayotgan buyurtmada bosadi. */
export function assertVendorCanConfirmReturn(
  order: { status: string; deliveryOrderId: string | null },
  returningStatus: string,
): asserts order is { status: string; deliveryOrderId: string } {
  if (order.status !== returningStatus || !order.deliveryOrderId) {
    throw new BadRequestException('Bu buyurtma qaytarilmayapti');
  }
}

/** Ovqat/market tinglovchisi uchun umumiy kontekst. */
export interface VendorReturnEventContext<T extends VendorReturnOrder> {
  kind: 'food' | 'market';
  order: T;
  ownerUserId: string;
  repo: Pick<Repository<T>, 'update'>;
  transactions: Pick<Repository<Transaction>, 'find'>;
  /** Kuryer yo'ldagi holat: ovqatda `ready`, marketda `shipped`. */
  inTransitStatus: string;
  emit: (userId: string, event: string, payload: Record<string, unknown>) => void;
  push?: (userIds: string[], text: LocalizedPush, event: string, data: Record<string, string>) => Promise<void>;
  audit?: (entry: AuditEntryInput) => Promise<unknown>;
  /** `returned` qo'llangandan keyin (market: zaxira qaytadi). */
  afterReturned?: () => Promise<void>;
}

/**
 * `delivery_failed` → `returning`, `returned` → `returned` (§2). Boshqa
 * hodisalar uchun `false` — chaqiruvchi o'z oqimini davom ettiradi.
 */
export async function handleVendorReturnEvent<T extends VendorReturnOrder>(
  ctx: VendorReturnEventContext<T>,
  event: { kind: string; customerOwes?: number; failureReason?: string },
  now: Date = new Date(),
): Promise<boolean> {
  const { order, kind } = ctx;
  const statusEvent = `${kind}:order:status`;
  const notifyBoth = (status: string, extra: Record<string, unknown> = {}) => {
    for (const userId of [order.customerId, ctx.ownerUserId]) {
      ctx.emit(userId, statusEvent, { orderId: order.id, status, ...extra });
    }
  };

  if (event.kind === 'delivery_failed') {
    const result = await ctx.repo.update(
      { id: order.id, status: ctx.inTransitStatus } as never,
      { status: 'returning' } as never,
    );
    if (!result.affected) return true;
    notifyBoth('returning', { reason: event.failureReason ?? null });
    await ctx.push?.([ctx.ownerUserId], deliveryFailedVendorText, `${kind}_order_returning`, { orderId: order.id });
    return true;
  }

  if (event.kind === 'returned') {
    const owes = Math.max(0, Number(event.customerOwes ?? 0));
    const outcome = await applyVendorReturned(
      { repo: ctx.repo, transactions: ctx.transactions },
      {
        order,
        fromStatuses: ['returning', ctx.inTransitStatus],
        returnedStatus: 'returned',
        customerOwes: owes,
        now,
      },
    );
    if (!outcome.applied) return true;
    if (outcome.refundDue > 0) {
      await ctx.audit?.({
        actorUserId: null,
        action: AUDIT_ACTIONS.deliveryRefundPending,
        targetType: `${kind}_order`,
        targetId: order.id,
        amount: outcome.refundDue,
        note: "Kartali buyurtma qaytarildi — summani qo'lda qaytarish kerak",
        metadata: { returnCharge: owes, uncovered: outcome.uncovered },
      });
    }
    await ctx.afterReturned?.();
    notifyBoth('returned', { returnCharge: owes, refundDue: outcome.refundDue });
    await ctx.push?.([order.customerId], (lang) => deliveryReturnedText(owes, lang), `${kind}_order_returned`, {
      orderId: order.id,
    });
    return true;
  }
  return false;
}
