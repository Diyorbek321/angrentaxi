import { FareBreakdown } from './fare-breakdown';

/**
 * Narx yaxlitlanadigan qadam, so'mda (biznes qarori, 2026-10-06).
 *
 * NEGA: tiyinli narx (`6 499.18`) naqd to'lovda qaytim muammosi va
 * "ilova bir narx, haydovchi boshqa narx aytdi" degan nizo tug'diradi.
 * 100 so'm — naqdda real ishlatiladigan eng kichik birlik.
 */
export const FARE_ROUNDING_STEP = 100;

/** Eng yaqin 100 so'mga (50 dan yuqoriga). Manfiy narx bo'lmaydi. */
export function roundFare(amount: number): number {
  if (!(amount > 0)) return 0;
  return Math.round(amount / FARE_ROUNDING_STEP) * FARE_ROUNDING_STEP;
}

/**
 * Tarkib jamini yaxlitlaydi va farqni `roundingAdjustment` qatoriga yozadi.
 *
 * ⚠️ Yaxlitlash ALOHIDA QATOR, jamini jimgina o'zgartirish emas: aks holda
 * chek qatorlari jamiga qo'shilmay qoladi (`fare-breakdown.ts` invarianti).
 *
 * IDEMPOTENT: avvalgi yaxlitlash qatori ayirilib, qaytadan hisoblanadi —
 * kutish haqi qo'shilgandan keyin qayta chaqirish xavfsiz.
 * Eski jsonb tarkiblarida maydon yo'q — `?? 0`.
 */
export function withRounding(breakdown: FareBreakdown): FareBreakdown {
  const unrounded = breakdown.total - (breakdown.roundingAdjustment ?? 0);
  const total = roundFare(unrounded);
  return {
    ...breakdown,
    roundingAdjustment: total - unrounded,
    total,
  };
}

/**
 * Promokod chegirmasidan keyingi yakuniy summa.
 *
 * Foizli promokod narxni yana tiyinli qilib qo'yadi (15% × 23 400 = 3 510).
 * Yakuniy summa 100 so'mga yaxlitlanadi, chegirma esa shu farqdan QAYTA
 * chiqariladi — chekda `jami − chegirma = yakuniy` doim to'g'ri.
 * Chegirma yo'q bo'lsa summa o'zgartirilmaydi (kelishilgan yetkazish haqi).
 */
export function applyDiscount(
  price: number,
  discount: number,
): { finalPrice: number; discountAmount: number } {
  if (!(discount > 0)) return { finalPrice: Math.max(0, price), discountAmount: 0 };
  const finalPrice = roundFare(price - discount);
  return { finalPrice, discountAmount: price - finalPrice };
}
