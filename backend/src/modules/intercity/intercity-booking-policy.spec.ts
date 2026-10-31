import { IntercityBookingKind, PaymentMethod } from '../../database/entities/order.entity';
import {
  INTERCITY_BOOKING_REASONS,
  evaluateBooking,
  isLateCancel,
  seatReleaseOf,
} from './intercity-booking-policy';

const angren = { centerLat: 40.0956, centerLng: 70.9432, radiusKm: 12 };
const rohat = { centerLat: 41.3111, centerLng: 69.2797, radiusKm: 1.5 };

const context = {
  trip: { seatPrice: 25000, wholeCarPrice: 100000, seatsTotal: 4 },
  origin: angren,
  destination: rohat,
  maxSeatsPerBooking: 4,
};

const valid = {
  kind: IntercityBookingKind.SEAT,
  seats: 2,
  paymentMethod: PaymentMethod.CASH,
  pickup: { lat: 40.0956, lng: 70.9432 },
  dropoff: { lat: 41.3111, lng: 69.2797 },
};

const codes = (result: ReturnType<typeof evaluateBooking>): string[] =>
  result.ok ? [] : result.reasons.map((reason) => reason.code);

describe('evaluateBooking', () => {
  it("o'rindiq: narx = joylar × o'rindiq narxi", () => {
    expect(evaluateBooking(valid, context)).toEqual({
      ok: true,
      seats: 2,
      price: 50000,
      pickupZone: 'inside',
      dropoffZone: 'inside',
    });
  });

  it("o'rindiq soni berilmasa — 1 joy", () => {
    expect(evaluateBooking({ ...valid, seats: undefined }, context)).toMatchObject({
      ok: true,
      seats: 1,
      price: 25000,
    });
  });

  it('butun mashina: barcha joylar, butun mashina narxi (seats e\'tiborsiz)', () => {
    expect(
      evaluateBooking({ ...valid, kind: IntercityBookingKind.WHOLE_CAR, seats: 1 }, context),
    ).toMatchObject({ ok: true, seats: 4, price: 100000 });
  });

  it.each([0, -1, 1.5, 5])("o'rindiq soni %p — rad etiladi", (seats) => {
    expect(codes(evaluateBooking({ ...valid, seats }, context))).toEqual([
      INTERCITY_BOOKING_REASONS.seatsOutOfRange,
    ]);
  });

  it("bir bandlovda maksimum sozlamadan oshmaydi (qatnovda joy ko'p bo'lsa ham)", () => {
    const narrow = { ...context, maxSeatsPerBooking: 2 };
    expect(codes(evaluateBooking({ ...valid, seats: 3 }, narrow))).toEqual([
      INTERCITY_BOOKING_REASONS.seatsOutOfRange,
    ]);
  });

  it("qatnovdagi joylardan ko'p so'ralsa — rad", () => {
    const small = { ...context, trip: { ...context.trip, seatsTotal: 2 } };
    expect(codes(evaluateBooking({ ...valid, seats: 3 }, small))).toEqual([
      INTERCITY_BOOKING_REASONS.seatsOutOfRange,
    ]);
  });

  it.each([PaymentMethod.CARD, PaymentMethod.WALLET])("to'lov %s — hozircha faqat naqd", (method) => {
    expect(codes(evaluateBooking({ ...valid, paymentMethod: method }, context))).toEqual([
      INTERCITY_BOOKING_REASONS.paymentUnsupported,
    ]);
  });

  it("olish joyi boshlanish nuqtasidan tashqarida (Olmaliq) — rad", () => {
    expect(
      codes(evaluateBooking({ ...valid, pickup: { lat: 40.8447, lng: 69.5986 } }, context)),
    ).toEqual([INTERCITY_BOOKING_REASONS.pickupOutsideOrigin]);
  });

  it("tushirish joyi Rohat krugidan uzoqda (Toshkent ichi) — rad (shahar ichi alohida)", () => {
    expect(
      codes(evaluateBooking({ ...valid, dropoff: { lat: 41.35, lng: 69.35 } }, context)),
    ).toEqual([INTERCITY_BOOKING_REASONS.dropoffOutsideDestination]);
  });

  it('bir nechta xato — hammasi birdaniga qaytadi', () => {
    expect(
      codes(
        evaluateBooking(
          {
            ...valid,
            seats: 9,
            paymentMethod: PaymentMethod.CARD,
            pickup: { lat: 0, lng: 0 },
            dropoff: { lat: 0, lng: 0 },
          },
          context,
        ),
      ),
    ).toEqual([
      INTERCITY_BOOKING_REASONS.seatsOutOfRange,
      INTERCITY_BOOKING_REASONS.paymentUnsupported,
      INTERCITY_BOOKING_REASONS.pickupOutsideOrigin,
      INTERCITY_BOOKING_REASONS.dropoffOutsideDestination,
    ]);
  });
});

describe('seatReleaseOf', () => {
  it("o'rindiq bandi — o'z joylarini qaytaradi, butun mashina bayrog'iga tegmaydi", () => {
    expect(seatReleaseOf({ bookingKind: IntercityBookingKind.SEAT, seats: 2 })).toEqual({
      seats: 2,
      clearsWholeCar: false,
    });
  });

  it("butun mashina — barcha joylar va bayroq tozalanadi", () => {
    expect(seatReleaseOf({ bookingKind: IntercityBookingKind.WHOLE_CAR, seats: 4 })).toEqual({
      seats: 4,
      clearsWholeCar: true,
    });
  });

  it("eski/buzuq qator (seats null) — 0 qaytariladi, manfiyga tushmaydi", () => {
    expect(seatReleaseOf({ bookingKind: IntercityBookingKind.SEAT, seats: null })).toEqual({
      seats: 0,
      clearsWholeCar: false,
    });
  });
});

describe('isLateCancel', () => {
  const departureAt = new Date('2026-10-20T07:00:00Z');

  it('bepul oynadan oldin — kech emas', () => {
    expect(isLateCancel(departureAt, new Date('2026-10-20T05:59:00Z'), 60)).toBe(false);
  });

  it('aynan chegarada — kech emas', () => {
    expect(isLateCancel(departureAt, new Date('2026-10-20T06:00:00Z'), 60)).toBe(false);
  });

  it('bepul oyna ichida — kech', () => {
    expect(isLateCancel(departureAt, new Date('2026-10-20T06:30:00Z'), 60)).toBe(true);
  });

  it('0 daqiqa sozlamasi — hech qachon kech emas (jo\'nashgacha)', () => {
    expect(isLateCancel(departureAt, new Date('2026-10-20T06:59:00Z'), 0)).toBe(false);
  });
});

describe('evaluateBooking — shahar ichiga davom', () => {
  // Rohat krugi: 1.5 km radius, 30 km gacha davom.
  const rohatWithExtension = { ...rohat, extensionMaxKm: 30, extensionPricePerKm: 2000 };
  const extended = { ...context, destination: rohatWithExtension };
  // Rohatdan ~10 km shimolda (Toshkent ichi).
  const tashkentHome = { lat: rohat.centerLat + 0.09, lng: rohat.centerLng };

  it('davom yoqilgan nuqtada radiusdan tashqari manzil qabul qilinadi — zona extension', () => {
    expect(evaluateBooking({ ...valid, dropoff: tashkentHome }, extended)).toMatchObject({
      ok: true,
      price: 50000,
      dropoffZone: 'extension',
    });
  });

  it('davom o\'chiq nuqtada xuddi shu manzil rad etiladi', () => {
    expect(codes(evaluateBooking({ ...valid, dropoff: tashkentHome }, context))).toEqual([
      INTERCITY_BOOKING_REASONS.dropoffOutsideDestination,
    ]);
  });

  it('davom chegarasidan uzoq — rad etiladi', () => {
    const far = { lat: rohat.centerLat + 0.4, lng: rohat.centerLng }; // ~44 km
    expect(codes(evaluateBooking({ ...valid, dropoff: far }, extended))).toEqual([
      INTERCITY_BOOKING_REASONS.dropoffOutsideDestination,
    ]);
  });

  it('teskari yo\'nalish: Toshkentdagi uydan olish — pickup zonasi extension', () => {
    const reverse = { ...context, origin: rohatWithExtension, destination: angren };
    expect(
      evaluateBooking({ ...valid, pickup: tashkentHome, dropoff: { lat: 40.0956, lng: 70.9432 } }, reverse),
    ).toMatchObject({ ok: true, pickupZone: 'extension', dropoffZone: 'inside' });
  });
});

