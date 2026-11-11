import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { agreedFareBreakdown } from '../tariffs/fare-breakdown';
import {
  INTERCITY_REQUEST_REASONS,
  departureFitsWindow,
  evaluateBonusRaise,
  evaluateRequestWindow,
  maxRequestBonus,
  routePricesFor,
  withRequestBonus,
} from './intercity-request-policy';

const now = new Date('2026-10-18T09:00:00Z');
const at = (minutes: number): Date => new Date(now.getTime() + minutes * 60_000);

const codes = (reasons: { code: string }[]): string[] => reasons.map((r) => r.code);

describe('evaluateRequestWindow', () => {
  const window = (startMin: number, endMin: number) =>
    evaluateRequestWindow({ windowStart: at(startMin), windowEnd: at(endMin), now, maxAheadDays: 7 });

  it("2 soatlik oraliq — to'g'ri", () => {
    expect(window(60, 180)).toEqual([]);
  });

  it("boshi o'tib ketgan, lekin oxiriga vaqt bor — \"hoziroq\" so'rov", () => {
    expect(window(-10, 60)).toEqual([]);
  });

  it("oxiri boshidan oldin — faqat bitta sabab", () => {
    expect(codes(window(120, 60))).toEqual([INTERCITY_REQUEST_REASONS.windowInvalid]);
  });

  it('30 daqiqadan qisqa', () => {
    expect(codes(window(60, 80))).toEqual([INTERCITY_REQUEST_REASONS.windowTooShort]);
  });

  it('12 soatdan uzun', () => {
    expect(codes(window(60, 60 + 12 * 60 + 1))).toEqual([INTERCITY_REQUEST_REASONS.windowTooLong]);
  });

  it("oxirigacha 30 daqiqadan kam qolgan", () => {
    expect(codes(window(-60, 20))).toEqual([INTERCITY_REQUEST_REASONS.windowTooSoon]);
  });

  it("7 kundan uzoq", () => {
    expect(codes(window(8 * 24 * 60, 8 * 24 * 60 + 60))).toEqual([INTERCITY_REQUEST_REASONS.windowTooFar]);
  });
});

describe('routePricesFor', () => {
  const route = { seatPrice: 25000, wholeCarPrice: 100000, comfortSeatPrice: 30000, comfortWholeCarPrice: 120000, seatsDefault: 4 };

  it('Start va Comfort narxlari', () => {
    expect(routePricesFor(route, IntercityTripClass.START)).toEqual({ seatPrice: 25000, wholeCarPrice: 100000 });
    expect(routePricesFor(route, IntercityTripClass.COMFORT)).toEqual({ seatPrice: 30000, wholeCarPrice: 120000 });
  });

  it("Comfort yo'q yo'nalish — null", () => {
    expect(routePricesFor({ ...route, comfortSeatPrice: null }, IntercityTripClass.COMFORT)).toBeNull();
  });
});

describe('evaluateBonusRaise', () => {
  it("0 → 5 000 — to'g'ri", () => {
    expect(evaluateBonusRaise(0, 5000, 25000)).toEqual([]);
  });

  it('qadamga karrali emas', () => {
    expect(codes(evaluateBonusRaise(0, 2500, 25000))).toEqual([INTERCITY_REQUEST_REASONS.bonusStep]);
  });

  it('pasaytirish yoki o\'sha summa — rad', () => {
    expect(codes(evaluateBonusRaise(5000, 5000, 25000))).toEqual([INTERCITY_REQUEST_REASONS.bonusNotHigher]);
    expect(codes(evaluateBonusRaise(5000, 3000, 25000))).toEqual([INTERCITY_REQUEST_REASONS.bonusNotHigher]);
  });

  it('asosiy narxdan ko\'p — rad', () => {
    expect(codes(evaluateBonusRaise(0, 26000, 25000))).toEqual([INTERCITY_REQUEST_REASONS.bonusTooHigh]);
    expect(evaluateBonusRaise(0, 25000, 25000)).toEqual([]);
  });

  it('chegara qadamga pastga yaxlitlanadi', () => {
    expect(maxRequestBonus(42500)).toBe(42000);
  });
});

describe('departureFitsWindow', () => {
  const window = { windowStart: at(60), windowEnd: at(180) };

  it('oraliq ichida va chegaralarda', () => {
    expect(departureFitsWindow(at(60), window, now)).toBe(true);
    expect(departureFitsWindow(at(180), window, now)).toBe(true);
  });

  it('oraliqdan tashqarida', () => {
    expect(departureFitsWindow(at(59), window, now)).toBe(false);
    expect(departureFitsWindow(at(181), window, now)).toBe(false);
  });

  it("boshi o'tgan oraliqda — eng ertasi hozir + 10 daqiqa", () => {
    const started = { windowStart: at(-30), windowEnd: at(90) };
    expect(departureFitsWindow(at(5), started, now)).toBe(false);
    expect(departureFitsWindow(at(10), started, now)).toBe(true);
  });
});

describe('withRequestBonus', () => {
  it("oshirish surgeFare ga tushadi — qatorlar jamiga teng qoladi", () => {
    const fare = withRequestBonus({ ...agreedFareBreakdown(25000, 0, 120), distanceFare: 17000, total: 42000 }, 5000);
    expect(fare).toMatchObject({ surgeFare: 5000, intercityBonus: 5000, total: 47000 });
    const sum =
      fare.baseFare + fare.distanceFare + fare.timeFare + fare.minPriceAdjustment + fare.surgeFare +
      fare.maxPriceCap + (fare.optionsFare ?? 0) + fare.waitingFare + fare.roundingAdjustment;
    expect(sum).toBe(fare.total);
  });

  it("0 — o'zgarishsiz", () => {
    const fare = agreedFareBreakdown(25000, 0, 120);
    expect(withRequestBonus(fare, 0)).toBe(fare);
  });
});
