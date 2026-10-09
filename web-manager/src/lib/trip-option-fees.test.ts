import { describe, expect, it } from 'vitest';
import { TRIP_OPTIONS, changedFees, validateFee } from './trip-option-fees';

describe('safar opsiyalari haqi', () => {
  it("to'rtala opsiya backend kalitlari bilan", () => {
    expect(TRIP_OPTIONS.map((o) => o.key)).toEqual([
      'child_seat',
      'pet',
      'air_conditioner',
      'big_luggage',
    ]);
  });

  it("bo'sh maydon — 0 (haqsiz), xato emas", () => {
    expect(validateFee('')).toBeNull();
  });

  it("manfiy, kasr va backend chegarasidan (100 000) katta qiymat rad etiladi", () => {
    expect(validateFee('-1')).toBeTruthy();
    expect(validateFee('1500.5')).toBeTruthy();
    expect(validateFee('100001')).toBeTruthy();
    expect(validateFee('abc')).toBeTruthy();
    expect(validateFee('100000')).toBeNull();
  });

  it("faqat o'zgargan opsiyalar yuboriladi; bo'sh — 0", () => {
    expect(
      changedFees(
        { child_seat: 5000, pet: 7000 },
        { child_seat: '5000', pet: '', air_conditioner: '', big_luggage: '3000' }
      )
    ).toEqual({ pet: 0, big_luggage: 3000 });
  });
});
