/**
 * Yo'lovchi hamyon qarzi (docs/INCIDENT-POLICY.md §7).
 * Backend: `GET/POST /payments/users/:id/wallet-debt[/close]`.
 */
import { apiErrorMessage } from './api-error';
import { manualAdjustmentLimitMessage } from './balance-adjustment';

export type WalletDebtReason = 'ride_shortfall' | 'delivery_refused' | 'late_cancel' | 'no_show' | 'incident_penalty';
export type WalletDebtCloseMode = 'cash_received' | 'write_off';

export interface WalletDebtItem {
  id: string;
  amount: number;
  reason: WalletDebtReason;
  orderId: string | null;
  createdAt: string;
}

export interface WalletDebtView {
  total: number;
  items: WalletDebtItem[];
}

/** Backend DTO: sabab 3–500 belgi. */
export const WALLET_DEBT_REASON_MIN = 3;
export const WALLET_DEBT_REASON_MAX = 500;

export function isDebtCloseReasonValid(raw: string): boolean {
  const length = raw.trim().length;
  return length >= WALLET_DEBT_REASON_MIN && length <= WALLET_DEBT_REASON_MAX;
}

/** Tanlangan qarzlar yig'indisi; `ids` bo'lmasa — hammasi. */
export function selectedDebtTotal(items: readonly WalletDebtItem[], ids: readonly string[] | null): number {
  const chosen = ids ? items.filter((item) => ids.includes(item.id)) : items;
  return chosen.reduce((sum, item) => sum + item.amount, 0);
}

/** Yopish xatosi: limit — aniq matn, aks holda server/zaxira. */
export function debtCloseErrorMessage(err: unknown, fallback: string): string {
  return manualAdjustmentLimitMessage(err) ?? apiErrorMessage(err, fallback);
}
