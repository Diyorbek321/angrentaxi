/**
 * Sotuvchi STIR'i (INN) — 9 raqam, fiskal chekda komitent sifatida yoziladi
 * (docs/LEGAL-COMPLIANCE.md §3). Backend DTO bilan bir xil qoida: `^\d{9}$`.
 * Bo'sh qiymat — ixtiyoriy maydon, xato emas.
 */
import { t } from '@/locales';

export const TIN_LENGTH = 9;

export function tinError(value: string): string | null {
  const v = value.trim();
  if (v === '') return null;
  const m = t().tin;
  if (!/^\d+$/.test(v)) return m.digitsOnly;
  if (v.length !== TIN_LENGTH) return m.length(TIN_LENGTH, v.length);
  return null;
}
