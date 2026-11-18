/**
 * Summalarni solishtirish — BUTUN TIYIN'da (1 so'm = 100 tiyin).
 *
 * Ilgari `Math.abs(a − b) < 0.01` ishlatilardi: suzuvchi nuqta xatosi va
 * kasr tiyin ("25000.004") chegarada mos deb o'tib ketishi mumkin edi.
 * Endi har ikki tomon butun tiyinga o'giriladi va QAT'IY tenglik talab
 * qilinadi (security review, 2026-10-15, #10).
 */

/** Kasr qoldig'i shu chegaradan kichik bo'lsa — suzuvchi nuqta shovqini. */
const EPSILON = 1e-6;

/** So'm → butun tiyin. Kasr tiyin (masalan 0.004 so'm) yoki son bo'lmasa — `null`. */
export function somToTiyin(value: unknown): number | null {
  const som = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof som !== 'number' || !Number.isFinite(som)) return null;
  const raw = som * 100;
  const rounded = Math.round(raw);
  return Math.abs(raw - rounded) < EPSILON ? rounded : null;
}

/** Provayder tiyinda yuborgan qiymat — faqat butun musbat son. */
export function strictTiyin(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

/** Callback summasi (so'mda) yozilgan summaga tiyinigacha tengmi. */
export function sameSomAmount(callbackSom: unknown, recordedSom: number | string): boolean {
  const callback = somToTiyin(callbackSom);
  const recorded = somToTiyin(Number(recordedSom));
  return callback !== null && recorded !== null && callback === recorded;
}
