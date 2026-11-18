/**
 * Yetkazish hodisalari sozlamalari (docs/INCIDENT-POLICY.md §2, migratsiya
 * 049). Hammasi `platform_settings` da — kodda raqam qotirilmaydi, admin
 * `PATCH /settings/global` bilan o'zgartiradi.
 */
export interface DeliveryIncidentSettings {
  /** Posilka e'lon qilingan qiymatining yuqori chegarasi, so'm. */
  parcelMaxDeclaredValue: number;
  /** Manzilda ("yetib keldim" dan) bepul kutish, daqiqa. */
  dropoffFreeWaitMinutes: number;
  /** Qaytarish haqi — yetkazish haqining foizi. */
  returnFeePercent: number;
  /** Shuncha rad (oyna ichida) — mijozga ovqat/market naqd to'lovi o'chadi. */
  refusalCashBlockCount: number;
  /** Rad etishlar sanaladigan oyna, kun. */
  refusalWindowDays: number;
  /** IN_PROGRESS yetkazish shuncha daqiqadan oshsa — "osilib qolgan". */
  stuckDeliveryMinutes: number;
  /** Kuryer joylashuvi shuncha daqiqadan eski bo'lsa — "osilib qolgan". */
  staleCourierLocationMinutes: number;
}

/** Standart qiymatlar — migratsiya 049 bilan bir xil (ustuni yo'q eski qator uchun ham). */
export const DEFAULT_DELIVERY_INCIDENT_SETTINGS: DeliveryIncidentSettings = {
  parcelMaxDeclaredValue: 1_000_000,
  dropoffFreeWaitMinutes: 5,
  returnFeePercent: 50,
  refusalCashBlockCount: 2,
  refusalWindowDays: 30,
  stuckDeliveryMinutes: 60,
  staleCourierLocationMinutes: 10,
};

/** PATCH chegaralari — DTO va spec shu yerdan oladi. */
export const DELIVERY_INCIDENT_LIMITS: Record<keyof DeliveryIncidentSettings, { min: number; max: number }> = {
  parcelMaxDeclaredValue: { min: 10_000, max: 100_000_000 },
  dropoffFreeWaitMinutes: { min: 0, max: 60 },
  returnFeePercent: { min: 0, max: 200 },
  refusalCashBlockCount: { min: 1, max: 50 },
  refusalWindowDays: { min: 1, max: 365 },
  stuckDeliveryMinutes: { min: 10, max: 1440 },
  staleCourierLocationMinutes: { min: 2, max: 240 },
};

export const DELIVERY_INCIDENT_FIELDS = Object.keys(
  DEFAULT_DELIVERY_INCIDENT_SETTINGS,
) as ReadonlyArray<keyof DeliveryIncidentSettings>;

/** Qatordan o'qish; ustun yo'q (eski qator / qo'lda yig'ilgan spec) — standart. */
export function toDeliveryIncidentSettings(
  row: Partial<Record<keyof DeliveryIncidentSettings, number | string | null>>,
): DeliveryIncidentSettings {
  const read = (key: keyof DeliveryIncidentSettings): number => {
    const value = Number(row[key] ?? DEFAULT_DELIVERY_INCIDENT_SETTINGS[key]);
    return Number.isFinite(value) ? value : DEFAULT_DELIVERY_INCIDENT_SETTINGS[key];
  };
  return {
    parcelMaxDeclaredValue: read('parcelMaxDeclaredValue'),
    dropoffFreeWaitMinutes: read('dropoffFreeWaitMinutes'),
    returnFeePercent: read('returnFeePercent'),
    refusalCashBlockCount: read('refusalCashBlockCount'),
    refusalWindowDays: read('refusalWindowDays'),
    stuckDeliveryMinutes: read('stuckDeliveryMinutes'),
    staleCourierLocationMinutes: read('staleCourierLocationMinutes'),
  };
}
