import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';
import { uz } from 'date-fns/locale';
import {
  formatMoney,
  formatPhone as formatPhoneCanonical,
  fullName,
  initials,
} from './format';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated use `formatMoney` from `@/lib/format` (or `<MoneyText>`). */
export function formatCurrency(amount: number | string | null | undefined): string {
  return formatMoney(amount);
}

export function formatDate(dateStr: string, fmt = 'dd.MM.yyyy HH:mm'): string {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, fmt, { locale: uz });
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string): string {
  return formatDate(dateStr, 'dd.MM.yyyy');
}

/** @deprecated use `formatPhone` from `@/lib/format`. */
export function formatPhone(phone: string | null | undefined): string {
  return formatPhoneCanonical(phone);
}

/** Null-safe (never "null null"); prefer `fullName` from `@/lib/format`. */
export function getFullName(firstName: string | null | undefined, lastName?: string | null): string {
  return fullName(firstName, lastName);
}

/** "" when there is no name — render an icon, never "NN". */
export function getInitials(firstName: string | null | undefined, lastName?: string | null): string {
  return initials(firstName, lastName ?? null);
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
