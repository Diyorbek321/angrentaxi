import { t } from '@/locales';
import { groupDigits } from './format';

/**
 * Xavfsizlik, taksi jarimalari va dalillarni saqlash sozlamalari
 * (docs/INCIDENT-POLICY.md §4–§6, migratsiyalar 051–053). Chegaralar backend
 * `settings/safety-policy-settings.ts` bilan bir xil — server ham tekshiradi.
 */
export interface SafetyPolicyValues {
  tripShareGraceMinutes: number;
  freeCancelMinutes: number;
  lateCancelFee: number;
  noShowWaitMinutes: number;
  noShowFee: number;
  driverCancelSignalCount: number;
  evidenceRetentionDays: number;
}

export type SafetyPolicyKey = keyof SafetyPolicyValues;

export const SAFETY_POLICY_BOUNDS: Readonly<Record<SafetyPolicyKey, { min: number; max: number }>> = {
  tripShareGraceMinutes: { min: 0, max: 240 },
  freeCancelMinutes: { min: 0, max: 30 },
  lateCancelFee: { min: 0, max: 100_000 },
  noShowWaitMinutes: { min: 1, max: 60 },
  noShowFee: { min: 0, max: 100_000 },
  driverCancelSignalCount: { min: 1, max: 50 },
  evidenceRetentionDays: { min: 30, max: 3650 },
};

export const SAFETY_POLICY_DEFAULTS: Readonly<SafetyPolicyValues> = {
  tripShareGraceMinutes: 30,
  freeCancelMinutes: 2,
  lateCancelFee: 3000,
  noShowWaitMinutes: 5,
  noShowFee: 5000,
  driverCancelSignalCount: 3,
  evidenceRetentionDays: 180,
};

export const SAFETY_POLICY_KEYS = Object.keys(SAFETY_POLICY_DEFAULTS) as ReadonlyArray<SafetyPolicyKey>;

export type SafetyPolicyErrors = Partial<Record<SafetyPolicyKey, string>>;

/** Hammasi butun son. */
export function validateSafetyPolicy(values: SafetyPolicyValues): SafetyPolicyErrors {
  const m = t().settings.global.safety;
  return SAFETY_POLICY_KEYS.reduce<SafetyPolicyErrors>((acc, key) => {
    const { min, max } = SAFETY_POLICY_BOUNDS[key];
    const value = values[key];
    const ok = Number.isInteger(value) && value >= min && value <= max;
    return ok ? acc : { ...acc, [key]: m.range(groupDigits(min), groupDigits(max)) };
  }, {});
}
