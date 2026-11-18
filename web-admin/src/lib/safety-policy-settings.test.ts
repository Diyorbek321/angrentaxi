import { describe, expect, it } from 'vitest';
import { SAFETY_POLICY_DEFAULTS, SAFETY_POLICY_KEYS, validateSafetyPolicy } from './safety-policy-settings';

describe('xavfsizlik siyosati sozlamalari (INCIDENT-POLICY §4–§6)', () => {
  it('standart — xatosiz, siyosat hujjatidagidek', () => {
    expect(validateSafetyPolicy(SAFETY_POLICY_DEFAULTS)).toEqual({});
    expect(SAFETY_POLICY_DEFAULTS).toEqual({
      tripShareGraceMinutes: 30,
      freeCancelMinutes: 2,
      lateCancelFee: 3000,
      noShowWaitMinutes: 5,
      noShowFee: 5000,
      driverCancelSignalCount: 3,
      evidenceRetentionDays: 180,
    });
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

  it("saqlash muddati 30 kundan kam bo'lmaydi (tasodifiy o'chirishdan himoya)", () => {
    expect(Object.keys(validateSafetyPolicy({ ...SAFETY_POLICY_DEFAULTS, evidenceRetentionDays: 7 }))).toEqual([
      'evidenceRetentionDays',
    ]);
  });
});
