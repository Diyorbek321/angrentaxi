import { ErrorReason } from '../../common/errors/coded-error';
import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { FareBreakdown } from '../tariffs/fare-breakdown';
import { IntercityRoutePrices } from './intercity-route-policy';

/**
 * Yo'lovchi so'rovlari doskasi (10-qadam) — sof qoidalar, DB yo'q.
 *
 * Yo'lovchi qatnov topmasa so'rov qoldiradi: yo'nalish, vaqt ORALIG'I
 * ("bugun 14:00–16:00"), joylar va manzillar. Narx — odatdagi qat'iy tarif
 * (joy × narx + shahar ichiga davom km haqi); haydovchi tez topilmasa
 * yo'lovchi narxni o'zi oshiradi (`bonus`). Haydovchi qabul qilsa so'rov
 * uning qatnoviga band bo'lib tushadi (`IntercityRequestsService.accept`).
 */

/** `reasons[].code` qiymatlari — kontrakt: o'zgartirmang, faqat qo'shing. */
export const INTERCITY_REQUEST_REASONS = {
  windowInvalid: 'WINDOW_INVALID',
  windowTooShort: 'WINDOW_TOO_SHORT',
  windowTooLong: 'WINDOW_TOO_LONG',
  windowTooSoon: 'WINDOW_TOO_SOON',
  windowTooFar: 'WINDOW_TOO_FAR',
  comfortNotOffered: 'COMFORT_NOT_OFFERED',
  bonusStep: 'BONUS_STEP',
  bonusNotHigher: 'BONUS_NOT_HIGHER',
  bonusTooHigh: 'BONUS_TOO_HIGH',
  departureOutsideWindow: 'DEPARTURE_OUTSIDE_WINDOW',
} as const;

/**
 * Oraliq kamida shuncha — undan tor oraliqqa haydovchi topilmaydi va
 * so'rov deyarli darhol eskiradi.
 */
export const INTERCITY_REQUEST_WINDOW_MIN_MINUTES = 30;

/** "Ertalabdan kechgacha" kabi oraliq haydovchiga hech narsa demaydi. */
export const INTERCITY_REQUEST_WINDOW_MAX_HOURS = 12;

/**
 * Oraliq oxirigacha kamida shuncha qolishi kerak — haydovchi so'rovni
 * ko'rib, yo'lovchini olishga ulgursin.
 */
export const INTERCITY_REQUEST_MIN_REMAINING_MINUTES = 30;

/**
 * Qabul qilingan so'rov uchun jo'nash hozirdan kamida shuncha keyin —
 * haydovchi Angrenning narigi chekkasidan yetib kelsin. Oddiy e'londagi
 * 30 daqiqadan qisqa: yo'lovchi allaqachon kutyapti.
 */
export const INTERCITY_REQUEST_DEPARTURE_LEAD_MINUTES = 10;

/** Narx oshirish qadami — naqd pilotda mayda qaytim bo'lmasin. */
export const INTERCITY_REQUEST_BONUS_STEP = 1000;

/**
 * Oshirish asosiy narxdan oshmaydi (narx ko'pi bilan ikki barobar). Aks
 * holda xato bosilgan "+" yo'lovchini Yandex'dan qimmatga tushirardi.
 */
export function maxRequestBonus(basePrice: number): number {
  return Math.floor(Math.max(0, basePrice) / INTERCITY_REQUEST_BONUS_STEP) * INTERCITY_REQUEST_BONUS_STEP;
}

const reason = (code: string, message: string): ErrorReason => ({ code, message });

const MINUTE_MS = 60_000;

export interface RequestWindowInput {
  windowStart: Date;
  windowEnd: Date;
  now: Date;
  maxAheadDays: number;
}

/** Vaqt oralig'i qoidalari — barcha buzilganlari birdaniga. */
export function evaluateRequestWindow(input: RequestWindowInput): ErrorReason[] {
  const start = input.windowStart.getTime();
  const end = input.windowEnd.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [reason(INTERCITY_REQUEST_REASONS.windowInvalid, "Vaqt oralig'i noto'g'ri: oxiri boshidan keyin bo'lishi kerak")];
  }
  const length = end - start;
  const now = input.now.getTime();
  return [
    ...(length < INTERCITY_REQUEST_WINDOW_MIN_MINUTES * MINUTE_MS
      ? [reason(INTERCITY_REQUEST_REASONS.windowTooShort, `Vaqt oralig'i kamida ${INTERCITY_REQUEST_WINDOW_MIN_MINUTES} daqiqa bo'lishi kerak`)]
      : []),
    ...(length > INTERCITY_REQUEST_WINDOW_MAX_HOURS * 60 * MINUTE_MS
      ? [reason(INTERCITY_REQUEST_REASONS.windowTooLong, `Vaqt oralig'i ko'pi bilan ${INTERCITY_REQUEST_WINDOW_MAX_HOURS} soat`)]
      : []),
    ...(end < now + INTERCITY_REQUEST_MIN_REMAINING_MINUTES * MINUTE_MS
      ? [reason(INTERCITY_REQUEST_REASONS.windowTooSoon, `Oraliq oxirigacha kamida ${INTERCITY_REQUEST_MIN_REMAINING_MINUTES} daqiqa qolishi kerak`)]
      : []),
    ...(start > now + input.maxAheadDays * 24 * 60 * MINUTE_MS
      ? [reason(INTERCITY_REQUEST_REASONS.windowTooFar, `So'rovni ko'pi bilan ${input.maxAheadDays} kun oldinga qoldirish mumkin`)]
      : []),
  ];
}

/** So'rov klassi bo'yicha yo'nalish narxlari; Comfort yo'q bo'lsa — `null`. */
export function routePricesFor(
  route: IntercityRoutePrices,
  tripClass: IntercityTripClass,
): { seatPrice: number; wholeCarPrice: number } | null {
  if (tripClass !== IntercityTripClass.COMFORT) {
    return { seatPrice: route.seatPrice, wholeCarPrice: route.wholeCarPrice };
  }
  if (route.comfortSeatPrice === null || route.comfortWholeCarPrice === null) return null;
  return { seatPrice: route.comfortSeatPrice, wholeCarPrice: route.comfortWholeCarPrice };
}

/**
 * Yangi oshirish summasi. Faqat YUQORIGA: pasaytirish allaqachon ko'rgan
 * haydovchini aldardi ("50 000 deb ko'rdim, qabul qilsam 40 000").
 */
export function evaluateBonusRaise(current: number, next: number, basePrice: number): ErrorReason[] {
  const max = maxRequestBonus(basePrice);
  return [
    ...(!Number.isInteger(next) || next % INTERCITY_REQUEST_BONUS_STEP !== 0
      ? [reason(INTERCITY_REQUEST_REASONS.bonusStep, `Narx ${INTERCITY_REQUEST_BONUS_STEP} so'm qadam bilan oshiriladi`)]
      : []),
    ...(next <= current
      ? [reason(INTERCITY_REQUEST_REASONS.bonusNotHigher, "Yangi narx avvalgisidan yuqori bo'lishi kerak")]
      : []),
    ...(next > max ? [reason(INTERCITY_REQUEST_REASONS.bonusTooHigh, `Ko'pi bilan ${max} so'm qo'shish mumkin`)] : []),
  ];
}

/**
 * Qabul qilishdagi jo'nash vaqti oraliq ichidami. Boshi hozirdan oldin
 * bo'lsa ("hoziroq") — eng ertasi hozir + {@link INTERCITY_REQUEST_DEPARTURE_LEAD_MINUTES}.
 */
export function departureFitsWindow(
  departureAt: Date,
  window: { windowStart: Date; windowEnd: Date },
  now: Date,
): boolean {
  const earliest = Math.max(
    window.windowStart.getTime(),
    now.getTime() + INTERCITY_REQUEST_DEPARTURE_LEAD_MINUTES * MINUTE_MS,
  );
  const at = departureAt.getTime();
  return at >= earliest && at <= window.windowEnd.getTime();
}

/**
 * So'rov narxiga oshirishni qo'shadi. Oshirish `surgeFare` ga tushadi —
 * u ham "talab yuqori bo'lgani uchun qo'shilgan summa", shuning uchun chek
 * invarianti (`fare-breakdown.ts`) o'zgarishsiz qoladi; `intercityBonus`
 * esa chekda qatorni "Yo'lovchi qo'shgan" deb nomlash uchun.
 */
export function withRequestBonus(fare: FareBreakdown, bonus: number): FareBreakdown {
  if (bonus <= 0) return fare;
  return {
    ...fare,
    surgeFare: fare.surgeFare + bonus,
    intercityBonus: bonus,
    total: fare.total + bonus,
  };
}
