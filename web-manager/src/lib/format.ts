import { format, formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';

/**
 * Shared display formatting. Everything the operator reads — money, dates,
 * durations, ids — goes through here so the panel stays consistent and the
 * Uzbek locale lives in exactly one place.
 */

/** 125000 -> "125 000" */
export function groupDigits(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return value < 0 ? `-${grouped}` : grouped;
}

/** 125000 -> "125 000 soʻm" */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${groupDigits(value)} soʻm`;
}

/** Same as formatMoney but prefixed for not-yet-final prices. */
export function formatMoneyApprox(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `~${formatMoney(value)}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return groupDigits(value);
}

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "3 daqiqa oldin" */
export function formatRelative(value: string | number | Date | null | undefined): string {
  if (value == null) return '—';
  const d = toDate(value);
  if (!d) return '—';
  return formatDistanceToNow(d, { addSuffix: true, locale: uz });
}

/** "14:32" */
export function formatTime(value: string | number | Date | null | undefined): string {
  if (value == null) return '—';
  const d = toDate(value);
  return d ? format(d, 'HH:mm', { locale: uz }) : '—';
}

/** "31 iyul 2026" */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null) return '—';
  const d = toDate(value);
  return d ? format(d, 'd MMMM yyyy', { locale: uz }) : '—';
}

/** "31 iyul, 14:32" */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value == null) return '—';
  const d = toDate(value);
  return d ? format(d, 'd MMM, HH:mm', { locale: uz }) : '—';
}

/** Elapsed wall-clock time, for "how long has this been unresolved" readouts. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} soat ${minutes} daq`;
  if (minutes > 0) return `${minutes} daq ${seconds} son`;
  return `${seconds} son`;
}

/** Full uuid -> "#A1B2C3", the form dispatchers read aloud on calls. */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return `#${id.slice(-6).toUpperCase()}`;
}

/** "+998901234568" -> "+998 90 123 45 68" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  return phone;
}

/** Rating with a stable one-decimal shape ("4.8"). */
export function formatRating(rating: number | null | undefined): string {
  if (rating == null || Number.isNaN(rating)) return '—';
  return rating.toFixed(1);
}

/** Distance in km, one decimal ("4.2 km"). */
export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return '—';
  return `${km.toFixed(1)} km`;
}
