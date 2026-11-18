// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { format, formatDistanceToNow } from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { getLocale } from '@/lib/i18n/core';
import { kitT } from '@/lib/i18n/kit-messages';

/**
 * Display formatting for all four panels. Everything an operator reads —
 * money, numbers, dates, durations, phones, names — goes through here so the
 * panels stay consistent and the locale lives in exactly one place. Wording
 * follows the active panel locale (`getLocale()`): Uzbek by default, Russian
 * when the operator switches ("43 500 сум", "2 д 3 ч"). Uzbek output must stay
 * byte-identical — e2e tests read it.
 *
 * Rules (docs/design/PANEL-UI-KIT.md §3, §7):
 *  - Missing value → "—" (em dash). Never "null", "undefined", "NaN".
 *  - Money is NOT monospace: render the result in a `.num` element.
 *  - Durations never go negative: an overdue timer reads "2 kun 3 soat kechikdi".
 */

export const EMPTY = '—';

type DateInput = string | number | Date | null | undefined;

/** date-fns locale for the active panel locale. */
function dfLocale(): DateFnsLocale {
  return getLocale() === 'ru' ? ru : uz;
}

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return isNum(n) ? n : null;
}

/** 125000 -> "125 000" (rounded to an integer; thin grouping with a plain space). */
export function groupDigits(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return value < 0 && rounded !== 0 ? `-${grouped}` : grouped;
}

export interface MoneyOptions {
  /** Append " soʻm" / " сум" (default true). Turn off when the unit is rendered separately. */
  currency?: boolean;
  /** Prefix "+" for positive values — for ledgers/adjustments. */
  signed?: boolean;
}

/** 43500 -> "43 500 soʻm". Accepts numeric strings (API decimals). */
export function formatMoney(
  value: number | string | null | undefined,
  options: MoneyOptions = {}
): string {
  const n = toNumber(value);
  if (n == null) return EMPTY;
  const { currency = true, signed = false } = options;
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${groupDigits(n)}${currency ? ` ${kitT().format.currency}` : ''}`;
}

/** Not-yet-final price: "~43 500 soʻm". */
export function formatMoneyApprox(value: number | string | null | undefined): string {
  const formatted = formatMoney(value);
  return formatted === EMPTY ? EMPTY : `~${formatted}`;
}

/** 1234567 -> "1 234 567"; with `decimals` keeps a fixed fraction ("4.5"). */
export function formatNumber(
  value: number | string | null | undefined,
  decimals = 0
): string {
  const n = toNumber(value);
  if (n == null) return EMPTY;
  if (decimals <= 0) return groupDigits(n);
  const [int, frac] = Math.abs(n).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '-' : ''}${grouped}.${frac}`;
}

/** 0.125 -> "12.5%" when `ratio`, else 12.5 -> "12.5%". */
export function formatPercent(
  value: number | null | undefined,
  { ratio = false, decimals = 1 }: { ratio?: boolean; decimals?: number } = {}
): string {
  if (!isNum(value)) return EMPTY;
  const pct = ratio ? value * 100 : value;
  const fixed = pct.toFixed(decimals).replace(/\.0+$/, '');
  return `${fixed}%`;
}

function toDate(value: DateInput): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "3 daqiqa oldin" */
export function formatRelative(value: DateInput): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return formatDistanceToNow(d, { addSuffix: true, locale: dfLocale() });
}

/** "14:32" */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  return d ? format(d, 'HH:mm', { locale: dfLocale() }) : EMPTY;
}

/** "31 iyul 2026" */
export function formatDate(value: DateInput): string {
  const d = toDate(value);
  return d ? format(d, 'd MMMM yyyy', { locale: dfLocale() }) : EMPTY;
}

/** "31.07.2026" — dense table cells. */
export function formatDateShort(value: DateInput): string {
  const d = toDate(value);
  return d ? format(d, 'dd.MM.yyyy') : EMPTY;
}

/** "31 iyul, 14:32" (`withYear` → "31 iyul 2026, 14:32"). */
export function formatDateTime(value: DateInput, { withYear = false } = {}): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return format(d, withYear ? 'd MMM yyyy, HH:mm' : 'd MMM, HH:mm', { locale: dfLocale() });
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Human duration, two largest units: "2 kun 3 soat", "1 soat 5 daq",
 * "4 daq 10 son", "12 son" (ru: "2 д 3 ч", "1 ч 5 мин", "4 мин 10 с").
 * Never negative, never "hh:mm" with 6 digits.
 */
export function humanizeDuration(ms: number): string {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY);
  const hours = Math.floor((abs % DAY) / HOUR);
  const minutes = Math.floor((abs % HOUR) / MINUTE);
  const seconds = Math.floor((abs % MINUTE) / SECOND);
  const u = kitT().format.units;
  if (days > 0) return hours > 0 ? `${days} ${u.day} ${hours} ${u.hour}` : `${days} ${u.day}`;
  if (hours > 0) return minutes > 0 ? `${hours} ${u.hour} ${minutes} ${u.minute}` : `${hours} ${u.hour}`;
  if (minutes > 0) return seconds > 0 ? `${minutes} ${u.minute} ${seconds} ${u.second}` : `${minutes} ${u.minute}`;
  return `${seconds} ${u.second}`;
}

/**
 * Elapsed wall-clock time ("how long has this been unresolved").
 * Positive → humanized ("2 kun 3 soat"). Negative → "—" by default, or with
 * `{ overdue: true }` treats the value as time past a deadline and reads
 * "2 kun 3 soat kechikdi".
 */
export function formatDuration(
  ms: number | null | undefined,
  { overdue = false }: { overdue?: boolean } = {}
): string {
  if (!isNum(ms)) return EMPTY;
  if (ms < 0) return overdue ? kitT().format.overdue(humanizeDuration(ms)) : EMPTY;
  return humanizeDuration(ms);
}

/** Time past a deadline: "2 kun 3 soat kechikdi" / "просрочено на 2 д 3 ч". */
export function formatOverdue(ms: number | null | undefined): string {
  if (!isNum(ms)) return EMPTY;
  return kitT().format.overdue(humanizeDuration(ms));
}

/**
 * Countdown to a deadline. Remaining ≥ 0 → "mm:ss" (or "h:mm:ss" past an
 * hour, "2 kun 3 soat" past a day). Remaining < 0 → "N … kechikdi".
 * This is what replaces the old `-126597:46` timers.
 */
export function formatCountdown(remainingMs: number | null | undefined): string {
  if (!isNum(remainingMs)) return EMPTY;
  if (remainingMs < 0) return formatOverdue(-remainingMs);
  if (remainingMs >= DAY) return humanizeDuration(remainingMs);
  const total = Math.floor(remainingMs / SECOND);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Short elapsed/limit clock for live timers: "0:42", "1:00", "12:05",
 * "1:02:03". Not for durations past a day — use formatDuration there.
 * Negative / invalid → "—".
 */
export function formatClock(ms: number | null | undefined): string {
  if (!isNum(ms) || ms < 0) return EMPTY;
  const total = Math.floor(ms / SECOND);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * formatPrepTimer — oshxona taymeri — platforma ko'rayotgan soat. Muddat = buyurtma vaqti +
 * eng uzoq tayyorlanadigan taomning `prepMinutes`i.
 *
 *  - vaqt bor   → "12:30" (qolgan vaqt)
 *  - oxirgi 5 daq → "soon"
 *  - kechikdi   → "Kechikmoqda · 2 soat 15 daq" — hech qachon "-126597:46"
 *  - 24 soatdan eski → taymer ma'nosiz, buyurtma sanasi ko'rsatiladi
 */
export type PrepTimerState = 'ok' | 'soon' | 'late' | 'stale';

export interface PrepTimer {
  state: PrepTimerState;
  /** Ko'rinadigan matn. */
  text: string;
  /** Ekran o'quvchi uchun to'liq jumla. */
  label: string;
}

export interface PrepTimerOrder {
  status: string;
  createdAt: string;
  items: ReadonlyArray<{ prepMinutes: number }>;
}

export const PREP_SOON_MS = 5 * MINUTE;
export const PREP_STALE_AFTER_MS = DAY;

export function formatPrepTimer(order: PrepTimerOrder, now: number): PrepTimer | null {
  if (order.status !== 'new' && order.status !== 'preparing') return null;
  const placed = new Date(order.createdAt).getTime();
  if (Number.isNaN(placed)) return null;

  const prepMinutes = Math.max(1, ...order.items.map((i) => i.prepMinutes || 0));
  const remaining = placed + prepMinutes * MINUTE - now;

  const m = kitT().format.prep;

  if (now - placed > PREP_STALE_AFTER_MS) {
    const at = formatDateTime(placed);
    return { state: 'stale', text: at, label: m.staleLabel(at) };
  }
  if (remaining < 0) {
    const late = humanizeDuration(-remaining);
    return { state: 'late', text: m.lateText(late), label: m.lateLabel(late) };
  }
  const left = formatCountdown(remaining);
  return {
    state: remaining <= PREP_SOON_MS ? 'soon' : 'ok',
    text: left,
    label: m.leftLabel(left),
  };
}

/**
 * Order/entity reference used in EVERY panel (tables, drawers, toasts, CSV):
 * "#" + the FIRST 6 characters, lowercase — "#a1b2c3". Render it `font-mono`.
 * Vendors, dispatchers and couriers read this same number to each other.
 */
export function shortId(id: string | null | undefined): string {
  if (!id) return EMPTY;
  return `#${id.slice(0, 6).toLowerCase()}`;
}

/** "+998901234568" / "901234568" -> "+998 90 123 45 68". */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return EMPTY;
  const digits = phone.replace(/\D/g, '');
  const full = digits.length === 9 ? `998${digits}` : digits;
  if (full.length === 12 && full.startsWith('998')) {
    return `+${full.slice(0, 3)} ${full.slice(3, 5)} ${full.slice(5, 8)} ${full.slice(8, 10)} ${full.slice(10)}`;
  }
  return phone;
}

/** Rating with a stable one-decimal shape ("4.8"). */
export function formatRating(rating: number | null | undefined): string {
  if (!isNum(rating)) return EMPTY;
  return rating.toFixed(1);
}

/** Distance in km, one decimal ("4.2 km"). */
export function formatDistanceKm(km: number | null | undefined): string {
  if (!isNum(km)) return EMPTY;
  return `${km.toFixed(1)} km`;
}

/** "Ism kiritilmagan" / "Имя не указано" — in the active locale. */
export function nameFallback(): string {
  return kitT().format.nameFallback;
}

/**
 * @deprecated Uzbek-only constant kept so old imports compile. Use
 * `nameFallback()` — it follows the active locale.
 */
export const NAME_FALLBACK = 'Ism kiritilmagan';

function clean(part: string | null | undefined): string {
  if (part == null) return '';
  const s = String(part).trim();
  return s === 'null' || s === 'undefined' ? '' : s;
}

/**
 * Null-safe name join: fullName('Ali', null) -> "Ali";
 * fullName(null, null) -> "Ism kiritilmagan" / "Имя не указано" (or the given fallback).
 * Never produces "null null".
 */
export function fullName(
  first: string | null | undefined,
  last?: string | null,
  fallback?: string
): string {
  const joined = [clean(first), clean(last)].filter(Boolean).join(' ');
  return joined || (fallback ?? nameFallback());
}

/**
 * Up to two initials. Accepts a full name or (first, last). Returns "" when
 * there is nothing to show — callers render an icon instead, never "NN".
 */
export function initials(first: string | null | undefined, last?: string | null): string {
  const locale = getLocale();
  const parts = last === undefined ? String(first ?? '').split(/\s+/) : [first, last];
  return parts
    .map(clean)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase(locale))
    .join('');
}
