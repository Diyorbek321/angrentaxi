import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import {
  INTERCITY_OVERLAP_HOURS,
  INTERCITY_TRIP_REASONS,
  IntercityPublishInput,
  evaluateTripPublish,
  findOverlappingDeparture,
} from './intercity-trip-policy';

const NOW = new Date('2026-10-17T06:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const ROUTE = {
  seatPrice: 25000,
  wholeCarPrice: 100000,
  comfortSeatPrice: 30000,
  comfortWholeCarPrice: 120000,
  seatsDefault: 4,
};

const input = (overrides: Partial<IntercityPublishInput> = {}): IntercityPublishInput => ({
  route: ROUTE,
  departureAt: new Date(NOW.getTime() + 2 * HOUR),
  now: NOW,
  tripClass: IntercityTripClass.START,
  seatsTotal: undefined,
  driverTier: 1,
  comfortTier: 3,
  minLeadMinutes: 30,
  maxAheadDays: 7,
  ...overrides,
});

const codes = (result: ReturnType<typeof evaluateTripPublish>): string[] =>
  result.ok ? [] : result.reasons.map((r) => r.code);

describe('evaluateTripPublish', () => {
  it("Start: narx yo'nalishdan nusxalanadi, o'rindiq standart", () => {
    expect(evaluateTripPublish(input())).toEqual({
      ok: true,
      seatsTotal: 4,
      seatPrice: 25000,
      wholeCarPrice: 100000,
    });
  });

  it('Comfort: comfort narxlari olinadi', () => {
    expect(
      evaluateTripPublish(input({ tripClass: IntercityTripClass.COMFORT, driverTier: 3 })),
    ).toEqual({ ok: true, seatsTotal: 4, seatPrice: 30000, wholeCarPrice: 120000 });
  });

  it("haydovchi o'rindiqlarni kamaytira oladi", () => {
    expect(evaluateTripPublish(input({ seatsTotal: 2 }))).toMatchObject({ ok: true, seatsTotal: 2 });
  });

  describe('vaqt oralig\'i', () => {
    it("juda yaqin (min lead'dan oldin)", () => {
      expect(codes(evaluateTripPublish(input({ departureAt: new Date(NOW.getTime() + 29 * 60_000) })))).toEqual([
        INTERCITY_TRIP_REASONS.departureTooSoon,
      ]);
    });

    it("aynan min lead chegarasida — mumkin", () => {
      expect(
        evaluateTripPublish(input({ departureAt: new Date(NOW.getTime() + 30 * 60_000) })).ok,
      ).toBe(true);
    });

    it("o'tmishdagi vaqt", () => {
      expect(codes(evaluateTripPublish(input({ departureAt: new Date(NOW.getTime() - HOUR) })))).toEqual([
        INTERCITY_TRIP_REASONS.departureTooSoon,
      ]);
    });

    it('juda uzoq (max ahead dan keyin)', () => {
      expect(
        codes(evaluateTripPublish(input({ departureAt: new Date(NOW.getTime() + 7 * 24 * HOUR + 1) }))),
      ).toEqual([INTERCITY_TRIP_REASONS.departureTooFar]);
    });
  });

  describe("o'rindiqlar", () => {
    it.each([0, -1, 5, 9, 2.5])('noto\'g\'ri: %s', (seats) => {
      expect(codes(evaluateTripPublish(input({ seatsTotal: seats })))).toEqual([
        INTERCITY_TRIP_REASONS.seatsOutOfRange,
      ]);
    });

    it("miniven yo'nalishida 7 ta mumkin", () => {
      expect(
        evaluateTripPublish(input({ route: { ...ROUTE, seatsDefault: 7 }, seatsTotal: 7 })),
      ).toMatchObject({ ok: true, seatsTotal: 7 });
    });
  });

  describe('Comfort klass', () => {
    it("yo'nalishda comfort narxi yo'q", () => {
      expect(
        codes(
          evaluateTripPublish(
            input({
              tripClass: IntercityTripClass.COMFORT,
              driverTier: 5,
              route: { ...ROUTE, comfortSeatPrice: null, comfortWholeCarPrice: null },
            }),
          ),
        ),
      ).toEqual([INTERCITY_TRIP_REASONS.comfortNotOffered]);
    });

    it('haydovchi darajasi yetmaydi', () => {
      expect(
        codes(evaluateTripPublish(input({ tripClass: IntercityTripClass.COMFORT, driverTier: 2 }))),
      ).toEqual([INTERCITY_TRIP_REASONS.comfortTierTooLow]);
    });

    it('yuqori daraja ham comfort qila oladi', () => {
      expect(
        evaluateTripPublish(input({ tripClass: IntercityTripClass.COMFORT, driverTier: 5 })).ok,
      ).toBe(true);
    });
  });

  it('barcha sabablar birdaniga qaytadi', () => {
    expect(
      codes(
        evaluateTripPublish(
          input({
            departureAt: new Date(NOW.getTime() + 10 * 60_000),
            seatsTotal: 9,
            tripClass: IntercityTripClass.COMFORT,
            driverTier: 1,
          }),
        ),
      ),
    ).toEqual([
      INTERCITY_TRIP_REASONS.departureTooSoon,
      INTERCITY_TRIP_REASONS.seatsOutOfRange,
      INTERCITY_TRIP_REASONS.comfortTierTooLow,
    ]);
  });
});

describe('findOverlappingDeparture', () => {
  const at = new Date('2026-10-17T10:00:00.000Z');

  it(`±${INTERCITY_OVERLAP_HOURS} soat ichidagisi topiladi`, () => {
    const other = new Date(at.getTime() + 2 * HOUR);
    expect(findOverlappingDeparture(at, [other])).toEqual(other);
    const before = new Date(at.getTime() - 2 * HOUR - 59 * 60_000);
    expect(findOverlappingDeparture(at, [before])).toEqual(before);
  });

  it('aynan 3 soat — kesishmaydi (qaytish qatnoviga ulguradi)', () => {
    expect(findOverlappingDeparture(at, [new Date(at.getTime() + 3 * HOUR)])).toBeNull();
    expect(findOverlappingDeparture(at, [new Date(at.getTime() - 3 * HOUR)])).toBeNull();
  });

  it("bo'sh ro'yxat", () => {
    expect(findOverlappingDeparture(at, [])).toBeNull();
  });
});
