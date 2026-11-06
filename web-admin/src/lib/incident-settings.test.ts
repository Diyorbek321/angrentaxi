import { describe, expect, it } from 'vitest';
import {
  INCIDENT_SETTING_BOUNDS,
  INCIDENT_SETTING_DEFAULTS,
  INCIDENT_SETTING_KEYS,
  validateIncidentSettings,
} from './incident-settings';

describe('hodisa sozlamalari (INCIDENT-POLICY §2)', () => {
  it('8 ta maydon, backend chegaralari bilan bir xil', () => {
    expect(INCIDENT_SETTING_KEYS).toHaveLength(8);
    expect(INCIDENT_SETTING_BOUNDS.parcelMaxDeclaredValue).toEqual({ min: 10000, max: 100000000 });
    expect(INCIDENT_SETTING_BOUNDS.dropoffFreeWaitMinutes).toEqual({ min: 0, max: 60 });
    expect(INCIDENT_SETTING_BOUNDS.returnFeePercent).toEqual({ min: 0, max: 200 });
    expect(INCIDENT_SETTING_BOUNDS.refusalCashBlockCount).toEqual({ min: 1, max: 50 });
    expect(INCIDENT_SETTING_BOUNDS.refusalWindowDays).toEqual({ min: 1, max: 365 });
    expect(INCIDENT_SETTING_BOUNDS.stuckDeliveryMinutes).toEqual({ min: 10, max: 1440 });
    expect(INCIDENT_SETTING_BOUNDS.staleCourierLocationMinutes).toEqual({ min: 2, max: 240 });
    expect(INCIDENT_SETTING_BOUNDS.cardPaymentTimeoutMinutes).toEqual({ min: 5, max: 1440 });
  });

  it("standart qiymatlar — xato yo'q", () => {
    expect(validateIncidentSettings(INCIDENT_SETTING_DEFAULTS)).toEqual({});
  });

  it('chegaralar ichida (chetlari ham) — to\'g\'ri', () => {
    expect(
      validateIncidentSettings({ ...INCIDENT_SETTING_DEFAULTS, dropoffFreeWaitMinutes: 0, returnFeePercent: 200 })
    ).toEqual({});
  });

  it('chegaradan tashqari, kasr yoki NaN — o\'sha maydonda xato', () => {
    const errors = validateIncidentSettings({
      ...INCIDENT_SETTING_DEFAULTS,
      parcelMaxDeclaredValue: 9999,
      refusalCashBlockCount: 0,
      stuckDeliveryMinutes: 30.5,
      staleCourierLocationMinutes: Number.NaN,
    });
    expect(Object.keys(errors).sort()).toEqual(
      ['parcelMaxDeclaredValue', 'refusalCashBlockCount', 'staleCourierLocationMinutes', 'stuckDeliveryMinutes'].sort()
    );
    expect(errors.parcelMaxDeclaredValue).toMatch(/10/);
  });
});
