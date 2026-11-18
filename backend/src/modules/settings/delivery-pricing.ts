import { BadRequestException } from '@nestjs/common';

/**
 * Ovqat/market yetkazish narxi va vaqti (docs/specs/food-market-ux-v5.md §7).
 *
 * Bepul yetkazish: tovar summasi (aksiyadan KEYIN, promokoddan OLDIN —
 * `priceOrderLines().itemsTotal`) `freeDeliveryFrom` ga yetsa, yetkazish
 * haqi 0. `freeDeliveryFrom = 0` — funksiya o'chiq.
 */
export interface DeliveryPricing {
  /** Odatdagi yetkazish haqi, so'm. */
  deliveryFee: number;
  /** Bepul yetkazish chegarasi, so'm; 0 — o'chiq. */
  freeDeliveryFrom: number;
}

/** Yetkazish vaqti oralig'i (daqiqa) — ilova "30–50 daq" ko'rsatadi. */
export interface DeliveryEta {
  deliveryEtaMinMinutes: number;
  deliveryEtaMaxMinutes: number;
}

export const DEFAULT_FREE_DELIVERY_FROM = 0;
export const DEFAULT_DELIVERY_ETA_MIN_MINUTES = 30;
export const DEFAULT_DELIVERY_ETA_MAX_MINUTES = 50;
export const DELIVERY_ETA_MINUTES_MIN = 5;
export const DELIVERY_ETA_MINUTES_MAX = 240;

/** Buyurtmada undiriladigan yetkazish haqi. */
export function appliedDeliveryFee(pricing: DeliveryPricing, itemsTotal: number): number {
  const threshold = Number(pricing.freeDeliveryFrom);
  const isFree = Number.isFinite(threshold) && threshold > 0 && itemsTotal >= threshold;
  return isFree ? 0 : pricing.deliveryFee;
}

/** Birlashtirilgan (joriy + yuborilgan) oraliq izchil bo'lishi shart. */
export function assertDeliveryEtaRange(minMinutes: number, maxMinutes: number): void {
  if (minMinutes > maxMinutes) {
    throw new BadRequestException(
      `Yetkazish vaqti: eng kami eng ko'pidan katta bo'lishi mumkin emas (${minMinutes} > ${maxMinutes} daq)`,
    );
  }
}
