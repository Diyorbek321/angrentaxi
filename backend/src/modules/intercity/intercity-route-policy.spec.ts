import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/coded-error';
import {
  INTERCITY_ROUTE_REASONS,
  INTERCITY_SEATS_MAX,
  INTERCITY_SEATS_MIN,
  IntercityRoutePrices,
  assertIntercityRoutePrices,
  validateIntercityRoutePrices,
} from './intercity-route-policy';

/** Angren → Rohat krugi (Toshkent), egasi bergan narxlar. */
const VALID: IntercityRoutePrices = {
  seatPrice: 25000,
  wholeCarPrice: 100000,
  comfortSeatPrice: 30000,
  comfortWholeCarPrice: 120000,
  seatsDefault: 4,
};

const reasonCodes = (prices: IntercityRoutePrices): string[] =>
  validateIntercityRoutePrices(prices).map((reason) => reason.code);

describe('validateIntercityRoutePrices', () => {
  it("to'g'ri narxlar to'plamida sabab yo'q", () => {
    expect(validateIntercityRoutePrices(VALID)).toEqual([]);
  });

  it("komfortsiz yo'nalish (ikkala komfort narxi null) to'g'ri", () => {
    expect(
      validateIntercityRoutePrices({ ...VALID, comfortSeatPrice: null, comfortWholeCarPrice: null }),
    ).toEqual([]);
  });

  it("butun mashina narxi o'rindiq narxiga teng bo'lishi mumkin", () => {
    expect(reasonCodes({ ...VALID, wholeCarPrice: 25000, comfortWholeCarPrice: 30000 })).toEqual([]);
  });

  it.each([0, -1])("o'rindiq narxi %p — SEAT_PRICE_NOT_POSITIVE", (seatPrice) => {
    expect(reasonCodes({ ...VALID, seatPrice })).toContain(INTERCITY_ROUTE_REASONS.seatPriceNotPositive);
  });

  it("butun mashina o'rindiqdan arzon — WHOLE_CAR_BELOW_SEAT", () => {
    expect(reasonCodes({ ...VALID, wholeCarPrice: 20000 })).toContain(
      INTERCITY_ROUTE_REASONS.wholeCarBelowSeat,
    );
  });

  it.each([
    [30000, null],
    [null, 120000],
  ])('komfort juftligi yarim (%p, %p) — COMFORT_PAIR_INCOMPLETE', (comfortSeatPrice, comfortWholeCarPrice) => {
    expect(reasonCodes({ ...VALID, comfortSeatPrice, comfortWholeCarPrice })).toEqual([
      INTERCITY_ROUTE_REASONS.comfortPairIncomplete,
    ]);
  });

  it("Comfort o'rindiq Start'dan arzon — COMFORT_SEAT_BELOW_STANDARD", () => {
    expect(reasonCodes({ ...VALID, comfortSeatPrice: 20000 })).toContain(
      INTERCITY_ROUTE_REASONS.comfortSeatBelowStandard,
    );
  });

  it("Comfort butun mashina Start'dan arzon — COMFORT_WHOLE_CAR_BELOW_STANDARD", () => {
    expect(reasonCodes({ ...VALID, comfortWholeCarPrice: 90000 })).toContain(
      INTERCITY_ROUTE_REASONS.comfortWholeCarBelowStandard,
    );
  });

  it("komfort butun mashina komfort o'rindiqdan arzon — COMFORT_WHOLE_CAR_BELOW_COMFORT_SEAT", () => {
    expect(
      reasonCodes({ ...VALID, comfortSeatPrice: 130000, comfortWholeCarPrice: 120000 }),
    ).toContain(INTERCITY_ROUTE_REASONS.comfortWholeCarBelowComfortSeat);
  });

  it.each([INTERCITY_SEATS_MIN - 1, INTERCITY_SEATS_MAX + 1, 2.5])(
    "o'rindiqlar soni %p — SEATS_OUT_OF_RANGE",
    (seatsDefault) => {
      expect(reasonCodes({ ...VALID, seatsDefault })).toEqual([
        INTERCITY_ROUTE_REASONS.seatsOutOfRange,
      ]);
    },
  );

  it.each([INTERCITY_SEATS_MIN, INTERCITY_SEATS_MAX])("o'rindiqlar soni chegarada (%p) to'g'ri", (seatsDefault) => {
    expect(reasonCodes({ ...VALID, seatsDefault })).toEqual([]);
  });

  it('bir nechta xato birdaniga qaytadi (admin hammasini bir martada tuzatsin)', () => {
    expect(reasonCodes({ ...VALID, seatPrice: 0, seatsDefault: 0 })).toEqual(
      expect.arrayContaining([
        INTERCITY_ROUTE_REASONS.seatPriceNotPositive,
        INTERCITY_ROUTE_REASONS.seatsOutOfRange,
      ]),
    );
  });

  it("har bir sababda o'zbekcha xabar bor", () => {
    const reasons = validateIntercityRoutePrices({
      seatPrice: 0,
      wholeCarPrice: -1,
      comfortSeatPrice: 1,
      comfortWholeCarPrice: null,
      seatsDefault: 99,
    });
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason.message.length).toBeGreaterThan(0);
    }
  });
});

describe('assertIntercityRoutePrices', () => {
  it("to'g'ri narxlarda hech narsa otmaydi", () => {
    expect(() => assertIntercityRoutePrices(VALID)).not.toThrow();
  });

  it('xato narxlarda INTERCITY_ROUTE_INVALID kodli 400 va sabablar', () => {
    let caught: unknown;
    try {
      assertIntercityRoutePrices({ ...VALID, wholeCarPrice: 1000 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as {
      code: string;
      reasons: Array<{ code: string }>;
    };
    expect(response.code).toBe(ERROR_CODES.intercityRouteInvalid);
    expect(response.reasons.map((reason) => reason.code)).toEqual([
      INTERCITY_ROUTE_REASONS.wholeCarBelowSeat,
    ]);
  });
});
