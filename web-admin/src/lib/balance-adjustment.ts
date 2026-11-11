/**
 * Qo'lda balans tuzatish (`PATCH /drivers/:id/balance`) — docs/LEGAL-COMPLIANCE.md §25 #6.
 * Backend: `amount` butun so'm, ≠ 0, |amount| ≤ 5 000 000; menejer uchun
 * |amount| ≤ `manualAdjustmentManagerLimit` (aks holda 403 `MANUAL_ADJUSTMENT_LIMIT`).
 */
import { apiErrorDetailNumber, apiErrorMessage, parseApiError } from './api-error';
import { formatMoney } from './format';
import { t } from '@/locales';

/** Backend DTO chegarasi (admin uchun ham). */
export const BALANCE_ADJUSTMENT_MAX = 5_000_000;

/** Kiritilgan summani tekshiradi; to'g'ri bo'lsa `null`. */
export function validateBalanceAdjustment(raw: string): string | null {
  const m = t().drivers.balance;
  const text = raw.trim();
  if (!text) return m.nonZero;
  const amount = Number(text);
  if (Number.isNaN(amount) || amount === 0) return m.nonZero;
  if (!Number.isInteger(amount)) return m.wholeSum;
  if (Math.abs(amount) > BALANCE_ADJUSTMENT_MAX) {
    return m.maxSingle(formatMoney(BALANCE_ADJUSTMENT_MAX));
  }
  return null;
}

/** `MANUAL_ADJUSTMENT_LIMIT` — chegara bilan tushunarli matn; aks holda `null`. */
export function manualAdjustmentLimitMessage(err: unknown): string | null {
  if (parseApiError(err).code !== 'MANUAL_ADJUSTMENT_LIMIT') return null;
  const limit = apiErrorDetailNumber(err, 'limit');
  const m = t().drivers.balance;
  return limit == null ? m.managerLimitUnknown : m.managerLimit(formatMoney(limit));
}

/** Tuzatish xatosi uchun foydalanuvchi matni (kod → aniq matn, aks holda server/zaxira). */
export function balanceAdjustmentErrorMessage(err: unknown, fallback: string): string {
  return manualAdjustmentLimitMessage(err) ?? apiErrorMessage(err, fallback);
}
