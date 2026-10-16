/**
 * Toshkent kuni chegaralari. O'zbekistonda yozgi vaqt yo'q — doimiy UTC+5,
 * shuning uchun vaqt zonasi kutubxonasi kerak emas (`tax-withholding.ts`
 * dagi bilan bir xil yondashuv).
 *
 * NEGA KERAK: yo'lovchi "17-oktabr" qatnovlarini so'raganda u Toshkent
 * kunini nazarda tutadi. UTC kuni bo'yicha qidirilsa, ertalab 00:00–05:00
 * dagi qatnovlar oldingi kunga tushib qolardi.
 */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DayRange {
  from: Date;
  to: Date;
}

/** `YYYY-MM-DD` ni tekshiradi (mavjud sana bo'lishi shart); aks holda `null`. */
export function parseTashkentDate(value: string): string | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  // 2026-02-30 → 2026-03-02 bo'lib ketadi — shuni tutadi.
  const roundTrips =
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
  return roundTrips ? value : null;
}

/** Toshkent kunining [boshi, oxiri) oralig'i, UTC'da. Sana oldindan tekshirilgan. */
export function tashkentDayRange(date: string): DayRange {
  const [year, month, day] = date.split('-').map(Number);
  const from = new Date(Date.UTC(year, month - 1, day) - TASHKENT_OFFSET_MS);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

/** Berilgan lahza Toshkentda qaysi sana (`YYYY-MM-DD`). */
export function tashkentDateOf(at: Date): string {
  return new Date(at.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Berilgan lahza Toshkent vaqtida `HH:MM` — push matnlari uchun ("07:05 da jo'nash"). */
export function formatTashkentTime(at: Date): string {
  return new Date(at.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(11, 16);
}
