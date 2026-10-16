/**
 * Ovqat/market yetkazish sozlamalari (backend `settings/delivery-pricing.ts`,
 * docs/specs/food-market-ux-v5.md §7). Server ham xuddi shu qoidalarni
 * tekshiradi — bu yerda xato maydonning o'ziga ko'rsatiladi.
 */
export interface DeliverySettingsValues {
  /** Odatdagi yetkazish haqi, so'm. */
  deliveryFee: number;
  /** Bepul yetkazish chegarasi, so'm; 0 — o'chiq. */
  freeDeliveryFrom: number;
  deliveryEtaMinMinutes: number;
  deliveryEtaMaxMinutes: number;
}

export type DeliverySettingsErrors = Partial<Record<keyof DeliverySettingsValues, string>>;

export const DELIVERY_ETA_MIN = 5;
export const DELIVERY_ETA_MAX = 240;

function isEtaMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= DELIVERY_ETA_MIN && value <= DELIVERY_ETA_MAX;
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function validateDeliverySettings(values: DeliverySettingsValues): DeliverySettingsErrors {
  const errors: DeliverySettingsErrors = {};
  const etaRange = `${DELIVERY_ETA_MIN}–${DELIVERY_ETA_MAX} oraligʻida butun daqiqa kiriting`;
  if (!isNonNegative(values.deliveryFee)) errors.deliveryFee = 'Musbat summa kiriting';
  if (!isNonNegative(values.freeDeliveryFrom)) {
    errors.freeDeliveryFrom = 'Musbat summa kiriting (0 — oʻchiq)';
  }
  if (!isEtaMinutes(values.deliveryEtaMinMinutes)) errors.deliveryEtaMinMinutes = etaRange;
  if (!isEtaMinutes(values.deliveryEtaMaxMinutes)) {
    errors.deliveryEtaMaxMinutes = etaRange;
  } else if (
    !errors.deliveryEtaMinMinutes &&
    values.deliveryEtaMinMinutes > values.deliveryEtaMaxMinutes
  ) {
    errors.deliveryEtaMaxMinutes = 'Eng koʻpi eng kamidan kichik boʻlmasin';
  }
  return errors;
}
