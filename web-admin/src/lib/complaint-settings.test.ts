import { describe, expect, it } from 'vitest';
import { COMPLAINT_SETTING_DEFAULTS, COMPLAINT_SETTING_KEYS, validateComplaintSettings } from './complaint-settings';

describe('shikoyat sozlamalari (INCIDENT-POLICY §3)', () => {
  it('11 maydon, standart — xatosiz', () => {
    expect(COMPLAINT_SETTING_KEYS).toHaveLength(11);
    expect(validateComplaintSettings(COMPLAINT_SETTING_DEFAULTS)).toEqual({});
  });

  it('reyting chegarasi kasr bo\'la oladi, boshqalari — yo\'q', () => {
    expect(validateComplaintSettings({ ...COMPLAINT_SETTING_DEFAULTS, ratingSignalThreshold: 4.25 })).toEqual({});
    expect(Object.keys(validateComplaintSettings({ ...COMPLAINT_SETTING_DEFAULTS, suspensionDays: 2.5 }))).toEqual([
      'suspensionDays',
    ]);
    expect(Object.keys(validateComplaintSettings({ ...COMPLAINT_SETTING_DEFAULTS, ratingSignalThreshold: 6 }))).toEqual([
      'ratingSignalThreshold',
    ]);
  });

  it("zinapoya tartibi buzilsa — to'xtatish maydonida xato", () => {
    expect(Object.keys(validateComplaintSettings({ ...COMPLAINT_SETTING_DEFAULTS, strikeSuspensionAt: 7 }))).toEqual([
      'strikeSuspensionAt',
    ]);
  });
});
