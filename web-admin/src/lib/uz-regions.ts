/**
 * O'zbekiston hududlari (ISO 3166-2:UZ) — taksi litsenziyasi hududi.
 * Manba: `backend/src/common/regions/uz-regions.ts` (ro'yxat bir xil bo'lishi shart).
 */
import { getLocale } from '@/lib/i18n/core';

export const UZ_REGIONS = [
  { code: 'UZ-AN', uz: 'Andijon viloyati', ru: 'Андижанская область' },
  { code: 'UZ-BU', uz: 'Buxoro viloyati', ru: 'Бухарская область' },
  { code: 'UZ-FA', uz: 'Fargʻona viloyati', ru: 'Ферганская область' },
  { code: 'UZ-JI', uz: 'Jizzax viloyati', ru: 'Джизакская область' },
  { code: 'UZ-NG', uz: 'Namangan viloyati', ru: 'Наманганская область' },
  { code: 'UZ-NW', uz: 'Navoiy viloyati', ru: 'Навоийская область' },
  { code: 'UZ-QA', uz: 'Qashqadaryo viloyati', ru: 'Кашкадарьинская область' },
  { code: 'UZ-QR', uz: 'Qoraqalpogʻiston Respublikasi', ru: 'Республика Каракалпакстан' },
  { code: 'UZ-SA', uz: 'Samarqand viloyati', ru: 'Самаркандская область' },
  { code: 'UZ-SI', uz: 'Sirdaryo viloyati', ru: 'Сырдарьинская область' },
  { code: 'UZ-SU', uz: 'Surxondaryo viloyati', ru: 'Сурхандарьинская область' },
  { code: 'UZ-TK', uz: 'Toshkent shahri', ru: 'город Ташкент' },
  { code: 'UZ-TO', uz: 'Toshkent viloyati', ru: 'Ташкентская область' },
  { code: 'UZ-XO', uz: 'Xorazm viloyati', ru: 'Хорезмская область' },
] as const;

export type UzRegionCode = (typeof UZ_REGIONS)[number]['code'];

export function isUzRegionCode(value: string | null | undefined): value is UzRegionCode {
  return UZ_REGIONS.some((r) => r.code === value);
}

/** Hudud nomi joriy tilda; kod emas (eski erkin matn) bo'lsa — `null`. */
export function regionName(code: string | null | undefined): string | null {
  const region = UZ_REGIONS.find((r) => r.code === code);
  if (!region) return null;
  return getLocale() === 'ru' ? region.ru : region.uz;
}

/** Ro'yxat joriy tilda, alifbo tartibida. */
export function regionOptions(): Array<{ value: UzRegionCode; label: string }> {
  return UZ_REGIONS.map((r) => ({ value: r.code, label: regionName(r.code) ?? r.code })).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

export type LicenceRegionState =
  | { kind: 'missing' }
  | { kind: 'legacy'; text: string }
  | { kind: 'ok'; code: UzRegionCode; name: string };

/**
 * Bo'sh — hudud cheklovi bu haydovchiga qo'llanmaydi; eski erkin matn —
 * backend uni tanimagan bo'lishi mumkin. Ikkalasi ham panelda belgilanadi.
 */
export function licenceRegionState(value: string | null | undefined): LicenceRegionState {
  const text = value?.trim() ?? '';
  if (!text) return { kind: 'missing' };
  if (!isUzRegionCode(text)) return { kind: 'legacy', text };
  return { kind: 'ok', code: text, name: regionName(text) ?? text };
}
