import { appliedDeliveryFee, assertDeliveryEtaRange } from './delivery-pricing';

/** Bepul yetkazish chegarasi va yetkazish vaqti (docs/specs/food-market-ux-v5.md §7). */
describe('appliedDeliveryFee', () => {
  const pricing = { deliveryFee: 7000, freeDeliveryFrom: 100000 };

  it("chegara 0 — funksiya o'chiq, har doim to'liq haq", () => {
    expect(appliedDeliveryFee({ deliveryFee: 7000, freeDeliveryFrom: 0 }, 5_000_000)).toBe(7000);
  });

  it("tovar summasi chegaradan kam — to'liq haq", () => {
    expect(appliedDeliveryFee(pricing, 99999)).toBe(7000);
  });

  it('tovar summasi chegaraga teng — bepul', () => {
    expect(appliedDeliveryFee(pricing, 100000)).toBe(0);
  });

  it('tovar summasi chegaradan katta — bepul', () => {
    expect(appliedDeliveryFee(pricing, 250000)).toBe(0);
  });

  it("noto'g'ri (manfiy/NaN) chegara o'chiq deb hisoblanadi", () => {
    expect(appliedDeliveryFee({ deliveryFee: 7000, freeDeliveryFrom: -1 }, 100)).toBe(7000);
    expect(appliedDeliveryFee({ deliveryFee: 7000, freeDeliveryFrom: Number.NaN }, 100)).toBe(7000);
  });
});

describe('assertDeliveryEtaRange', () => {
  it("min ≤ max — o'tadi", () => {
    expect(() => assertDeliveryEtaRange(30, 50)).not.toThrow();
    expect(() => assertDeliveryEtaRange(40, 40)).not.toThrow();
  });

  it('min > max — 400 (o‘zbekcha xabar)', () => {
    expect(() => assertDeliveryEtaRange(60, 50)).toThrow(/eng kami eng ko'pidan katta/);
  });
});
