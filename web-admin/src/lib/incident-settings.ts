import { t } from '@/locales';
import { groupDigits } from './format';

/**
 * Hodisa siyosati sozlamalari (docs/INCIDENT-POLICY.md §1–§2). Chegaralar
 * backend `UpdateGlobalSettingsDto` bilan bir xil — server ham tekshiradi,
 * bu yerda esa xato maydonning o'ziga ko'rsatiladi.
 */
export interface IncidentSettingsValues {
  /** Posilka qiymati chegarasi, so'm. */
  parcelMaxDeclaredValue: number;
  /** Manzilda bepul kutish, daqiqa. */
  dropoffFreeWaitMinutes: number;
  /** Qaytarish haqi — yetkazish haqining foizi. */
  returnFeePercent: number;
  /** Shuncha rad → naqd buyurtma o'chiriladi. */
  refusalCashBlockCount: number;
  /** Rad etishlar sanaladigan davr, kun. */
  refusalWindowDays: number;
  /** IN_PROGRESS shundan uzoq — "osilib qolgan". */
  stuckDeliveryMinutes: number;
  /** Kuryer joylashuvi shundan eski — "osilib qolgan". */
  staleCourierLocationMinutes: number;
  /** Kartali buyurtma to'lovini kutish, daqiqa (§1). */
  cardPaymentTimeoutMinutes: number;
}

export type IncidentSettingKey = keyof IncidentSettingsValues;

export const INCIDENT_SETTING_BOUNDS: Readonly<Record<IncidentSettingKey, { min: number; max: number }>> = {
  parcelMaxDeclaredValue: { min: 10_000, max: 100_000_000 },
  dropoffFreeWaitMinutes: { min: 0, max: 60 },
  returnFeePercent: { min: 0, max: 200 },
  refusalCashBlockCount: { min: 1, max: 50 },
  refusalWindowDays: { min: 1, max: 365 },
  stuckDeliveryMinutes: { min: 10, max: 1440 },
  staleCourierLocationMinutes: { min: 2, max: 240 },
  cardPaymentTimeoutMinutes: { min: 5, max: 1440 },
};

/** INCIDENT-POLICY standartlari — eski backend maydonni qaytarmasa forma shu bilan to'ladi. */
export const INCIDENT_SETTING_DEFAULTS: Readonly<IncidentSettingsValues> = {
  parcelMaxDeclaredValue: 1_000_000,
  dropoffFreeWaitMinutes: 5,
  returnFeePercent: 50,
  refusalCashBlockCount: 2,
  refusalWindowDays: 30,
  stuckDeliveryMinutes: 60,
  staleCourierLocationMinutes: 10,
  cardPaymentTimeoutMinutes: 15,
};

/** Formadagi tartib. */
export const INCIDENT_SETTING_KEYS: ReadonlyArray<IncidentSettingKey> = [
  'parcelMaxDeclaredValue',
  'dropoffFreeWaitMinutes',
  'returnFeePercent',
  'refusalCashBlockCount',
  'refusalWindowDays',
  'stuckDeliveryMinutes',
  'staleCourierLocationMinutes',
  'cardPaymentTimeoutMinutes',
];

export type IncidentSettingsErrors = Partial<Record<IncidentSettingKey, string>>;

export function validateIncidentSettings(values: IncidentSettingsValues): IncidentSettingsErrors {
  const range = t().settings.global.incident.range;
  return INCIDENT_SETTING_KEYS.reduce<IncidentSettingsErrors>((errors, key) => {
    const { min, max } = INCIDENT_SETTING_BOUNDS[key];
    const value = values[key];
    const ok = Number.isInteger(value) && value >= min && value <= max;
    return ok ? errors : { ...errors, [key]: range(groupDigits(min), groupDigits(max)) };
  }, {});
}
