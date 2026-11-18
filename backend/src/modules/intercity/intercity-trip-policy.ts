import { ErrorReason } from '../../common/errors/coded-error';
import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { IntercityRoutePrices, INTERCITY_SEATS_MAX, INTERCITY_SEATS_MIN } from './intercity-route-policy';

/**
 * Qatnov e'lon qilish qoidalari — sof funksiyalar (DB yo'q), servis faqat
 * ma'lumotni yig'ib shu yerga beradi.
 *
 * Barcha sabablar BIRDANIGA qaytadi (yo'nalish qoidalaridagi kabi): haydovchi
 * formani bir marta tuzatsin, har tuzatishdan keyin yangi xato ko'rmasin.
 */

/** `reasons[].code` qiymatlari — kontrakt: o'zgartirmang, faqat qo'shing. */
export const INTERCITY_TRIP_REASONS = {
  departureTooSoon: 'DEPARTURE_TOO_SOON',
  departureTooFar: 'DEPARTURE_TOO_FAR',
  seatsOutOfRange: 'SEATS_OUT_OF_RANGE',
  comfortNotOffered: 'COMFORT_NOT_OFFERED',
  comfortTierTooLow: 'COMFORT_TIER_TOO_LOW',
} as const;

/**
 * Bir haydovchining ikki qatnovi orasidagi eng kam masofa.
 *
 * Angren–Toshkent ~1,5–2 soat yo'l + yo'lovchilarni yig'ish. 3 soatdan
 * yaqin ikki qatnov jismonan bajarib bo'lmaydi — ikkinchisining
 * yo'lovchilari kutib qoladi. Aynan 3 soat ruxsat: "07:00 ga borib,
 * 10:00 da qaytaman" odatiy reja.
 */
export const INTERCITY_OVERLAP_HOURS = 3;

export interface IntercityPublishInput {
  route: IntercityRoutePrices;
  departureAt: Date;
  now: Date;
  tripClass: IntercityTripClass;
  /** `undefined` — yo'nalish standarti (`seatsDefault`). */
  seatsTotal: number | undefined;
  /** `drivers.approved_tariff_tier`. */
  driverTier: number;
  /** Comfort klass uchun kerakli daraja (taksi "Komfort" tarifi darajasi). */
  comfortTier: number;
  minLeadMinutes: number;
  maxAheadDays: number;
}

export type IntercityPublishResult =
  | { ok: true; seatsTotal: number; seatPrice: number; wholeCarPrice: number }
  | { ok: false; reasons: ErrorReason[] };

const reason = (code: string, message: string): ErrorReason => ({ code, message });

function windowReasons(input: IntercityPublishInput): ErrorReason[] {
  const earliest = input.now.getTime() + input.minLeadMinutes * 60_000;
  const latest = input.now.getTime() + input.maxAheadDays * 24 * 60 * 60_000;
  const at = input.departureAt.getTime();
  if (at < earliest) {
    return [
      reason(
        INTERCITY_TRIP_REASONS.departureTooSoon,
        `Qatnov kamida ${input.minLeadMinutes} daqiqa oldin e'lon qilinadi`,
      ),
    ];
  }
  if (at > latest) {
    return [
      reason(
        INTERCITY_TRIP_REASONS.departureTooFar,
        `Qatnovni ko'pi bilan ${input.maxAheadDays} kun oldinga e'lon qilish mumkin`,
      ),
    ];
  }
  return [];
}

/**
 * Yuqori chegara — yo'nalish standarti: haydovchi jadvalida avtomobil
 * sig'imi yo'q, `seatsDefault` esa yo'nalish uchun admin tanlagan sig'im
 * (sedan 4, miniven yo'nalishi 6–7). Sedan egasi 8 joy e'lon qilsa,
 * yo'lovchilar ortiqcha band qilib qo'yardi.
 */
function seatsReasons(input: IntercityPublishInput, seats: number): ErrorReason[] {
  const max = Math.min(INTERCITY_SEATS_MAX, input.route.seatsDefault);
  if (!Number.isInteger(seats) || seats < INTERCITY_SEATS_MIN || seats > max) {
    return [
      reason(
        INTERCITY_TRIP_REASONS.seatsOutOfRange,
        `O'rindiqlar soni ${INTERCITY_SEATS_MIN}–${max} oralig'ida bo'lishi kerak`,
      ),
    ];
  }
  return [];
}

function classReasons(input: IntercityPublishInput): ErrorReason[] {
  if (input.tripClass !== IntercityTripClass.COMFORT) return [];
  if (input.route.comfortSeatPrice === null || input.route.comfortWholeCarPrice === null) {
    return [
      reason(INTERCITY_TRIP_REASONS.comfortNotOffered, "Bu yo'nalishda Comfort klass yo'q"),
    ];
  }
  if (input.driverTier < input.comfortTier) {
    return [
      reason(
        INTERCITY_TRIP_REASONS.comfortTierTooLow,
        "Comfort qatnov uchun avtomobilingiz Comfort darajasiga tasdiqlanmagan",
      ),
    ];
  }
  return [];
}

export function evaluateTripPublish(input: IntercityPublishInput): IntercityPublishResult {
  const seatsTotal = input.seatsTotal ?? input.route.seatsDefault;
  const reasons = [...windowReasons(input), ...seatsReasons(input, seatsTotal), ...classReasons(input)];
  if (reasons.length > 0) return { ok: false, reasons };

  const comfort = input.tripClass === IntercityTripClass.COMFORT;
  return {
    ok: true,
    seatsTotal,
    // `classReasons` comfort narxlari mavjudligini kafolatladi.
    seatPrice: comfort ? (input.route.comfortSeatPrice as number) : input.route.seatPrice,
    wholeCarPrice: comfort
      ? (input.route.comfortWholeCarPrice as number)
      : input.route.wholeCarPrice,
  };
}

/** Haydovchining boshqa tirik qatnovi ±3 soat ichidami — topilganini qaytaradi. */
export function findOverlappingDeparture(departureAt: Date, others: readonly Date[]): Date | null {
  const windowMs = INTERCITY_OVERLAP_HOURS * 60 * 60 * 1000;
  return (
    others.find((other) => Math.abs(other.getTime() - departureAt.getTime()) < windowMs) ?? null
  );
}
