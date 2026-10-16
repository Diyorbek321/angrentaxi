import { ErrorReason } from '../../common/errors/coded-error';
import { IntercityBookingKind, PaymentMethod } from '../../database/entities/order.entity';
import { IntercityCircle, isInsidePoint } from './intercity-geo';

/** `reasons[].code` qiymatlari — kontrakt: o'zgartirmang, faqat qo'shing. */
export const INTERCITY_BOOKING_REASONS = {
  seatsOutOfRange: 'SEATS_OUT_OF_RANGE',
  paymentUnsupported: 'PAYMENT_METHOD_UNSUPPORTED',
  pickupOutsideOrigin: 'PICKUP_OUTSIDE_ORIGIN',
  dropoffOutsideDestination: 'DROPOFF_OUTSIDE_DESTINATION',
} as const;

/**
 * Hozircha faqat naqd (naqd pilot). Karta/hamyon keyin: hamyonda oldindan
 * yechish kelmay qolgan yo'lovchi muammosini ham hal qiladi
 * (docs/CONTINGENCY-PLAN.md — shaharlararo B rejasi).
 */
const SUPPORTED_PAYMENT_METHODS: readonly PaymentMethod[] = [PaymentMethod.CASH];

interface LatLng {
  lat: number;
  lng: number;
}

export interface IntercityBookingRequest {
  kind: IntercityBookingKind;
  seats?: number;
  paymentMethod: PaymentMethod;
  pickup: LatLng;
  dropoff: LatLng;
}

export interface IntercityBookingContext {
  trip: { seatPrice: number; wholeCarPrice: number; seatsTotal: number };
  origin: IntercityCircle;
  destination: IntercityCircle;
  maxSeatsPerBooking: number;
}

export type IntercityBookingEvaluation =
  | { ok: true; seats: number; price: number }
  | { ok: false; reasons: ErrorReason[] };

const reason = (code: string, message: string): ErrorReason => ({ code, message });

function seatsFor(request: IntercityBookingRequest, context: IntercityBookingContext): number {
  // Butun mashina — qatnovning BARCHA joylari; yo'lovchi yuborgan son
  // ahamiyatsiz (o'rindiq hisobi baribir to'liq band bo'ladi).
  return request.kind === IntercityBookingKind.WHOLE_CAR
    ? context.trip.seatsTotal
    : (request.seats ?? 1);
}

/**
 * Band qilish so'rovini tekshiradi va narxni hisoblaydi.
 *
 * ⚠️ Bu yerda BO'SH JOY tekshirilmaydi — u faqat bazadagi shartli UPDATE'da
 * (`IntercityBookingsService.book`). O'qib-tekshirish ikki parallel bandga
 * oxirgi joyni ikki marta berardi.
 *
 * Barcha buzilgan qoidalar BIRDANIGA qaytadi — ilova hammasini bir ekranda
 * ko'rsatadi, yo'lovchi xatoni bittalab topmaydi.
 */
export function evaluateBooking(
  request: IntercityBookingRequest,
  context: IntercityBookingContext,
): IntercityBookingEvaluation {
  const seats = seatsFor(request, context);
  const maxSeats = Math.min(context.maxSeatsPerBooking, context.trip.seatsTotal);
  const isWholeCar = request.kind === IntercityBookingKind.WHOLE_CAR;

  const reasons: ErrorReason[] = [
    ...(!isWholeCar && (!Number.isInteger(seats) || seats < 1 || seats > maxSeats)
      ? [reason(INTERCITY_BOOKING_REASONS.seatsOutOfRange, `O'rindiqlar soni 1–${maxSeats} bo'lishi kerak`)]
      : []),
    ...(!SUPPORTED_PAYMENT_METHODS.includes(request.paymentMethod)
      ? [reason(INTERCITY_BOOKING_REASONS.paymentUnsupported, "Shaharlararo qatnov hozircha faqat naqd to'lanadi")]
      : []),
    ...(!isInsidePoint(context.origin, request.pickup.lat, request.pickup.lng)
      ? [reason(INTERCITY_BOOKING_REASONS.pickupOutsideOrigin, "Olib ketish joyi qatnov boshlanadigan shahar ichida bo'lishi kerak")]
      : []),
    ...(!isInsidePoint(context.destination, request.dropoff.lat, request.dropoff.lng)
      ? [reason(INTERCITY_BOOKING_REASONS.dropoffOutsideDestination, "Tushish joyi qatnov manzili hududida bo'lishi kerak")]
      : []),
  ];
  if (reasons.length > 0) return { ok: false, reasons };

  const price = isWholeCar ? context.trip.wholeCarPrice : seats * context.trip.seatPrice;
  return { ok: true, seats, price };
}

export interface SeatRelease {
  seats: number;
  clearsWholeCar: boolean;
}

/** Bekor qilingan band qatnovga qaytaradigan joylar. */
export function seatReleaseOf(booking: {
  bookingKind: IntercityBookingKind | null;
  seats: number | null;
}): SeatRelease {
  return {
    seats: Math.max(0, booking.seats ?? 0),
    clearsWholeCar: booking.bookingKind === IntercityBookingKind.WHOLE_CAR,
  };
}

/**
 * Bekor qilish bepul oynadan keyinmi (jo'nashga `freeCancelMinutes` dan kam
 * qolganmi). Naqd pilotda jarima yo'q — faqat belgi yoziladi.
 */
export function isLateCancel(departureAt: Date, now: Date, freeCancelMinutes: number): boolean {
  return departureAt.getTime() - now.getTime() < freeCancelMinutes * 60 * 1000;
}
