import { IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { OrderStatus } from '../../database/entities/order.entity';

const MS_PER_MINUTE = 60 * 1000;

/**
 * Yo'lovchilarni yig'ish jo'nashdan qancha oldin boshlanishi mumkin. Qatnov
 * to'lgan bo'lsa — istalgan vaqtda: hamma yig'ilgan, kutishning ma'nosi yo'q.
 */
export const INTERCITY_BOARDING_WINDOW_MINUTES = 60;

/** Bandsiz qatnov jo'nash vaqtidan shuncha keyin avtomatik bekor bo'ladi. */
export const INTERCITY_NO_BOOKINGS_GRACE_MINUTES = 15;

/**
 * Band bor, lekin haydovchi yig'ishni boshlamagan — shuncha keyin qatnov
 * eskirgan hisoblanadi (`SCHEDULED_STALE_AFTER_MINUTES` bilan bir mantiq:
 * backend uzoq o'chib turgan yoki haydovchi ilovani tashlab ketgan hol).
 */
export const INTERCITY_STALE_AFTER_MINUTES = 60;

/** Haydovchi telefoni yo'lovchiga jo'nashdan shuncha oldin ochiladi. */
export const INTERCITY_CONTACT_REVEAL_MINUTES = 60;

export const INTERCITY_LIFECYCLE_REASONS = {
  wrongStatus: 'WRONG_STATUS',
  tooEarly: 'TOO_EARLY',
  noBookings: 'NO_BOOKINGS',
  passengersPending: 'PASSENGERS_PENDING',
} as const;

export type IntercityLifecycleReason =
  (typeof INTERCITY_LIFECYCLE_REASONS)[keyof typeof INTERCITY_LIFECYCLE_REASONS];

export type IntercityExpiryReason = 'no_bookings' | 'stale';

/** Yig'ishni boshlashga to'sqinlik — `null` bo'lsa ruxsat. */
export function boardingBlocker(input: {
  status: IntercityTripStatus;
  departureAt: Date;
  now: Date;
  activeBookings: number;
}): IntercityLifecycleReason | null {
  if (input.status !== IntercityTripStatus.OPEN && input.status !== IntercityTripStatus.FULL) {
    return INTERCITY_LIFECYCLE_REASONS.wrongStatus;
  }
  if (input.activeBookings < 1) return INTERCITY_LIFECYCLE_REASONS.noBookings;
  const opensAt = input.departureAt.getTime() - INTERCITY_BOARDING_WINDOW_MINUTES * MS_PER_MINUTE;
  if (input.status !== IntercityTripStatus.FULL && input.now.getTime() < opensAt) {
    return INTERCITY_LIFECYCLE_REASONS.tooEarly;
  }
  return null;
}

/**
 * Jo'nashga to'sqinlik. Har bir faol yo'lovchi OLINGAN bo'lishi shart
 * (ARRIVED yoki allaqachon IN_PROGRESS). Olinmagan yo'lovchi bilan jo'nash
 * uni yo'lda qoldirib, keyin "yakunlangan" safar uchun pul yozardi — shuning
 * uchun haydovchi avval uni olishi yoki "kelmadi" deb belgilashi kerak.
 */
export function departBlocker(
  tripStatus: IntercityTripStatus,
  bookingStatuses: readonly OrderStatus[],
): IntercityLifecycleReason | null {
  if (tripStatus !== IntercityTripStatus.BOARDING) return INTERCITY_LIFECYCLE_REASONS.wrongStatus;
  const live = bookingStatuses.filter(
    (status) => status !== OrderStatus.CANCELLED && status !== OrderStatus.COMPLETED,
  );
  if (live.length === 0) return INTERCITY_LIFECYCLE_REASONS.noBookings;
  const pending = live.some(
    (status) => status !== OrderStatus.ARRIVED && status !== OrderStatus.IN_PROGRESS,
  );
  return pending ? INTERCITY_LIFECYCLE_REASONS.passengersPending : null;
}

/**
 * Cron: qatnov avtomatik bekor qilinadimi va nima sababdan.
 * Yo'lga chiqqan (`boarding`/`in_progress`) qatnovga HECH QACHON tegilmaydi —
 * haydovchi yo'lovchilar bilan yo'lda bo'lishi mumkin.
 */
export function expiryReasonFor(
  trip: { status: IntercityTripStatus; departureAt: Date },
  activeBookings: number,
  now: Date,
): IntercityExpiryReason | null {
  if (trip.status !== IntercityTripStatus.OPEN && trip.status !== IntercityTripStatus.FULL) {
    return null;
  }
  const lateByMs = now.getTime() - trip.departureAt.getTime();
  if (activeBookings === 0 && lateByMs >= INTERCITY_NO_BOOKINGS_GRACE_MINUTES * MS_PER_MINUTE) {
    return 'no_bookings';
  }
  if (lateByMs >= INTERCITY_STALE_AFTER_MINUTES * MS_PER_MINUTE) return 'stale';
  return null;
}

/**
 * Yo'lovchi haydovchi telefonini ko'radimi. Oddiy safarda telefon haydovchi
 * qabul qilganda ochiladi; bu yerda band kunlar oldin bo'lishi mumkin —
 * raqam erta ochilsa, kelishuv platformadan tashqariga ko'chadi.
 */
export function revealsDriverContact(
  status: IntercityTripStatus,
  departureAt: Date,
  now: Date,
): boolean {
  if (status === IntercityTripStatus.BOARDING || status === IntercityTripStatus.IN_PROGRESS) {
    return true;
  }
  if (status !== IntercityTripStatus.OPEN && status !== IntercityTripStatus.FULL) return false;
  return departureAt.getTime() - now.getTime() <= INTERCITY_CONTACT_REVEAL_MINUTES * MS_PER_MINUTE;
}
