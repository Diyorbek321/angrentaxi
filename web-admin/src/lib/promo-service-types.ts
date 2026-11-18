/**
 * Promokod qaysi xizmatlarda amal qiladi — docs/specs/food-market-ux-v5.md §2.
 * `serviceTypes: null` (yoki bo'sh) = hammasi. web-admin va web-manager'da bir xil.
 */

import { t } from '@/locales';

export const PROMO_SERVICE_TYPES = ['taxi', 'cargo', 'parcel', 'food', 'market'] as const;

export type PromoServiceType = (typeof PROMO_SERVICE_TYPES)[number];

/** Render paytida chaqiring — faol tildagi yorliqlar. */
export function promoServiceTypeLabels(): Record<PromoServiceType, string> {
  return t().promo.serviceTypes;
}

export function allServicesLabel(): string {
  return t().promo.allServices;
}

const isKnown = (v: unknown): v is PromoServiceType =>
  typeof v === 'string' && (PROMO_SERVICE_TYPES as readonly string[]).includes(v);

/** Ma'lum turlar, kanonik tartibda, takrorsiz. Noma'lum qiymatlar tashlanadi. */
export function normalizeServiceTypes(list: readonly unknown[] | null | undefined): PromoServiceType[] {
  if (!Array.isArray(list)) return [];
  return PROMO_SERVICE_TYPES.filter((t) => list.some((v) => v === t) && isKnown(t));
}

/** Hammasi tanlangan yoki hech biri — "Hammasi" deb ko'riladi. */
export function coversAllServices(list: readonly unknown[] | null | undefined): boolean {
  const n = normalizeServiceTypes(list).length;
  return n === 0 || n === PROMO_SERVICE_TYPES.length;
}

/** Jadval/CSV uchun: "Hammasi" yoki "Ovqat, Market". */
export function serviceTypesLabel(list: readonly unknown[] | null | undefined): string {
  if (coversAllServices(list)) return allServicesLabel();
  const labels = promoServiceTypeLabels();
  return normalizeServiceTypes(list)
    .map((type) => labels[type])
    .join(', ');
}

export function toggleServiceType(list: readonly PromoServiceType[], type: PromoServiceType): PromoServiceType[] {
  const next = list.includes(type) ? list.filter((t) => t !== type) : [...list, type];
  return normalizeServiceTypes(next);
}

/**
 * POST tanasi uchun. "Hammasi" holatida maydon UMUMAN yuborilmaydi (server
 * default — null): backend `forbidNonWhitelisted` bilan ishlaydi, maydon hali
 * qo'shilmagan bo'lsa ham eski promokodlarni yaratish buzilmaydi.
 */
export function serviceTypesPayload(list: readonly PromoServiceType[]): { serviceTypes?: PromoServiceType[] } {
  return coversAllServices(list) ? {} : { serviceTypes: normalizeServiceTypes(list) };
}
