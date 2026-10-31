import { ERROR_CODES, codedConflict } from '../../common/errors/coded-error';
import { checkoutDeliveryFee } from './delivery-ride-details';
import { vendorCommissionAmount } from './vendor-wallet-settlement';

/**
 * Ovqat/market buyurtmasining mijozga ko'rinadigan qismi
 * (docs/specs/food-market-ux-v5.md §1–§2) — food va market uchun umumiy.
 *
 * Pul modeli:
 *  · `totalPrice` = tovar (aksiyadan KEYIN) + yetkazish.
 *  · Sotuvchi komissiyasi FAQAT tovardan (`vendorItemsTotal`), yetkazish
 *    haqidan HECH QACHON (egasi tasdiqlagan qaror) — `vendorOrderCommission`.
 *  · Sotuvchi tushumi (`vendorRevenue`): platforma kuryeri yetkazsa — tovar
 *    (yetkazish haqi kuryerniki); o'z kuryeri yetkazsa — tovar + yetkazish.
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

interface CheckoutOrder {
  totalPrice: number;
  items: ReadonlyArray<{ qty: number; price: number }>;
}

/**
 * Tovar summasi — aksiyadan KEYINGI narxlar, yetkazish haqisiz
 * (`totalPrice − checkoutDeliveryFee`). Promokod (`promoDiscount`) bazani
 * KAMAYTIRMAYDI: uni platforma to'laydi (docs/LEGAL-COMPLIANCE.md §26),
 * sotuvchi tovarni to'liq narxda sotgan.
 */
export function vendorItemsTotal(order: CheckoutOrder): number {
  const totalPrice = Number(order.totalPrice);
  return Math.max(0, Math.round(totalPrice - checkoutDeliveryFee({ totalPrice, items: order.items })));
}

/**
 * Platformaning sotuvchidan oladigan komissiyasi — FAQAT tovardan.
 * Masalan: tovar 50 000 + yetkazish 8 000, 12% → 6 000 (6 960 emas).
 * Hamyon o'tkazmasi, `settle*Earnings` va fiskal chek — hammasi shu formula.
 */
export function vendorOrderCommission(order: CheckoutOrder, commissionRate: number): number {
  return vendorCommissionAmount(vendorItemsTotal(order), commissionRate);
}

/**
 * Sotuvchi o'zi yetkazdimi: platforma kuryeri chaqirilgan buyurtma faqat
 * kuryer safari orqali "yetkazildi" bo'ladi (`advanceOrder` qo'lda yo'lni
 * to'sadi), ya'ni yetkazilgan buyurtmada kuryer safari yo'q = o'z kuryeri.
 */
export function isSelfDelivered(order: { deliveryOrderId?: string | null }): boolean {
  return !order.deliveryOrderId;
}

/** Sotuvchiga tegishli yalpi tushum (komissiyadan oldin). */
export function vendorRevenue(order: CheckoutOrder & { deliveryOrderId?: string | null }): number {
  return isSelfDelivered(order) ? Math.round(Number(order.totalPrice)) : vendorItemsTotal(order);
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
