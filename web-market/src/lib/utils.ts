import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(amount: number): string {
  return Math.round(amount).toLocaleString('ru-RU').replace(/ /g, ' ') + " so'm";
}

/** Compact form for dense tables and stat tiles, where the unit is in the label. */
export function moneyShort(amount: number): string {
  return Math.round(amount).toLocaleString('ru-RU').replace(/ /g, ' ');
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Decorative tile wash for a product/category emoji. Kept as a low-alpha hue so
 * the same value reads on both the light and the dark surface — the emoji
 * carries the recognition, the wash carries nothing semantic.
 */
export function hueTint(hue: number): { background: string } {
  return { background: `hsla(${hue}, 55%, 45%, 0.14)` };
}

/** Human-readable error text for a failed request, never an empty string. */
export function errorMessage(err: unknown, fallback = "Ma'lumotni yuklab bo'lmadi"): string {
  const fromAxios = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (fromAxios) return fromAxios;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
