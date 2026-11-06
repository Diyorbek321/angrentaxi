import { applyDiscount, FARE_ROUNDING_STEP, roundFare, withRounding } from './fare-rounding';
import { agreedFareBreakdown, FareBreakdown } from './fare-breakdown';

const rowsSum = (b: FareBreakdown): number =>
  b.baseFare +
  b.distanceFare +
  b.timeFare +
  b.minPriceAdjustment +
  b.surgeFare +
  b.maxPriceCap +
  b.waitingFare +
  b.roundingAdjustment;

describe('roundFare', () => {
  it('100 so\'mga yaqiniga yaxlitlaydi', () => {
    expect(FARE_ROUNDING_STEP).toBe(100);
    expect(roundFare(6499.18)).toBe(6500);
    expect(roundFare(6449.99)).toBe(6400);
    expect(roundFare(6450)).toBe(6500);
    expect(roundFare(12000)).toBe(12000);
  });

  it('manfiy yoki nol narx 0 bo\'ladi', () => {
    expect(roundFare(0)).toBe(0);
    expect(roundFare(-30)).toBe(0);
  });
});

describe('withRounding', () => {
  const raw = (): FareBreakdown => ({
    ...agreedFareBreakdown(0, 4.2, 9),
    baseFare: 5000,
    distanceFare: 4.2 * 1150,
    timeFare: 9 * 111,
    total: 5000 + 4.2 * 1150 + 9 * 111,
  });

  it('farqni alohida qatorga yozadi va invariant saqlanadi', () => {
    const rounded = withRounding(raw());
    expect(rounded.total).toBe(10800);
    expect(rounded.roundingAdjustment).toBeCloseTo(10800 - 10829, 6);
    expect(rowsSum(rounded)).toBeCloseTo(rounded.total, 6);
  });

  it('idempotent — ikki marta qo\'llash natijani o\'zgartirmaydi', () => {
    const once = withRounding(raw());
    expect(withRounding(once)).toEqual(once);
  });

  it('eski tarkibda qator yo\'q bo\'lsa 0 deb o\'qiydi', () => {
    const legacy = { ...raw() } as Partial<FareBreakdown>;
    delete legacy.roundingAdjustment;
    const rounded = withRounding(legacy as FareBreakdown);
    expect(rounded.total).toBe(10800);
    expect(rowsSum(rounded)).toBeCloseTo(10800, 6);
  });
});

describe('applyDiscount', () => {
  it('foizli chegirmadan keyin yakuniy 100 ga karrali, chegirma moslashadi', () => {
    expect(applyDiscount(23400, 3510)).toEqual({ finalPrice: 19900, discountAmount: 3500 });
  });

  it('chegirma yo\'q bo\'lsa summa o\'zgarmaydi', () => {
    expect(applyDiscount(5050, 0)).toEqual({ finalPrice: 5050, discountAmount: 0 });
  });

  it('chegirma narxdan katta bo\'lsa 0 va chegirma = narx', () => {
    expect(applyDiscount(8000, 10000)).toEqual({ finalPrice: 0, discountAmount: 8000 });
  });
});
