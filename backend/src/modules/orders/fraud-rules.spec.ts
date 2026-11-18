import { assessTrip, FraudFacts, parseDeviceId } from './fraud-rules';

const clean: FraudFacts = {
  sameDevice: false,
  acceptDistanceM: 1200,
  pairTripsLast7Days: 1,
  passengerAccountAgeDays: 90,
  passengerCompletedTrips: 20,
  passengerTripsWithThisDriver: 1,
  distanceKm: 6.2,
  durationMin: 14,
};

describe('assessTrip — o\'zini o\'zi zakaz qilish belgilari', () => {
  it('oddiy safar toza', () => {
    expect(assessTrip(clean)).toEqual({ signals: [], flagged: false });
  });

  it('bitta telefon — kuchli belgi, darhol shubhali', () => {
    const r = assessTrip({ ...clean, sameDevice: true });
    expect(r.signals).toEqual(['same_device']);
    expect(r.flagged).toBe(true);
  });

  it('bir juftlik haftada 3 marta — shubhali', () => {
    expect(assessTrip({ ...clean, pairTripsLast7Days: 3 }).flagged).toBe(true);
    expect(assessTrip({ ...clean, pairTripsLast7Days: 2 }).flagged).toBe(false);
  });

  it('yangi akkaunt faqat shu haydovchi bilan yuradi — shubhali', () => {
    const r = assessTrip({
      ...clean,
      passengerAccountAgeDays: 2,
      passengerCompletedTrips: 2,
      passengerTripsWithThisDriver: 2,
    });
    expect(r.signals).toContain('new_passenger_one_driver');
    expect(r.flagged).toBe(true);
  });

  it('yangi akkauntning BIRINCHI safari shubhali emas — hamma birinchi safardan boshlaydi', () => {
    const r = assessTrip({
      ...clean,
      passengerAccountAgeDays: 0,
      passengerCompletedTrips: 1,
      passengerTripsWithThisDriver: 1,
    });
    expect(r.flagged).toBe(false);
  });

  it('kuchsiz belgi yolg\'iz o\'zi shubhali qilmaydi (bekatdagi haydovchi)', () => {
    const r = assessTrip({ ...clean, acceptDistanceM: 20 });
    expect(r.signals).toEqual(['driver_at_pickup']);
    expect(r.flagged).toBe(false);
  });

  it('ikki kuchsiz belgi birga — shubhali', () => {
    const r = assessTrip({ ...clean, acceptDistanceM: 20, distanceKm: 0.3, durationMin: 1 });
    expect(r.signals).toEqual(['driver_at_pickup', 'too_short']);
    expect(r.flagged).toBe(true);
  });

  it('noma\'lum qiymatlar belgi bermaydi', () => {
    const r = assessTrip({ ...clean, acceptDistanceM: null, distanceKm: null, durationMin: null });
    expect(r).toEqual({ signals: [], flagged: false });
  });
});

describe('parseDeviceId', () => {
  it('ANDROID_ID ko\'rinishini qabul qiladi', () => {
    expect(parseDeviceId('9774d56d682e549c')).toBe('9774d56d682e549c');
  });

  it('yaroqsiz yoki xavfli qiymat null', () => {
    expect(parseDeviceId(undefined)).toBeNull();
    expect(parseDeviceId('abc')).toBeNull();
    expect(parseDeviceId("1'; DROP TABLE orders;--")).toBeNull();
    expect(parseDeviceId('x'.repeat(65))).toBeNull();
  });
});
