import { t } from '@/locales';
import { groupDigits } from './format';

/**
 * Shikoyat va hodisa sozlamalari (docs/INCIDENT-POLICY.md §3, migratsiya
 * 050). Chegaralar backend `settings/incident-settings.ts` bilan bir xil —
 * server ham tekshiradi, bu yerda xato maydonning o'ziga ko'rsatiladi.
 */
export interface ComplaintSettingsValues {
  incidentReportWindowDays: number;
  incidentAppealWindowDays: number;
  suspensionDays: number;
  strikeWindowDays: number;
  strikeWarningAt: number;
  strikeSuspensionAt: number;
  strikeBlockAt: number;
  ratingSignalWindow: number;
  /** Kasr (masalan 4.3) — yagona butun bo'lmagan maydon. */
  ratingSignalThreshold: number;
  ratingSignalCooldownDays: number;
  lowRatingIncidentMaxScore: number;
}

export type ComplaintSettingKey = keyof ComplaintSettingsValues;

export const COMPLAINT_SETTING_BOUNDS: Readonly<Record<ComplaintSettingKey, { min: number; max: number }>> = {
  incidentReportWindowDays: { min: 1, max: 90 },
  incidentAppealWindowDays: { min: 1, max: 90 },
  suspensionDays: { min: 1, max: 90 },
  strikeWindowDays: { min: 7, max: 365 },
  strikeWarningAt: { min: 1, max: 50 },
  strikeSuspensionAt: { min: 1, max: 50 },
  strikeBlockAt: { min: 1, max: 50 },
  ratingSignalWindow: { min: 5, max: 200 },
  ratingSignalThreshold: { min: 1, max: 5 },
  ratingSignalCooldownDays: { min: 1, max: 365 },
  lowRatingIncidentMaxScore: { min: 0, max: 4 },
};

export const COMPLAINT_SETTING_DEFAULTS: Readonly<ComplaintSettingsValues> = {
  incidentReportWindowDays: 7,
  incidentAppealWindowDays: 7,
  suspensionDays: 3,
  strikeWindowDays: 90,
  strikeWarningAt: 1,
  strikeSuspensionAt: 3,
  strikeBlockAt: 5,
  ratingSignalWindow: 20,
  ratingSignalThreshold: 4.3,
  ratingSignalCooldownDays: 30,
  lowRatingIncidentMaxScore: 2,
};

export const COMPLAINT_SETTING_KEYS = Object.keys(COMPLAINT_SETTING_DEFAULTS) as ReadonlyArray<ComplaintSettingKey>;

export const DECIMAL_COMPLAINT_KEYS: ReadonlyArray<ComplaintSettingKey> = ['ratingSignalThreshold'];

export type ComplaintSettingsErrors = Partial<Record<ComplaintSettingKey, string>>;

export function validateComplaintSettings(values: ComplaintSettingsValues): ComplaintSettingsErrors {
  const m = t().settings.global.complaints;
  const errors = COMPLAINT_SETTING_KEYS.reduce<ComplaintSettingsErrors>((acc, key) => {
    const { min, max } = COMPLAINT_SETTING_BOUNDS[key];
    const value = values[key];
    const decimal = DECIMAL_COMPLAINT_KEYS.includes(key);
    const shapeOk = decimal ? Number.isFinite(value) && Math.round(value * 100) === value * 100 : Number.isInteger(value);
    const ok = shapeOk && value >= min && value <= max;
    return ok ? acc : { ...acc, [key]: m.range(groupDigits(min), groupDigits(max)) };
  }, {});
  // Zinapoya o'sib borishi shart: ogohlantirish ≤ to'xtatish ≤ blok.
  if (!errors.strikeSuspensionAt && !errors.strikeBlockAt) {
    if (values.strikeWarningAt > values.strikeSuspensionAt || values.strikeSuspensionAt > values.strikeBlockAt) {
      return { ...errors, strikeSuspensionAt: m.ladder };
    }
  }
  return errors;
}
