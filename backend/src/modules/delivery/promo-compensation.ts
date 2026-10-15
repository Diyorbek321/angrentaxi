import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { syncDriverBalanceColumn } from '../payments/wallet-balance.util';

/**
 * Promokod chegirmasining PLATFORMA tomonidan qoplanishi
 * (docs/specs/food-market-ux-v5.md §2, docs/LEGAL-COMPLIANCE.md §26).
 *
 * Naqd buyurtmada mijoz eshik oldida `totalPrice − promoDiscount` to'laydi.
 * Pulni kim olgan bo'lsa (platforma kuryeri yoki do'konning o'z
 * yetkazuvchisi — sotuvchi), platforma unga farqni hamyoniga CREDIT qiladi:
 * `<kind>_order_promo_<id>`. Shunday qilib sotuvchi ulushi va kuryer daromadi
 * promokodsiz buyurtmadagi bilan bir xil qoladi.
 *
 * Karta buyurtmasida yozuv yo'q: mijozdan kam undiriladi, sotuvchiga esa
 * odatdagidek to'liq `totalPrice` CREDIT qilinadi — farqni platforma o'zi
 * ko'taradi.
 *
 * Bir martalik: chaqiruvchi buni faqat "yetkazildi" ga SHARTLI o'tishda
 * (komissiya bilan bir joyda) chaqiradi.
 */
export const PROMO_COMPENSATION_TAG = (kind: 'food' | 'market', vendorOrderId: string): string =>
  `${kind}_order_promo_${vendorOrderId}`;

export interface PromoCompensationInput {
  kind: 'food' | 'market';
  vendorOrderId: string;
  isCash: boolean;
  promoDiscount: number;
  /** Naqdni olgan: kuryer (`users.id`) yoki sotuvchi egasi. */
  collectorUserId: string | null;
  /** Kuryer bo'lsa — `drivers.balance` keshi yangilanadi (§13). */
  collectorIsCourier: boolean;
}

const logger = new Logger('PromoCompensation');

export async function creditPromoCompensation(
  ledger: Repository<Transaction>,
  input: PromoCompensationInput,
): Promise<boolean> {
  const amount = Math.round(Number(input.promoDiscount ?? 0));
  if (!input.isCash || amount <= 0) return false;
  if (!input.collectorUserId) {
    logger.warn(`Promokod qoplanmadi: ${input.kind} buyurtma ${input.vendorOrderId} — naqd oluvchi noma'lum`);
    return false;
  }
  await ledger.save({
    userId: input.collectorUserId,
    orderId: null,
    amount,
    type: TransactionType.CREDIT,
    paymentMethod: PaymentMethod.WALLET,
    status: TransactionStatus.COMPLETED,
    externalId: PROMO_COMPENSATION_TAG(input.kind, input.vendorOrderId),
  });
  if (input.collectorIsCourier && ledger.manager) {
    await syncDriverBalanceColumn(ledger.manager, input.collectorUserId);
  }
  return true;
}
