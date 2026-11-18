import { ERROR_CODES, ErrorReason, codedBadRequest } from '../../common/errors/coded-error';

/**
 * Shaharlararo yo'nalish narxlari qoidalari — sof funksiyalar.
 *
 * Narxlar QAT'IY (taksometr yo'q): yo'lovchi band qilishdan oldin aniq
 * summani ko'radi. Shuning uchun noto'g'ri kiritilgan narx (butun mashina
 * bitta o'rindiqdan arzon va h.k.) darhol yo'lovchining ekraniga chiqadi —
 * u saqlanishidan oldin shu yerda ushlanadi.
 *
 * Bazadagi CHECK'lar faqat "narx > 0" va "komfort juftligi to'liq" ni
 * kafolatlaydi; narxlar orasidagi munosabat (butun mashina ≥ o'rindiq,
 * Comfort ≥ Start) bu yerda — CHECK'da u xato xabarisiz 500 bo'lib chiqardi.
 */
export interface IntercityRoutePrices {
  seatPrice: number;
  wholeCarPrice: number;
  comfortSeatPrice: number | null;
  comfortWholeCarPrice: number | null;
  seatsDefault: number;
}

/** Yengil avtomobil + miniven. 8 dan ko'pi — avtobus, boshqa litsenziya. */
export const INTERCITY_SEATS_MIN = 1;
export const INTERCITY_SEATS_MAX = 8;

/** `reasons[].code` qiymatlari — kontrakt: o'zgartirmang, faqat qo'shing. */
export const INTERCITY_ROUTE_REASONS = {
  seatPriceNotPositive: 'SEAT_PRICE_NOT_POSITIVE',
  wholeCarBelowSeat: 'WHOLE_CAR_BELOW_SEAT',
  comfortPairIncomplete: 'COMFORT_PAIR_INCOMPLETE',
  comfortSeatBelowStandard: 'COMFORT_SEAT_BELOW_STANDARD',
  comfortWholeCarBelowStandard: 'COMFORT_WHOLE_CAR_BELOW_STANDARD',
  comfortWholeCarBelowComfortSeat: 'COMFORT_WHOLE_CAR_BELOW_COMFORT_SEAT',
  seatsOutOfRange: 'SEATS_OUT_OF_RANGE',
} as const;

const reason = (code: string, message: string): ErrorReason => ({ code, message });

function comfortReasons(prices: IntercityRoutePrices): ErrorReason[] {
  const { comfortSeatPrice, comfortWholeCarPrice } = prices;
  if (comfortSeatPrice === null && comfortWholeCarPrice === null) return [];
  if (comfortSeatPrice === null || comfortWholeCarPrice === null) {
    return [
      reason(
        INTERCITY_ROUTE_REASONS.comfortPairIncomplete,
        "Comfort uchun o'rindiq va butun mashina narxi birga kiritiladi (yoki ikkalasi ham bo'sh)",
      ),
    ];
  }
  return [
    ...(comfortSeatPrice < prices.seatPrice
      ? [
          reason(
            INTERCITY_ROUTE_REASONS.comfortSeatBelowStandard,
            "Comfort o'rindiq narxi Start o'rindiqdan arzon bo'lishi mumkin emas",
          ),
        ]
      : []),
    ...(comfortWholeCarPrice < prices.wholeCarPrice
      ? [
          reason(
            INTERCITY_ROUTE_REASONS.comfortWholeCarBelowStandard,
            "Comfort butun mashina narxi Start'dan arzon bo'lishi mumkin emas",
          ),
        ]
      : []),
    ...(comfortWholeCarPrice < comfortSeatPrice
      ? [
          reason(
            INTERCITY_ROUTE_REASONS.comfortWholeCarBelowComfortSeat,
            "Comfort butun mashina narxi bitta Comfort o'rindiqdan arzon bo'lishi mumkin emas",
          ),
        ]
      : []),
  ];
}

/**
 * Buzilgan qoidalar ro'yxati; bo'sh — narxlar to'g'ri. Hammasi BIRDANIGA
 * qaytadi: admin bitta xatoni tuzatib, keyingisiga qayta urilmasin.
 */
export function validateIntercityRoutePrices(prices: IntercityRoutePrices): ErrorReason[] {
  const seatsValid =
    Number.isInteger(prices.seatsDefault) &&
    prices.seatsDefault >= INTERCITY_SEATS_MIN &&
    prices.seatsDefault <= INTERCITY_SEATS_MAX;

  return [
    ...(prices.seatPrice > 0
      ? []
      : [reason(INTERCITY_ROUTE_REASONS.seatPriceNotPositive, "O'rindiq narxi 0 dan katta bo'lishi kerak")]),
    ...(prices.wholeCarPrice >= prices.seatPrice
      ? []
      : [
          reason(
            INTERCITY_ROUTE_REASONS.wholeCarBelowSeat,
            "Butun mashina narxi bitta o'rindiqdan arzon bo'lishi mumkin emas",
          ),
        ]),
    ...comfortReasons(prices),
    ...(seatsValid
      ? []
      : [
          reason(
            INTERCITY_ROUTE_REASONS.seatsOutOfRange,
            `O'rindiqlar soni ${INTERCITY_SEATS_MIN}–${INTERCITY_SEATS_MAX} oralig'ida butun son bo'lishi kerak`,
          ),
        ]),
  ];
}

/** Narxlar qoidaga zid bo'lsa `INTERCITY_ROUTE_INVALID` (400) + `reasons[]`. */
export function assertIntercityRoutePrices(prices: IntercityRoutePrices): void {
  const reasons = validateIntercityRoutePrices(prices);
  if (reasons.length > 0) {
    throw codedBadRequest(ERROR_CODES.intercityRouteInvalid, "Yo'nalish narxlari noto'g'ri", { reasons });
  }
}
