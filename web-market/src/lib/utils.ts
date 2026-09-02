import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNowStrict } from 'date-fns';
import { uz } from 'date-fns/locale';

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

/** "5 daqiqa oldin" — buyurtma qachon kelganini bir qarashda aytadi. */
export function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true, locale: uz });
  } catch {
    return formatTime(dateStr);
  }
}

/** Sana + vaqt, uz lokalida — harakatlar tarixi kabi ro'yxatlar uchun. */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })} ${formatTime(dateStr)}`;
}

/**
 * Klient tomonida CSV yuklab olish (backend'siz). BOM qo'shiladi — Excel
 * UTF-8 matnni shusiz noto'g'ri ochadi.
 */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '\ufeff' + rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
