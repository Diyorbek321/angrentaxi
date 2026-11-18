import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod } from '../../database/entities/order.entity';

/**
 * Haydovchi akkaunti yo'lovchi sifatida (bitta raqam bilan ikkala ilova,
 * `auth/session-role.ts`, 2026-11-18). Bu yerda — shu holatning firibgarlik
 * va hisob-kitob darvozalari, pul/buyurtma qatlamida (rol tekshiruvidan
 * mustaqil: flag o'chiq bo'lsa ham zarar qilmaydi).
 */

export const OWN_ORDER_MESSAGE = "O'z buyurtmangizni qabul qila olmaysiz";
export const DRIVER_ONLINE_MESSAGE =
  "Haydovchi sifatida liniyadasiz — taksi chaqirish uchun avval liniyadan chiqing";
export const DRIVER_ON_TRIP_MESSAGE = "Sizda haydovchi sifatida faol safar bor — avval uni yakunlang";
export const DRIVER_WALLET_PAYMENT_MESSAGE =
  "Haydovchi hamyoni bilan taksi uchun to'lab bo'lmaydi — naqd yoki karta tanlang";
export const PASSENGER_ORDER_ACTIVE_MESSAGE =
  "Sizda yo'lovchi sifatida faol buyurtma bor — liniyaga chiqishdan oldin uni yakunlang yoki bekor qiling";

/** Yo'lovchi tomonidan "jonli" buyurtma holatlari (rejalashtirilgan — kirmaydi). */
export const PASSENGER_LIVE_ORDER_STATUSES = [
  'created',
  'searching',
  'accepted',
  'arrived',
  'in_progress',
] as const;

export interface DriverSideState {
  /** Akkauntda haydovchi profili bor. */
  isDriver: boolean;
  isOnline: boolean;
  /** Haydovchi sifatida faol safari bor. */
  hasActiveTrip: boolean;
}

/**
 * Haydovchi akkaunti yo'lovchi sifatida buyurtma bera oladimi.
 *
 * - Liniyada yoki safarda bo'lsa — yo'q: bir vaqtda ikkala rolda bo'lish
 *   o'ziga o'zi buyurtma berish sxemasining asosi.
 * - Hamyon bilan to'lov — yo'q: uning hamyoni haydovchi daftari (komissiya,
 *   smena, yechish). Yo'lovchi to'lovi u bilan aralashmasin.
 */
export function assertDriverMayOrderAsPassenger(
  state: DriverSideState | null,
  paymentMethod: PaymentMethod | undefined,
): void {
  if (!state?.isDriver) return;
  if (state.hasActiveTrip) throw new ConflictException(DRIVER_ON_TRIP_MESSAGE);
  if (state.isOnline) throw new ConflictException(DRIVER_ONLINE_MESSAGE);
  if (paymentMethod === PaymentMethod.WALLET) {
    throw new BadRequestException(DRIVER_WALLET_PAYMENT_MESSAGE);
  }
}

/** Haydovchi o'z (yo'lovchi sifatidagi) buyurtmasining haydovchisi bo'la olmaydi. */
export function isOwnOrder(order: { passengerId: string }, driverUserId: string): boolean {
  return order.passengerId === driverUserId;
}
