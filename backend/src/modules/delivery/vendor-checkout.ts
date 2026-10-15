import { ERROR_CODES, codedConflict } from '../../common/errors/coded-error';

/**
 * Ovqat/market buyurtmasining mijozga ko'rinadigan qismi
 * (docs/specs/food-market-ux-v5.md §1–§2) — food va market uchun umumiy.
 *
 * Pul modeli:
 *  · `totalPrice` = tovar (aksiyadan KEYIN) + yetkazish. Sotuvchi ulushi,
 *    komissiya, hamyon o'tkazmasi va fiskal chek shu summadan — o'zgarmagan.
 *  · `promoDiscount` — promokod, PLATFORMA hisobidan; mijoz
 *    `payableTotal = totalPrice − promoDiscount` to'laydi.
 */

/** Mijoz faqat sotuvchi QABUL QILMAGAN buyurtmani bekor qila oladi. */
export const CUSTOMER_CANCELLABLE_STATUS = 'new';

export function customerCanCancel(order: { status: string }): boolean {
  return order.status === CUSTOMER_CANCELLABLE_STATUS;
}

export function payableTotal(order: { totalPrice: number; promoDiscount?: number | null }): number {
  return Math.max(0, Math.round(Number(order.totalPrice) - Number(order.promoDiscount ?? 0)));
}

/** Buyurtma JSON'iga `canCancel` va `payableTotal` qo'shiladi. */
export function withCustomerFields<T extends { status: string; totalPrice: number; promoDiscount?: number | null }>(
  order: T,
): T & { canCancel: boolean; payableTotal: number } {
  return { ...order, canCancel: customerCanCancel(order), payableTotal: payableTotal(order) };
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
