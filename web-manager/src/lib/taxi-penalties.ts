/**
 * Taksi: bekor qilish jarimasi, kelmaslik, safar uzildi (INCIDENT-POLICY §5).
 * Sof qoidalar (vitest) + dispetcher "Safarni uzish" so'rovi.
 */
import { apiClient, type ApiResponse, type Order } from './api';

export const INTERRUPT_REASONS = ['accident', 'breakdown', 'other'] as const;
export type InterruptReason = (typeof INTERRUPT_REASONS)[number];
export const INTERRUPT_NOTE_MAX = 300;

/** Backend `taxi-cancel-policy.ts#penaltiesApply` bilan bir xil: faqat taksi va yuk. */
const PENALTY_SERVICE_TYPES = ['taxi', 'cargo'];

type PenaltyOrder = Pick<Order, 'status' | 'serviceType' | 'driverId'> & { intercityTripId?: string | null };

export function penaltiesApply(order: Pick<PenaltyOrder, 'serviceType'> & { intercityTripId?: string | null }): boolean {
  return PENALTY_SERVICE_TYPES.includes(order.serviceType ?? 'taxi') && !order.intercityTripId;
}

/** "Safarni uzish" tugmasi: faqat boshlangan taksi/yuk safari, haydovchisi bor. */
export function canInterrupt(order: PenaltyOrder): boolean {
  return order.status === 'in_progress' && !!order.driverId && penaltiesApply(order);
}

export type TaxiOutcome =
  | { kind: 'interrupted'; reason: InterruptReason | null }
  | { kind: 'no_show'; fee: number }
  | { kind: 'late_cancel'; fee: number }
  | null;

/** Buyurtma sahifasidagi "Natija" kartasi nimani ko'rsatadi. */
export function taxiOutcome(
  order: Pick<Order, 'status' | 'cancelReason' | 'cancellationFee' | 'tripOutcome' | 'interruptReason'>,
): TaxiOutcome {
  if (order.tripOutcome === 'interrupted') return { kind: 'interrupted', reason: order.interruptReason ?? null };
  if (order.status !== 'cancelled') return null;
  const fee = Number(order.cancellationFee ?? 0);
  if (order.cancelReason === 'no_show') return { kind: 'no_show', fee };
  if (fee > 0) return { kind: 'late_cancel', fee };
  return null;
}

export async function interruptTrip(orderId: string, reason: InterruptReason, note: string): Promise<Order> {
  const trimmed = note.trim();
  const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${orderId}/manager/interrupt`, {
    reason,
    ...(trimmed ? { note: trimmed.slice(0, INTERRUPT_NOTE_MAX) } : {}),
  });
  return res.data.data;
}
