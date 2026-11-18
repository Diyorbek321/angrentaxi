import { IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { OrderStatus } from '../../database/entities/order.entity';
import {
  INTERCITY_LIFECYCLE_REASONS,
  boardingBlocker,
  departBlocker,
  expiryReasonFor,
  revealsDriverContact,
} from './intercity-lifecycle-policy';

const departureAt = new Date('2026-10-20T07:00:00Z');
const at = (iso: string) => new Date(iso);

describe('boardingBlocker', () => {
  const base = { status: IntercityTripStatus.OPEN, departureAt, activeBookings: 2 };

  it("jo'nashdan 60 daqiqa oldin — ruxsat", () => {
    expect(boardingBlocker({ ...base, now: at('2026-10-20T06:00:00Z') })).toBeNull();
  });

  it("jo'nashdan 61 daqiqa oldin, to'lmagan — hali erta", () => {
    expect(boardingBlocker({ ...base, now: at('2026-10-20T05:59:00Z') })).toBe(
      INTERCITY_LIFECYCLE_REASONS.tooEarly,
    );
  });

  it("to'lgan qatnov — istalgan vaqtda yig'ishni boshlash mumkin", () => {
    expect(
      boardingBlocker({ ...base, status: IntercityTripStatus.FULL, now: at('2026-10-20T03:00:00Z') }),
    ).toBeNull();
  });

  it('bironta faol band yo\'q — rad', () => {
    expect(
      boardingBlocker({ ...base, activeBookings: 0, now: at('2026-10-20T06:30:00Z') }),
    ).toBe(INTERCITY_LIFECYCLE_REASONS.noBookings);
  });

  it.each([
    IntercityTripStatus.BOARDING,
    IntercityTripStatus.IN_PROGRESS,
    IntercityTripStatus.COMPLETED,
    IntercityTripStatus.CANCELLED,
  ])('holat %s — noto\'g\'ri holat', (status) => {
    expect(boardingBlocker({ ...base, status, now: at('2026-10-20T06:30:00Z') })).toBe(
      INTERCITY_LIFECYCLE_REASONS.wrongStatus,
    );
  });
});

describe('departBlocker', () => {
  it("hamma olindi (ARRIVED) — jo'nash mumkin", () => {
    expect(
      departBlocker(IntercityTripStatus.BOARDING, [OrderStatus.ARRIVED, OrderStatus.ARRIVED]),
    ).toBeNull();
  });

  it("bekor qilingan/kelmagan band to'smaydi; biri allaqachon yo'lda bo'lishi ham mumkin", () => {
    expect(
      departBlocker(IntercityTripStatus.BOARDING, [
        OrderStatus.ARRIVED,
        OrderStatus.CANCELLED,
        OrderStatus.IN_PROGRESS,
      ]),
    ).toBeNull();
  });

  it("hali olinmagan yo'lovchi (ACCEPTED) bor — avval olish yoki «kelmadi»", () => {
    expect(
      departBlocker(IntercityTripStatus.BOARDING, [OrderStatus.ARRIVED, OrderStatus.ACCEPTED]),
    ).toBe(INTERCITY_LIFECYCLE_REASONS.passengersPending);
  });

  it("hamma bekor/kelmagan — bo'sh qatnov jo'namaydi", () => {
    expect(departBlocker(IntercityTripStatus.BOARDING, [OrderStatus.CANCELLED])).toBe(
      INTERCITY_LIFECYCLE_REASONS.noBookings,
    );
  });

  it('yig\'ish boshlanmagan qatnov — noto\'g\'ri holat', () => {
    expect(departBlocker(IntercityTripStatus.OPEN, [OrderStatus.ARRIVED])).toBe(
      INTERCITY_LIFECYCLE_REASONS.wrongStatus,
    );
  });
});

describe('expiryReasonFor', () => {
  const trip = (status: IntercityTripStatus) => ({ status, departureAt });

  it("band yo'q, jo'nash +15 daqiqa o'tdi — no_bookings", () => {
    expect(expiryReasonFor(trip(IntercityTripStatus.OPEN), 0, at('2026-10-20T07:15:00Z'))).toBe(
      'no_bookings',
    );
  });

  it("band yo'q, lekin hali +15 bo'lmagan — tegilmaydi", () => {
    expect(expiryReasonFor(trip(IntercityTripStatus.OPEN), 0, at('2026-10-20T07:14:00Z'))).toBeNull();
  });

  it("band bor, +60 o'tdi, haydovchi yig'ishni boshlamagan — stale", () => {
    expect(expiryReasonFor(trip(IntercityTripStatus.FULL), 3, at('2026-10-20T08:00:00Z'))).toBe(
      'stale',
    );
  });

  it("band bor, +59 — haydovchiga hali vaqt bor", () => {
    expect(expiryReasonFor(trip(IntercityTripStatus.OPEN), 1, at('2026-10-20T07:59:00Z'))).toBeNull();
  });

  it.each([IntercityTripStatus.BOARDING, IntercityTripStatus.IN_PROGRESS])(
    "%s qatnovga cron tegmaydi (haydovchi yo'lda)",
    (status) => {
      expect(expiryReasonFor(trip(status), 0, at('2026-10-21T07:00:00Z'))).toBeNull();
    },
  );
});

describe('revealsDriverContact', () => {
  it("jo'nashdan 2 soat oldin, ochiq — telefon yashirin", () => {
    expect(revealsDriverContact(IntercityTripStatus.OPEN, departureAt, at('2026-10-20T05:00:00Z'))).toBe(
      false,
    );
  });

  it("jo'nashga 60 daqiqa qoldi — ochiladi", () => {
    expect(revealsDriverContact(IntercityTripStatus.FULL, departureAt, at('2026-10-20T06:00:00Z'))).toBe(
      true,
    );
  });

  it.each([IntercityTripStatus.BOARDING, IntercityTripStatus.IN_PROGRESS])(
    '%s — vaqtdan qat\'i nazar ochiq',
    (status) => {
      expect(revealsDriverContact(status, departureAt, at('2026-10-20T01:00:00Z'))).toBe(true);
    },
  );

  it('bekor qilingan qatnov — yashirin', () => {
    expect(
      revealsDriverContact(IntercityTripStatus.CANCELLED, departureAt, at('2026-10-20T06:50:00Z')),
    ).toBe(false);
  });
});
