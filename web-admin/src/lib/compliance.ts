/**
 * Huquqiy talablar / moliya sahifalari uchun sof yordamchilar (sana,
 * validatsiya, hisob-kitob). React va DOM'siz — `compliance.test.ts`.
 */

/** Toshkent UTC+5, yozgi vaqt yo'q. Backend sanalarni ISO qabul qiladi. */
export const TASHKENT_OFFSET = '+05:00';
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Dates ───────────────────────────────────────────────────────

/** `YYYY-MM-DD` haqiqiy kalendar sanasimi (2026-02-30 — yo'q). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** `2026-12-12` → `2026-12-12T00:00:00+05:00` (Toshkent yarim tuni). */
export function tashkentDateToIso(date: string): string {
  return `${date}T00:00:00${TASHKENT_OFFSET}`;
}

/** ISO → `<input type="date">` qiymati (Toshkent kalendari). `null` → ''. */
export function isoToTashkentDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Bugungi Toshkent sanasi `YYYY-MM-DD`. */
export function tashkentToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Joriy Toshkent oyi `YYYY-MM`. */
export function currentTashkentMonth(now: Date = new Date()): string {
  return tashkentToday(now).slice(0, 7);
}

export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/**
 * Sana oralig'i filtri (`YYYY-MM-DD`, ikkalasi ham kiritilgan kun) → API ISO.
 * `to` — keyingi kunning yarim tuni, ya'ni oxirgi kun to'liq kiradi.
 */
export function dateRangeToIso(range: { from: string | null; to: string | null }): {
  from?: string;
  to?: string;
} {
  const out: { from?: string; to?: string } = {};
  if (range.from && isIsoDate(range.from)) out.from = tashkentDateToIso(range.from);
  if (range.to && isIsoDate(range.to)) {
    const next = new Date(Date.parse(`${range.to}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
    out.to = tashkentDateToIso(next);
  }
  return out;
}

// ─── Legal enforcement ───────────────────────────────────────────

export type EnforcementPhase = 'off' | 'grace' | 'enforced';

/** `null` — majburlanmaydi; kelajak — muhlat; o'tgan/hozir — majburlanadi. */
export function enforcementPhase(enforcedFrom: string | null, now: Date = new Date()): EnforcementPhase {
  if (!enforcedFrom) return 'off';
  const ms = Date.parse(enforcedFrom);
  if (Number.isNaN(ms)) return 'off';
  return now.getTime() >= ms ? 'enforced' : 'grace';
}

/** Ishga tushirish aksiyasi hozir faolmi (`hozir < until`). */
export function isPromoActive(until: string | null, now: Date = new Date()): boolean {
  if (!until) return false;
  const ms = Date.parse(until);
  return !Number.isNaN(ms) && now.getTime() < ms;
}

// ─── Identifiers ─────────────────────────────────────────────────

/** JShShIR (PINFL) — 14 raqam. */
export function isPinfl(value: string): boolean {
  return /^\d{14}$/.test(value);
}

/** STIR (INN) — 9 raqam. */
export function isTin(value: string): boolean {
  return /^\d{9}$/.test(value);
}

/** Bo'sh — `null` (tozalash); aks holda 9 raqam bo'lishi kerak. */
export function validateOptionalTin(value: string): string | null {
  const v = value.trim();
  if (v === '') return null;
  return isTin(v) ? null : "STIR 9 ta raqamdan iborat bo'lishi kerak";
}

// ─── Wallet top-up ───────────────────────────────────────────────

export const TOPUP_LIMIT_MIN = 1000;
export const TOPUP_LIMIT_MAX = 100_000_000;
export const TOPUP_MAX_PRESETS = 6;
/** Backend `UpdateWalletTopupDto`: 0 (o'chiq) … 90 kun. */
export const TOPUP_HOLD_DAYS_MAX = 90;
/** Backend: menejer qo'lda tuzatish chegarasi 0 … 5 000 000 so'm. */
export const MANUAL_ADJUSTMENT_LIMIT_MAX = 5_000_000;

export interface TopupForm {
  walletTopupMin: number;
  walletTopupMax: number;
  walletTopupPresets: number[];
  /** Karta to'ldirishi yechishdan ushlab turiladigan kunlar (§25 #3a). */
  walletTopupHoldDays?: number;
  /** Menejer |summa| chegarasi, so'm (§25 #6). */
  manualAdjustmentManagerLimit?: number;
}

export type TopupErrors = Partial<Record<keyof TopupForm, string>>;

/** Takrorlarsiz, o'sish tartibida — backend ham shunday saqlaydi. */
export function normalizePresets(presets: readonly number[]): number[] {
  return Array.from(new Set(presets)).sort((a, b) => a - b);
}

export function validateTopupSettings(form: TopupForm): TopupErrors {
  const errors: TopupErrors = {};
  const { walletTopupMin: min, walletTopupMax: max, walletTopupPresets: presets } = form;
  const intIn = (n: number) => Number.isInteger(n) && n >= TOPUP_LIMIT_MIN && n <= TOPUP_LIMIT_MAX;
  if (!intIn(min)) errors.walletTopupMin = "1 000 dan 100 000 000 so'mgacha butun son";
  if (!intIn(max)) errors.walletTopupMax = "1 000 dan 100 000 000 so'mgacha butun son";
  else if (!errors.walletTopupMin && max < min) errors.walletTopupMax = 'Maksimum minimumdan kichik';
  if (presets.length > TOPUP_MAX_PRESETS) {
    errors.walletTopupPresets = `Ko'pi bilan ${TOPUP_MAX_PRESETS} ta tayyor summa`;
  } else if (presets.some((p) => !Number.isInteger(p) || p < min || p > max)) {
    errors.walletTopupPresets = 'Har bir tayyor summa minimum va maksimum oralig\'ida bo\'lishi kerak';
  }
  const intRange = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;
  if (form.walletTopupHoldDays !== undefined && !intRange(form.walletTopupHoldDays, TOPUP_HOLD_DAYS_MAX)) {
    errors.walletTopupHoldDays = `0 dan ${TOPUP_HOLD_DAYS_MAX} gacha butun kun`;
  }
  if (
    form.manualAdjustmentManagerLimit !== undefined &&
    !intRange(form.manualAdjustmentManagerLimit, MANUAL_ADJUSTMENT_LIMIT_MAX)
  ) {
    errors.manualAdjustmentManagerLimit = "0 dan 5 000 000 so'mgacha butun son";
  }
  return errors;
}

// ─── Shift pass refund ───────────────────────────────────────────

/**
 * Backend formulasi (§15): `floor(narx × (endsAt − max(hozir, startsAt)) /
 * (endsAt − startsAt))`; boshlanmagan — to'liq, tugagan — 0.
 */
export function estimateShiftRefund(
  pass: { price: number; startsAt: string; endsAt: string },
  now: Date = new Date()
): number {
  const start = Date.parse(pass.startsAt);
  const end = Date.parse(pass.endsAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  const from = Math.max(now.getTime(), start);
  if (from >= end) return 0;
  return Math.floor((pass.price * (end - from)) / (end - start));
}

// ─── Vendor settlement ───────────────────────────────────────────

/** Amaldagi rejimning odam o'qiydigan izohi. */
export function describeVendorSettlement(
  s: { vendorSettlementMode: 'cash' | 'wallet'; vendorWalletSettlementFrom: string | null },
  now: Date = new Date()
): string {
  const fromDate = isoToTashkentDate(s.vendorWalletSettlementFrom);
  const label = fromDate ? fromDate.split('-').reverse().join('.') : null;
  if (s.vendorSettlementMode === 'wallet') {
    return 'Hamyon rejimi qo\'lda yoqilgan: kuryer do\'konga hamyonidan o\'tkazadi.';
  }
  if (!s.vendorWalletSettlementFrom || !label) {
    return 'Naqd rejim: kuryer do\'konga naqd to\'laydi. Avtomatik o\'tish sanasi belgilanmagan.';
  }
  if (now.getTime() >= Date.parse(s.vendorWalletSettlementFrom)) {
    return `${label} dan avtomatik hamyon rejimi amalda.`;
  }
  return `Hozir naqd rejim. ${label} dan avtomatik hamyon rejimi.`;
}

// ─── Fiscal ──────────────────────────────────────────────────────

/** Ko'p cheklar `skipped` — provayder (OFD) ulanmagan, banner ko'rsatiladi. */
export function isFiscalProviderLikelyMissing(counts: Partial<Record<string, number>>): boolean {
  const values = Object.values(counts).map((n) => n ?? 0);
  const total = values.reduce((a, b) => a + b, 0);
  const skipped = counts.skipped ?? 0;
  return total > 0 && skipped * 2 > total;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Backend xato matni — `reasons`/`message` (konvert §21, [api-error.ts]). */
export { apiErrorMessage } from './api-error';
