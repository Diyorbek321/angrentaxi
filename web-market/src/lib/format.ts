import { format, formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import type { ProductUnit } from './api';

/**
 * Shared display formatting. Everything the vendor reads — money, dates,
 * stock counts, ids — goes through here so the panel stays consistent and the
 * Uzbek locale lives in exactly one place.
 */

/** 125000 -> "125 000" */
export function groupDigits(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return value < 0 ? `-${grouped}` : grouped;
}

/** 125000 -> "125 000 so'm" */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${groupDigits(value)} soʻm`;
}

/** Compact form for chart axes, where the full number would not fit. */
export function formatMoneyShort(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} mln`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)} ming`;
  return String(Math.round(value));
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return groupDigits(value);
}

export const UNIT_LABEL: Record<ProductUnit, string> = {
  dona: 'dona',
  kg: 'kg',
  litr: 'litr',
};

/** 12 + "kg" -> "12 kg" */
export function formatStock(value: number, unit: ProductUnit): string {
  return `${groupDigits(value)} ${UNIT_LABEL[unit] ?? unit}`;
}

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "5 daqiqa oldin" */
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

/** "3 avgust 2026" */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null) return '—';
  const d = toDate(value);
  return d ? format(d, 'd MMMM yyyy', { locale: uz }) : '—';
}

/** "3 avg, 14:32" */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value == null) return '—';
  const d = toDate(value);
  return d ? format(d, 'd MMM, HH:mm', { locale: uz }) : '—';
}

/** Full uuid -> "#A1B2C3", the form the vendor reads aloud on the phone. */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return `#${id.slice(-6).toUpperCase()}`;
}

/** "+998901234573" -> "+998 90 123 45 73" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  return phone;
}

/** Customer object -> a printable name, never an empty string. */
export function customerName(
  customer: { firstName: string | null; lastName: string | null } | null | undefined
): string {
  if (!customer) return 'Mijoz';
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return name || 'Mijoz';
}

/** Two-letter avatar fallback. */
export function initials(...parts: Array<string | null | undefined>): string {
  const letters = parts
    .filter(Boolean)
    .map((s) => s!.trim()[0])
    .filter(Boolean)
    .join('')
    .toUpperCase();
  return letters.slice(0, 2) || 'DK';
}
