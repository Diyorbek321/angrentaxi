import { describe, expect, it } from 'vitest';
import {
  INTERCITY_STATUS_BADGE,
  INTERCITY_STATUS_LABELS,
  INTERCITY_TRIP_STATUSES,
  SERVICE_TYPE_LABELS,
  addDays,
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
      expect(INTERCITY_STATUS_LABELS[status]).toBeTruthy();
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
    expect(SERVICE_TYPE_LABELS.intercity).toBe('Shaharlararo');
    expect(serviceTypeLabel('intercity')).toBe('Shaharlararo');
    expect(serviceTypeLabel('parcel')).toBe('Posilka');
    expect(serviceTypeLabel(undefined)).toBe('Taksi');
    expect(serviceTypeLabel('drone')).toBe('drone');
  });
});
