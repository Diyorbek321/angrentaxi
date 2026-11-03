import { describe, expect, it } from 'vitest';
import { SAFETY_POLICY_DEFAULTS, SAFETY_POLICY_KEYS, validateSafetyPolicy } from './safety-policy-settings';

describe('xavfsizlik siyosati sozlamalari (INCIDENT-POLICY §4–§6)', () => {
  it('standart — xatosiz, siyosat hujjatidagidek', () => {
    expect(validateSafetyPolicy(SAFETY_POLICY_DEFAULTS)).toEqual({});
    expect(SAFETY_POLICY_DEFAULTS.tripShareGraceMinutes).toBe(30);
    expect(SAFETY_POLICY_KEYS.length).toBeGreaterThan(0);
  });

  it('chegaradan tashqari va kasr — xato', () => {
    expect(Object.keys(validateSafetyPolicy({ ...SAFETY_POLICY_DEFAULTS, tripShareGraceMinutes: 241 }))).toEqual([
      'tripShareGraceMinutes',
    ]);
    expect(Object.keys(validateSafetyPolicy({ ...SAFETY_POLICY_DEFAULTS, tripShareGraceMinutes: 1.5 }))).toEqual([
      'tripShareGraceMinutes',
    ]);
  });
});
