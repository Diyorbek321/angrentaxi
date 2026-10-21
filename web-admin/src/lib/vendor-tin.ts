/**
 * Sotuvchi STIR'i (komitent INN) — admin tahriri (LEGAL-COMPLIANCE §23).
 * `PATCH /food/admin/restaurants/:id/tin`, `PATCH /market/admin/stores/:id/tin`:
 * `{ tin: "123456789" | null }` — 9 raqam yoki `null` (tozalash).
 */

import { t } from '@/locales';

export type TinParseResult = { ok: true; tin: string | null } | { ok: false; error: string };

/** Bo'sh joy/chiziqchalarni olib tashlaydi; bo'sh qiymat — tozalash (`null`). */
export function parseTinInput(raw: string): TinParseResult {
  const value = raw.replace(/[\s-]/g, '');
  if (value === '') return { ok: true, tin: null };
  if (!/^\d{9}$/.test(value)) return { ok: false, error: t().vendors.tin.invalid };
  return { ok: true, tin: value };
}

/** O'zgarish bormi — bo'lmasa so'rov yuborilmaydi (backend ham hech narsa yozmaydi). */
export function isTinChanged(current: string | null | undefined, next: string | null): boolean {
  return (current ?? null) !== next;
}
