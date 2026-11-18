import { ERROR_CODES, ErrorReason, codedBadRequest } from '../../common/errors/coded-error';

/**
 * Nuqtaning "shahar ichiga davom" sozlamasi (`intercity-extension.ts`).
 *
 * ⚠️ 60 km chegara ATAYLAB: davom — shahar ichiga kirish, viloyat bo'ylab
 * ikkinchi qatnov emas. Xato bilan kiritilgan 600 km yo'lovchiga butun
 * mamlakat bo'ylab "uyingizgacha" va'da berardi.
 */
export const INTERCITY_EXTENSION_MAX_KM = 60;
/** So'm/km yuqori chegarasi — qo'shimcha nol bilan kiritilgan xatoni ushlaydi. */
export const INTERCITY_EXTENSION_MAX_PRICE_PER_KM = 50_000;

/** `reasons[].code` qiymatlari — kontrakt: o'zgartirmang, faqat qo'shing. */
export const INTERCITY_POINT_REASONS = {
  maxKmOutOfRange: 'EXTENSION_MAX_KM_OUT_OF_RANGE',
  maxKmNotBeyondRadius: 'EXTENSION_MAX_KM_NOT_BEYOND_RADIUS',
  pricePerKmInvalid: 'EXTENSION_PRICE_PER_KM_INVALID',
  pricePerKmRequired: 'EXTENSION_PRICE_PER_KM_REQUIRED',
  comfortBelowStart: 'EXTENSION_COMFORT_BELOW_START',
} as const;

export interface IntercityPointExtension {
  radiusKm: number;
  extensionMaxKm: number;
  extensionPricePerKm: number;
  extensionComfortPricePerKm: number | null;
}

const reason = (code: string, message: string): ErrorReason => ({ code, message });

const isValidPrice = (value: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= INTERCITY_EXTENSION_MAX_PRICE_PER_KM;

function priceReasons(point: IntercityPointExtension): ErrorReason[] {
  const comfort = point.extensionComfortPricePerKm;
  const pricesValid = isValidPrice(point.extensionPricePerKm) && (comfort === null || isValidPrice(comfort));
  if (!pricesValid) {
    return [
      reason(
        INTERCITY_POINT_REASONS.pricePerKmInvalid,
        `Km narxi 0–${INTERCITY_EXTENSION_MAX_PRICE_PER_KM} so'm oralig'ida butun son bo'lishi kerak`,
      ),
    ];
  }
  return comfort !== null && comfort < point.extensionPricePerKm
    ? [reason(INTERCITY_POINT_REASONS.comfortBelowStart, "Comfort km narxi Start'dan arzon bo'lishi mumkin emas")]
    : [];
}

/** Buzilgan qoidalar; bo'sh — to'g'ri. Hammasi BIRDANIGA qaytadi. */
export function validateIntercityPointExtension(point: IntercityPointExtension): ErrorReason[] {
  const enabled = point.extensionMaxKm > 0;
  const maxKmValid = point.extensionMaxKm >= 0 && point.extensionMaxKm <= INTERCITY_EXTENSION_MAX_KM;

  return [
    ...(maxKmValid
      ? []
      : [
          reason(
            INTERCITY_POINT_REASONS.maxKmOutOfRange,
            `Davom masofasi 0–${INTERCITY_EXTENSION_MAX_KM} km bo'lishi kerak`,
          ),
        ]),
    ...(enabled && maxKmValid && point.extensionMaxKm <= point.radiusKm
      ? [
          reason(
            INTERCITY_POINT_REASONS.maxKmNotBeyondRadius,
            "Davom masofasi nuqta radiusidan katta bo'lishi kerak",
          ),
        ]
      : []),
    ...priceReasons(point),
    // Tekin davom — haydovchi shahar bo'ylab bepul yuradi; bu xato, siyosat emas.
    ...(enabled && point.extensionPricePerKm === 0
      ? [reason(INTERCITY_POINT_REASONS.pricePerKmRequired, "Davom yoqilgan bo'lsa km narxi 0 dan katta bo'lishi kerak")]
      : []),
  ];
}

/** Qoidaga zid bo'lsa `INTERCITY_POINT_INVALID` (400) + `reasons[]`. */
export function assertIntercityPointExtension(point: IntercityPointExtension): void {
  const reasons = validateIntercityPointExtension(point);
  if (reasons.length > 0) {
    throw codedBadRequest(ERROR_CODES.intercityPointInvalid, "Nuqtaning davom sozlamasi noto'g'ri", { reasons });
  }
}
