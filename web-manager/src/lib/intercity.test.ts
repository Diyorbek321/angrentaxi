import { describe, expect, it } from 'vitest';
import {
  INTERCITY_STATUS_BADGE,
  intercityStatusLabels,
  INTERCITY_TRIP_STATUSES,
  serviceTypeLabels,
  INTERCITY_BOOKING_STATUS_BADGE,
  intercityBookingStatusLabels,
  addDays,
  applyTripUpdate,
  bookingKindLabel,
  canDispatcherCancel,
  zonesLabel,
  isWholeCarBooked,
  seatsTaken,
  serviceTypeLabel,
  tashkentDate,
  tripClassLabel,
  type IntercityTripView,
} from './intercity';

const TRIP: IntercityTripView = {
  id: 't1',
  route: { id: 'r1', origin: { id: 'a', name: 'Angren' }, destination: { id: 'b', name: 'Rohat krugi' } },
  tripClass: 'start',
  departureAt: '2026-10-18T02:00:00.000Z',
  status: 'open',
  seatsTotal: 4,
  seatsLeft: 3,
  wholeCarAvailable: false,
  seatPrice: 25000,
  wholeCarPrice: 100000,
  driver: { firstName: 'Ali', rating: 4.9, carModel: 'Cobalt', plate: '10A123BC' },
  cancelReason: null,
};

describe('tashkentDate', () => {
  it('Toshkent (UTC+5) kuni — UTC yarim tundan keyin ham to‘g‘ri', () => {
    // 2026-10-17 20:30 UTC = 2026-10-18 01:30 Toshkent.
    expect(tashkentDate(new Date('2026-10-17T20:30:00Z'))).toBe('2026-10-18');
    expect(tashkentDate(new Date('2026-10-17T18:59:00Z'))).toBe('2026-10-17');
  });

  it('addDays oy va yil chegarasidan o‘tadi', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe("o'rindiqlar", () => {
  it('band qilingan joylar soni', () => {
    expect(seatsTaken(TRIP)).toBe(1);
    expect(seatsTaken({ ...TRIP, seatsLeft: 4 })).toBe(0);
  });

  it('butun mashina — joy qolmagan va boshqa band yo‘q deb bilib bo‘lmaydi, faqat to‘la', () => {
    // Backend view `wholeCarBooked` ni bermaydi; to'la qatnov — ikkala holat ham.
    const full: IntercityTripView = { ...TRIP, seatsLeft: 0, status: 'full' };
    expect(isWholeCarBooked(full)).toBe(false);
    expect(isWholeCarBooked({ ...full, wholeCarBooked: true })).toBe(true);
  });
});

describe('yorliqlar', () => {
  it('har bir holatning yorlig‘i va badge rangi bor', () => {
    for (const status of INTERCITY_TRIP_STATUSES) {
      expect(intercityStatusLabels()[status]).toBeTruthy();
      expect(INTERCITY_STATUS_BADGE[status]).toBeTruthy();
    }
  });

  it('bekor qilingan qatnov amber emas — amber qo‘lda aralashuv uchun', () => {
    expect(INTERCITY_STATUS_BADGE.cancelled).not.toBe('override');
    expect(Object.values(INTERCITY_STATUS_BADGE)).not.toContain('override');
  });

  it('klass', () => {
    expect(tripClassLabel('start')).toBe('Start');
    expect(tripClassLabel('comfort')).toBe('Comfort');
  });

  it('xizmat turi: intercity — Shaharlararo, nomaʼlum — oʻzi', () => {
    expect(serviceTypeLabels().intercity).toBe('Shaharlararo');
    expect(serviceTypeLabel('intercity')).toBe('Shaharlararo');
    expect(serviceTypeLabel('parcel')).toBe('Posilka');
    expect(serviceTypeLabel(undefined)).toBe('Taksi');
    expect(serviceTypeLabel('drone')).toBe('drone');
  });
});

describe('bandlar', () => {
  it('band turi: butun mashina yoki joylar soni', () => {
    expect(bookingKindLabel({ bookingKind: 'whole_car', seats: 4 })).toBe('Butun mashina');
    expect(bookingKindLabel({ bookingKind: 'seat', seats: 2 })).toBe('2 joy');
    expect(bookingKindLabel({ bookingKind: null, seats: null })).toBe('1 joy');
  });

  it("dispetcher faqat yig'ish boshlanmagan bandni bekor qiladi", () => {
    expect(canDispatcherCancel({ status: 'scheduled' })).toBe(true);
    for (const status of ['accepted', 'arrived', 'in_progress', 'completed', 'cancelled'] as const) {
      expect(canDispatcherCancel({ status })).toBe(false);
    }
  });

  it('har bir band holatining yorlig\'i va belgisi bor', () => {
    for (const status of Object.keys(intercityBookingStatusLabels()) as (keyof ReturnType<typeof intercityBookingStatusLabels>)[]) {
      expect(intercityBookingStatusLabels()[status]).toBeTruthy();
      expect(INTERCITY_BOOKING_STATUS_BADGE[status]).toBeTruthy();
    }
  });
});

describe('applyTripUpdate', () => {
  const page = { items: [TRIP, { ...TRIP, id: 't2' }], total: 2, page: 1, limit: 50 };
  const payload = {
    tripId: 't1',
    status: 'full' as const,
    seatsTaken: 4,
    seatsTotal: 4,
    wholeCarBooked: true,
    departureAt: TRIP.departureAt,
  };

  it('faqat mos qatnovni yangilaydi va asl sahifani o‘zgartirmaydi', () => {
    const next = applyTripUpdate(page, payload);
    expect(next).not.toBeNull();
    expect(next!.items[0]).toMatchObject({ status: 'full', seatsLeft: 0, wholeCarBooked: true, wholeCarAvailable: false });
    expect(next!.items[1]).toBe(page.items[1]);
    expect(page.items[0].status).toBe('open');
  });

  it("joy bo'shasa butun mashina yana mumkin", () => {
    const next = applyTripUpdate(page, { ...payload, status: 'open', seatsTaken: 0, wholeCarBooked: false });
    expect(next!.items[0]).toMatchObject({ seatsLeft: 4, wholeCarAvailable: true });
  });

  it("ro'yxatda yo'q qatnov — null (to'liq qayta yuklash)", () => {
    expect(applyTripUpdate(page, { ...payload, tripId: 'boshqa' })).toBeNull();
  });
});

describe('zonesLabel', () => {
  it("tanlanmagan — hamma tumanlar (cheklov yo'q)", () => {
    expect(zonesLabel(undefined)).toBe('Hamma tumanlar');
    expect(zonesLabel([])).toBe('Hamma tumanlar');
  });
  it('tanlanganlar vergul bilan', () => {
    expect(zonesLabel([{ name: 'Yunusobod' }, { name: "Mirzo Ulug'bek" }])).toBe("Yunusobod, Mirzo Ulug'bek");
  });
});
