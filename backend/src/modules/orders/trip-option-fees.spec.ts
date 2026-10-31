import { FareBreakdown } from '../tariffs/fare-breakdown';
import { withWaitingFare } from '../tariffs/waiting-charge';
import {
  normalizeTripOptionFees,
  tripOptionCharges,
  withOptionsFare,
} from './trip-option-fees';
import { TripOption } from './trip-options';

/**
 * SAFAR OPSIYALARI HAQI (biznes qarori, 2026-10-09).
 *
 * Qo'riqlanadigan narsalar:
 *   1. INVARIANT — opsiya qatori qo'shilgandan keyin ham chek qatorlari
 *      jamiga teng.
 *   2. IDEMPOTENTLIK — ikki marta qo'llash haqni ikki barobar qilmaydi.
 *   3. Haq belgilanmagan opsiya (0 yoki yo'q) chekda qator bo'lmaydi.
 */

const rideFare = (over: Partial<FareBreakdown> = {}): FareBreakdown => ({
  baseFare: 10000,
  distanceKm: 8,
  pricePerKm: 2000,
  distanceFare: 16000,
  durationMin: 20,
  pricePerMin: 500,
  timeFare: 10000,
  minPriceAdjustment: 0,
  surgeMultiplier: 1,
  surgeFare: 0,
  maxPriceCap: 0,
  waitingMinutes: 0,
  waitingFare: 0,
  roundingAdjustment: 0,
  total: 36000,
  ...over,
});

const rowsSum = (b: FareBreakdown) =>
  b.baseFare +
  b.distanceFare +
  b.timeFare +
  b.minPriceAdjustment +
  b.surgeFare +
  b.maxPriceCap +
  (b.optionsFare ?? 0) +
  b.waitingFare +
  b.roundingAdjustment;

describe('normalizeTripOptionFees', () => {
  it("noma'lum opsiya, manfiy va raqam bo'lmagan qiymatlarni tashlaydi", () => {
    expect(
      normalizeTripOptionFees({
        child_seat: 5000,
        pet: -1,
        air_conditioner: 'x',
        rocket: 9000,
        big_luggage: 3000,
      }),
    ).toEqual({ child_seat: 5000, big_luggage: 3000 });
  });

  it("jsonb bo'sh yoki buzuq bo'lsa — haqsiz", () => {
    expect(normalizeTripOptionFees(null)).toEqual({});
    expect(normalizeTripOptionFees('[]')).toEqual({});
    expect(normalizeTripOptionFees([5000])).toEqual({});
  });
});

describe('tripOptionCharges', () => {
  const fees = { child_seat: 5000, pet: 7000 };

  it("faqat so'ralgan va haqi bor opsiyalar qatorga chiqadi", () => {
    expect(
      tripOptionCharges([TripOption.PET, TripOption.AIR_CONDITIONER, TripOption.CHILD_SEAT], fees),
    ).toEqual([
      { option: 'child_seat', fee: 5000 },
      { option: 'pet', fee: 7000 },
    ]);
  });

  it("opsiya so'ralmagan bo'lsa — bo'sh", () => {
    expect(tripOptionCharges([], fees)).toEqual([]);
    expect(tripOptionCharges(null, fees)).toEqual([]);
  });
});

describe('withOptionsFare', () => {
  it("opsiya haqini jamiga qo'shadi, invariant saqlanadi", () => {
    const b = withOptionsFare(rideFare(), [
      { option: 'child_seat', fee: 5000 },
      { option: 'pet', fee: 7000 },
    ]);
    expect(b.optionsFare).toBe(12000);
    expect(b.total).toBe(48000);
    expect(b.optionCharges).toHaveLength(2);
    expect(rowsSum(b)).toBe(b.total);
  });

  it('koeffitsient va yuqori chegaradan TASHQARIDA', () => {
    const capped = rideFare({ surgeMultiplier: 2, surgeFare: 36000, maxPriceCap: -22000, total: 50000 });
    const b = withOptionsFare(capped, [{ option: 'pet', fee: 5000 }]);
    expect(b.total).toBe(55000);
    expect(b.surgeFare).toBe(36000);
    expect(rowsSum(b)).toBe(b.total);
  });

  it('IDEMPOTENT — ikki marta qo\'llash haqni ikki barobar qilmaydi', () => {
    const charges = [{ option: 'pet', fee: 5000 }];
    const once = withOptionsFare(rideFare(), charges);
    expect(withOptionsFare(once, charges)).toEqual(once);
  });

  it("haq bo'lmasa jamiga tegmaydi", () => {
    const b = withOptionsFare(rideFare(), []);
    expect(b.total).toBe(36000);
    expect(b.optionsFare).toBe(0);
    expect(b.optionCharges).toEqual([]);
  });

  it('kirish obyektini o\'zgartirmaydi', () => {
    const quote = rideFare();
    withOptionsFare(quote, [{ option: 'pet', fee: 5000 }]);
    expect(quote.total).toBe(36000);
    expect(quote.optionsFare).toBeUndefined();
  });

  it("100 so'mga karrali bo'lmagan haq yaxlitlanadi, invariant saqlanadi", () => {
    const b = withOptionsFare(rideFare(), [{ option: 'pet', fee: 5030 }]);
    expect(b.total % 100).toBe(0);
    expect(rowsSum(b)).toBe(b.total);
  });

  it("kutish haqi bilan birga — ikkalasi ham jamida, invariant saqlanadi", () => {
    const b = withWaitingFare(withOptionsFare(rideFare(), [{ option: 'pet', fee: 5000 }]), 4, 500);
    expect(b.total).toBe(36000 + 5000 + 2000);
    expect(rowsSum(b)).toBe(b.total);
  });
});
