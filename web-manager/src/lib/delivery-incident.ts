import { t } from '@/locales';
import type { OrderStatus } from './constants';

/**
 * Yetkazish hodisalari — docs/INCIDENT-POLICY.md §2, backend 7797280.
 *
 * Status enum o'zgarmagan: "qaytarilmoqda" = in_progress + deliveryFailedAt,
 * "qaytarildi" = completed + deliveryOutcome='returned'. Panel shu ikki
 * holatni maydonlardan o'zi chiqaradi.
 */

/** Topshirish kodi va qaytarish faqat shu xizmatlarda (taksi/yukda yo'q). */
export const HANDOVER_SERVICES = ['parcel', 'food', 'market'] as const;

export function isHandoverService(serviceType: string | null | undefined): boolean {
  return (HANDOVER_SERVICES as readonly string[]).includes(serviceType ?? '');
}

/** Backend `DeliveryFailedDto.reason` enum'i bilan bir xil tartib. */
export const DELIVERY_FAILURE_REASONS = ['customer_absent', 'customer_refused', 'unreachable'] as const;
export type DeliveryFailureReason = (typeof DELIVERY_FAILURE_REASONS)[number];

export function deliveryFailureReasonLabels(): Record<DeliveryFailureReason, string> {
  return t().lib.deliveryIncident.reasons;
}

export type DeliveryState = 'returning' | 'returned';

/** Safarning yangi maydonlari — eski javobda bo'lmasligi mumkin. */
export interface DeliveryFields {
  status: OrderStatus;
  serviceType?: string;
  deliveryFailedAt?: string | null;
  deliveryOutcome?: 'returned' | null;
}

export function deliveryState(order: DeliveryFields): DeliveryState | null {
  if (order.status === 'in_progress' && order.deliveryFailedAt) return 'returning';
  if (order.status === 'completed' && order.deliveryOutcome === 'returned') return 'returned';
  return null;
}

/** "Yetkazib bo'lmadi → qaytarish" tugmasi ko'rinadimi. */
export function canMarkDeliveryFailed(order: DeliveryFields): boolean {
  return (
    order.status === 'in_progress' && isHandoverService(order.serviceType) && !order.deliveryFailedAt
  );
}

/** Backend DTO: `@IsNotEmpty @MaxLength(500)`; panel bo'sh joyli izohni ham to'xtatadi. */
export const INCIDENT_NOTE_MIN = 3;
export const INCIDENT_NOTE_MAX = 500;

/** Xato matni yoki `null` (izoh yaroqli). */
export function validateIncidentNote(value: string): string | null {
  const text = value.trim();
  const m = t().lib.deliveryIncident;
  if (text.length < INCIDENT_NOTE_MIN) return m.noteRequired;
  if (text.length > INCIDENT_NOTE_MAX) return m.noteMax(INCIDENT_NOTE_MAX);
  return null;
}

// ─── Osilib qolgan yetkazishlar ────────────────────────────────────────────

export type StuckReason = 'too_long' | 'stale_location';

/** GET /orders/exceptions/stuck-deliveries va socket `delivery:stuck` payload'i. */
export interface StuckDelivery {
  orderId: string;
  status: OrderStatus;
  serviceType: string;
  returning: boolean;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  startedAt: string | null;
  locationUpdatedAt: string | null;
  reasons: StuckReason[];
}

export function stuckReasonLabels(): Record<StuckReason, string> {
  return t().lib.deliveryIncident.stuckReasons;
}

/** Socket'dan kelgan yozuv: bor bo'lsa joyida almashtiradi, yo'q bo'lsa boshiga qo'shadi. */
export function upsertStuckDelivery(list: readonly StuckDelivery[], item: StuckDelivery): StuckDelivery[] {
  const exists = list.some((s) => s.orderId === item.orderId);
  return exists ? list.map((s) => (s.orderId === item.orderId ? item : s)) : [item, ...list];
}

// ─── Kartali qaytarishlar ───────────────────────────────────────────────────

/** GET /delivery/refunds-pending — mijozga qo'lda qaytarilishi kerak bo'lgan summa. */
export interface PendingRefund {
  kind: 'food' | 'market';
  vendorOrderId: string;
  vendorName: string;
  /** Sotuvchi telefoni va kuryer safari (backend 049+; eski javobda yo'q). */
  vendorPhone?: string | null;
  deliveryOrderId?: string | null;
  customerPhone: string | null;
  totalPrice: number;
  returnCharge: number;
  refundDue: number;
  returnedAt: string | null;
}
