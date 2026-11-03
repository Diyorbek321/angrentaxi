import { t } from '@/locales';
import { groupDigits } from './format';

/**
 * Xavfsizlik, taksi jarimalari va dalillarni saqlash sozlamalari
 * (docs/INCIDENT-POLICY.md §4–§6, migratsiyalar 051–053). Chegaralar backend
 * `settings/safety-policy-settings.ts` bilan bir xil — server ham tekshiradi.
 */
export interface SafetyPolicyValues {
  tripShareGraceMinutes: number;
}

export type SafetyPolicyKey = keyof SafetyPolicyValues;

export const SAFETY_POLICY_BOUNDS: Readonly<Record<SafetyPolicyKey, { min: number; max: number }>> = {
  tripShareGraceMinutes: { min: 0, max: 240 },
};

export const SAFETY_POLICY_DEFAULTS: Readonly<SafetyPolicyValues> = {
  tripShareGraceMinutes: 30,
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
