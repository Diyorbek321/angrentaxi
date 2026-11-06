import { apiClient, type ApiResponse } from './api';
import type { WalletDebtCloseMode, WalletDebtView } from './wallet-debt';

export async function getPassengerDebt(userId: string): Promise<WalletDebtView> {
  const res = await apiClient.get<ApiResponse<WalletDebtView>>(`/payments/users/${userId}/wallet-debt`);
  return res.data.data;
}

export interface CloseDebtResult {
  closedCount: number;
  total: number;
  debt: WalletDebtView;
}

/** `drivers_finance` kerak; menejerga `manualAdjustmentManagerLimit` amal qiladi. */
export async function closePassengerDebt(
  userId: string,
  payload: { mode: WalletDebtCloseMode; reason: string; transactionIds?: string[] },
): Promise<CloseDebtResult> {
  const res = await apiClient.post<ApiResponse<CloseDebtResult>>(`/payments/users/${userId}/wallet-debt/close`, payload);
  return res.data.data;
}
