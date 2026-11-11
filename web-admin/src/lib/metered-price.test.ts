import { describe, expect, it } from 'vitest';
import { meteredPriceField, meteredPriceLabel } from './metered-price';

describe('taksometr km narxi maydoni', () => {
  it("bo'sh maydon null bo'ladi — 0 so'm emas", () => {
    expect(meteredPriceField.parse('')).toBeNull();
    expect(meteredPriceField.parse(undefined)).toBeNull();
    expect(meteredPriceField.parse(null)).toBeNull();
  });

  it('raqam qabul qilinadi', () => {
    expect(meteredPriceField.parse('1800')).toBe(1800);
    expect(meteredPriceField.parse(2000)).toBe(2000);
  });

  it('manfiy yoki raqam emas — xato', () => {
    expect(meteredPriceField.safeParse('-5').success).toBe(false);
    expect(meteredPriceField.safeParse('abc').success).toBe(false);
  });

  it("kartada: qiymat yo'q bo'lsa oddiy km narxi ishlatilishini aytadi", () => {
    const fmt = (v: number) => `${v} so'm`;
    expect(meteredPriceLabel(null, fmt)).toBe('Oddiy km narxi');
    expect(meteredPriceLabel(1800, fmt)).toBe("1800 so'm");
  });
});
