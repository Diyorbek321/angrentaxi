import { describe, expect, it } from 'vitest';
import { validateDeliverySettings } from './delivery-settings';

const base = {
  deliveryFee: 7000,
  freeDeliveryFrom: 0,
  deliveryEtaMinMinutes: 30,
  deliveryEtaMaxMinutes: 50,
};

describe('yetkazish sozlamalari validatsiyasi', () => {
  it("standart qiymatlar — xato yo'q", () => {
    expect(validateDeliverySettings(base)).toEqual({});
  });

  it("chegara 0 (o'chiq) va musbat — to'g'ri; manfiy — xato", () => {
    expect(validateDeliverySettings({ ...base, freeDeliveryFrom: 100000 })).toEqual({});
    expect(validateDeliverySettings({ ...base, freeDeliveryFrom: -1 }).freeDeliveryFrom).toBeDefined();
    expect(validateDeliverySettings({ ...base, freeDeliveryFrom: Number.NaN }).freeDeliveryFrom).toBeDefined();
  });

  it('yetkazish haqi manfiy — xato', () => {
    expect(validateDeliverySettings({ ...base, deliveryFee: -5 }).deliveryFee).toBeDefined();
  });

  it("vaqt 5–240 butun daqiqa", () => {
    expect(validateDeliverySettings({ ...base, deliveryEtaMinMinutes: 4 }).deliveryEtaMinMinutes).toBeDefined();
    expect(validateDeliverySettings({ ...base, deliveryEtaMaxMinutes: 241 }).deliveryEtaMaxMinutes).toBeDefined();
    expect(validateDeliverySettings({ ...base, deliveryEtaMinMinutes: 12.5 }).deliveryEtaMinMinutes).toBeDefined();
    expect(validateDeliverySettings({ ...base, deliveryEtaMinMinutes: 5, deliveryEtaMaxMinutes: 240 })).toEqual({});
  });

  it("eng kami eng ko'pidan katta — eng ko'pi maydonida xato", () => {
    const errors = validateDeliverySettings({ ...base, deliveryEtaMinMinutes: 60, deliveryEtaMaxMinutes: 50 });
    expect(errors.deliveryEtaMaxMinutes).toMatch(/eng kamidan/);
    expect(validateDeliverySettings({ ...base, deliveryEtaMinMinutes: 40, deliveryEtaMaxMinutes: 40 })).toEqual({});
  });
});
