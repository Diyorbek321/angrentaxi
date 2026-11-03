import { Order, OrderStatus, ServiceType } from '../../database/entities/order.entity';

/**
 * Taksi: bekor qilish va kelmaslik qoidalari (docs/INCIDENT-POLICY.md §5) —
 * sof funksiyalar, raqamlar `platform_settings` dan.
 *
 *  · Yo'lovchi qabuldan `freeCancelMinutes` ichida va haydovchi yetib
 *    kelmagan bo'lsa — bepul. Keyin yoki ARRIVED dan keyin — `lateCancelFee`.
 *  · Haydovchi ARRIVED dan `noShowWaitMinutes` keyin "chiqmadi" belgilay
 *    oladi — `noShowFee`.
 *  · Jarima TO'LIQ haydovchiga, komissiyasiz (u vaqt va yoqilg'i sarfladi;
 *    platforma xizmat ko'rsatmadi). Yo'lovchi hamyonidan; yetmasa — qarz.
 *  · Faqat taksi va yuk (cargo). Yetkazishning o'z qoidalari bor (§2),
 *    shaharlararo — o'z bekor qilish yo'li.
 */
export interface TaxiPenaltySettings {
  freeCancelMinutes: number;
  lateCancelFee: number;
  noShowWaitMinutes: number;
  noShowFee: number;
}

export type CancelFeeReason = 'after_free_window' | 'driver_arrived';

export interface CancelFeeQuote {
  /** So'm; 0 — bepul. */
  fee: number;
  reason: CancelFeeReason | null;
  /** Bepul oyna qachon tugaydi (ISO) — faqat hali bepul bo'lsa. */
  freeUntil: string | null;
}

type PenaltyOrder = Pick<Order, 'status' | 'serviceType' | 'intercityTripId' | 'driverId' | 'acceptedAt' | 'arrivedAt'>;

const PENALTY_SERVICE_TYPES: readonly ServiceType[] = [ServiceType.TAXI, ServiceType.CARGO];

export function penaltiesApply(order: Pick<Order, 'serviceType' | 'intercityTripId'>): boolean {
  return PENALTY_SERVICE_TYPES.includes(order.serviceType) && !order.intercityTripId;
}

const FREE: CancelFeeQuote = { fee: 0, reason: null, freeUntil: null };

/** Yo'lovchi HOZIR bekor qilsa qancha to'laydi. */
export function quoteCancelFee(order: PenaltyOrder, settings: TaxiPenaltySettings, now: Date): CancelFeeQuote {
  if (!penaltiesApply(order) || !order.driverId || settings.lateCancelFee <= 0) return FREE;
  if (order.status === OrderStatus.ARRIVED) {
    return { fee: settings.lateCancelFee, reason: 'driver_arrived', freeUntil: null };
  }
  if (order.status !== OrderStatus.ACCEPTED || !order.acceptedAt) return FREE;
  const freeUntil = new Date(new Date(order.acceptedAt).getTime() + settings.freeCancelMinutes * 60_000);
  if (now.getTime() <= freeUntil.getTime()) return { ...FREE, freeUntil: freeUntil.toISOString() };
  return { fee: settings.lateCancelFee, reason: 'after_free_window', freeUntil: null };
}

export type NoShowCheck =
  | { allowed: true; fee: number }
  | { allowed: false; reason: 'not_arrived' | 'too_early' | 'not_taxi'; waitUntil: string | null };

/** Haydovchi "yo'lovchi chiqmadi" belgilay oladimi (server vaqti bo'yicha). */
export function checkNoShow(order: PenaltyOrder, settings: TaxiPenaltySettings, now: Date): NoShowCheck {
  if (!penaltiesApply(order)) return { allowed: false, reason: 'not_taxi', waitUntil: null };
  if (order.status !== OrderStatus.ARRIVED || !order.arrivedAt) {
    return { allowed: false, reason: 'not_arrived', waitUntil: null };
  }
  const waitUntil = new Date(new Date(order.arrivedAt).getTime() + settings.noShowWaitMinutes * 60_000);
  if (now.getTime() < waitUntil.getTime()) {
    return { allowed: false, reason: 'too_early', waitUntil: waitUntil.toISOString() };
  }
  return { allowed: true, fee: Math.max(0, settings.noShowFee) };
}

/** Jarima daftar belgilari — buyurtmaga bir marta (`uq_transactions_taxi_fee`). */
export const TAXI_FEE_CHARGE_TAG = (orderId: string): string => `taxi_fee_charge_${orderId}`;
export const TAXI_FEE_PAYOUT_TAG = (orderId: string): string => `taxi_fee_payout_${orderId}`;
