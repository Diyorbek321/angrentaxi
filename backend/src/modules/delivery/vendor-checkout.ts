import { ERROR_CODES, codedConflict } from '../../common/errors/coded-error';
import { checkoutDeliveryFee } from './delivery-ride-details';

/**
 * Ovqat/market buyurtmasining mijozga ko'rinadigan qismi
 * (docs/specs/food-market-ux-v5.md §1–§2) — food va market uchun umumiy.
 *
 * Pul modeli:
 *  · `totalPrice` = tovar (aksiyadan KEYIN) + yetkazish. Sotuvchi ulushi,
 *    komissiya, hamyon o'tkazmasi va fiskal chek shu summadan — o'zgarmagan.
 *  · `promoDiscount` — promokod, PLATFORMA hisobidan; mijoz
 *    `payableTotal = totalPrice − promoDiscount` to'laydi.
 *  · `deliveryFee` (JSON) — buyurtmada QO'LLANGAN yetkazish haqi
 *    (`totalPrice − Σ qty × price`); bepul yetkazishda 0 (§7).
 */

/** Mijoz faqat sotuvchi QABUL QILMAGAN buyurtmani bekor qila oladi. */
export const CUSTOMER_CANCELLABLE_STATUS = 'new';

export function customerCanCancel(order: { status: string }): boolean {
  return order.status === CUSTOMER_CANCELLABLE_STATUS;
}

export function payableTotal(order: { totalPrice: number; promoDiscount?: number | null }): number {
  return Math.max(0, Math.round(Number(order.totalPrice) - Number(order.promoDiscount ?? 0)));
}

/** Buyurtma JSON'iga `canCancel`, `payableTotal` va `deliveryFee` qo'shiladi. */
export function withCustomerFields<
  T extends {
    status: string;
    totalPrice: number;
    promoDiscount?: number | null;
    items: ReadonlyArray<{ qty: number; price: number }>;
  },
>(order: T): T & { canCancel: boolean; payableTotal: number; deliveryFee: number } {
  return {
    ...order,
    canCancel: customerCanCancel(order),
    payableTotal: payableTotal(order),
    deliveryFee: checkoutDeliveryFee({ totalPrice: Number(order.totalPrice), items: order.items }),
  };
}

export function cancelNotAllowed(kind: 'food' | 'market') {
  return codedConflict(
    ERROR_CODES.orderCancelNotAllowed,
    kind === 'food'
      ? "Restoran buyurtmani qabul qildi — bekor qilish uchun qo'llab-quvvatlashga yozing"
      : "Do'kon buyurtmani qabul qildi — bekor qilish uchun qo'llab-quvvatlashga yozing",
  );
}

/** Mijoz izohi: bo'sh joylar kesiladi, bo'sh bo'lsa null. */
export function cleanCancelReason(reason: string | undefined | null): string | null {
  const trimmed = reason?.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}
