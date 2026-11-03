import { BadRequestException } from '@nestjs/common';
import {
  DeliveryFailureReason,
  OrderStatus,
  ServiceType,
} from '../../database/entities/order.entity';
import { FareBreakdown } from '../tariffs/fare-breakdown';
import { roundFare, withRounding } from '../tariffs/fare-rounding';
import { computeWaitingMinutes } from '../tariffs/waiting-charge';

/**
 * Yetkazish hodisalari — qaytarish holat mashinasi (docs/INCIDENT-POLICY.md §2).
 *
 * KUTYER SAFARI (`orders`):
 *
 *   in_progress ──"yetib keldim (manzil)"──▶ in_progress + dropoffArrivedAt
 *       │                                          │
 *       │ (kod bilan topshirdi)                    │ bepul kutish tugadi →
 *       ▼                                          ▼ "yetkazib bo'lmadi" (sabab)
 *   completed                               in_progress + deliveryFailedAt   = "qaytarilmoqda"
 *   (deliveryOutcome = null)                       │ sotuvchi/yuboruvchi/dispetcher
 *                                                  ▼ "qaytib keldi"
 *                                           completed + deliveryOutcome='returned'
 *
 * Holat enum'iga qiymat qo'shilmaydi: haydovchi bandligi, GPS izi, daromad
 * va komissiya hisobotlari, matching va ilovalarning holat tahlilchilari
 * `in_progress`/`completed` ga tayanadi.
 *
 * SOTUVCHI BUYURTMASI (food/market): `ready|shipped → returning → returned`
 * — yangi yakuniy holat, tushum yo'q.
 */

/** Topshirish kodi va "yetkazib bo'lmadi" — shu xizmatlarda. */
export const HANDOVER_CODE_SERVICE_TYPES: readonly ServiceType[] = [
  ServiceType.PARCEL,
  ServiceType.FOOD,
  ServiceType.MARKET,
];

export const DELIVERY_FAILURE_REASONS: readonly DeliveryFailureReason[] = Object.values(DeliveryFailureReason);

/** Rad etish deb sanaladigan sabablar (naqd blok) — hammasi mijoz tomonida. */
export const REFUSAL_REASONS: readonly DeliveryFailureReason[] = DELIVERY_FAILURE_REASONS;

interface ReturnableRide {
  status: OrderStatus;
  serviceType: ServiceType;
  dropoffArrivedAt?: Date | null;
  deliveryFailedAt?: Date | null;
  details?: Record<string, unknown> | null;
}

export function isHandoverRide(ride: Pick<ReturnableRide, 'serviceType'>): boolean {
  return HANDOVER_CODE_SERVICE_TYPES.includes(ride.serviceType);
}

/** Ovqat/market kuryer safari — `details` da sotuvchi buyurtmasi bor. */
export function isVendorDeliveryRide(ride: { details?: Record<string, unknown> | null }): boolean {
  return typeof ride.details?.foodOrderId === 'string' || typeof ride.details?.marketOrderId === 'string';
}

/** "Qaytarilmoqda" — yetkazib bo'lmadi, tovar qaytish yo'lida. */
export function isReturningRide(ride: Pick<ReturnableRide, 'status' | 'deliveryFailedAt'>): boolean {
  return ride.status === OrderStatus.IN_PROGRESS && ride.deliveryFailedAt != null;
}

/** "Yetib keldim (manzil)" mumkinmi. */
export function assertCanMarkDropoffArrived(ride: ReturnableRide): void {
  if (!isHandoverRide(ride)) {
    throw new BadRequestException("Bu buyurtmada topshirish manzilida kutish yo'q");
  }
  if (ride.status !== OrderStatus.IN_PROGRESS || ride.deliveryFailedAt != null) {
    throw new BadRequestException('Manzilga yetib kelganingizni faqat yetkazish davomida belgilash mumkin');
  }
}

export function parseDeliveryFailureReason(raw: unknown): DeliveryFailureReason {
  if (typeof raw !== 'string' || !DELIVERY_FAILURE_REASONS.includes(raw as DeliveryFailureReason)) {
    throw new BadRequestException("Sababni tanlang: mijoz yo'q, rad etdi yoki bog'lanib bo'lmadi");
  }
  return raw as DeliveryFailureReason;
}

/**
 * Kuryer "yetkazib bo'lmadi" ni FAQAT manzilda bepul kutish tugagach
 * belgilaydi (§2). Dispetcher (`byManager`) bu shartdan ozod — u mijoz bilan
 * gaplashib qaror qiladi.
 */
export function assertCanMarkFailed(
  ride: ReturnableRide,
  now: Date,
  freeWaitMinutes: number,
  byManager = false,
): void {
  if (!isHandoverRide(ride)) {
    throw new BadRequestException("Bu buyurtmani qaytarish yo'li bilan yopib bo'lmaydi");
  }
  if (ride.status !== OrderStatus.IN_PROGRESS) {
    throw new BadRequestException("Yetkazib bo'lmadi deb faqat yetkazish davomida belgilash mumkin");
  }
  if (ride.deliveryFailedAt != null) {
    throw new BadRequestException('Bu yetkazish allaqachon qaytarilmoqda');
  }
  if (byManager) return;
  if (!ride.dropoffArrivedAt) {
    throw new BadRequestException("Avval manzilga yetib kelganingizni belgilang va mijozni kuting");
  }
  const waitedMs = now.getTime() - new Date(ride.dropoffArrivedAt).getTime();
  const leftMinutes = Math.ceil((freeWaitMinutes * 60_000 - waitedMs) / 60_000);
  if (leftMinutes > 0) {
    throw new BadRequestException(`Mijozni yana ${leftMinutes} daqiqa kuting`);
  }
}

/**
 * Manzilda kutish — HAQ OLINADIGAN daqiqalar (bepullari ayirilgan). Oyna:
 * "yetib keldim (manzil)" → topshirish yoki "yetkazib bo'lmadi" (qaytish
 * yo'li kutish emas).
 */
export function dropoffWaitingMinutes(
  ride: Pick<ReturnableRide, 'dropoffArrivedAt' | 'deliveryFailedAt'>,
  completedAt: Date,
  freeWaitMinutes: number,
): number {
  return computeWaitingMinutes(ride.dropoffArrivedAt ?? null, ride.deliveryFailedAt ?? completedAt, freeWaitMinutes);
}

/** Qaytarish haqi: yetkazish haqining foizi, 100 so'mga yaxlitlangan. */
export function returnFeeOf(deliveryFare: number, returnFeePercent: number): number {
  if (!(deliveryFare > 0) || !(returnFeePercent > 0)) return 0;
  return roundFare((deliveryFare * returnFeePercent) / 100);
}

/** Tarkibga qaytarish haqini qo'shadi; jami qayta yaxlitlanadi (invariant saqlanadi). */
export function withReturnFare(breakdown: FareBreakdown, returnFare: number): FareBreakdown {
  const previous = breakdown.returnFare ?? 0;
  if (returnFare === 0 && previous === 0) return breakdown;
  return withRounding({ ...breakdown, returnFare, total: breakdown.total - previous + returnFare });
}

/**
 * Kartali ovqat/market qaytarilganda: mijoz to'lagan summadan qarzi
 * (yetkazish + kutish + qaytarish) ushlanadi, qolgani qaytariladi. Karta
 * qaytarish API'si yo'q — summa `refund_due` ga yoziladi va QO'LDA
 * bajariladi (`refund_status = 'pending'`).
 */
export function vendorReturnRefund(paid: number, owed: number): { refundDue: number; uncovered: number } {
  const safePaid = Math.max(0, paid);
  const safeOwed = Math.max(0, owed);
  return {
    refundDue: Math.max(0, safePaid - safeOwed),
    uncovered: Math.max(0, safeOwed - safePaid),
  };
}
