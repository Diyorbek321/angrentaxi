import { describe, expect, it } from 'vitest';
import {
  INTERCITY_MAX_PRICE,
  parseOptionalPrice,
  routeLabel,
  toRoutePayload,
  validateIntercitySettings,
  validatePointForm,
  validateRouteForm,
  type IntercityRouteForm,
} from './intercity';

const VALID: IntercityRouteForm = {
  originPointId: 'a',
  destinationPointId: 'b',
  seatPrice: 25000,
  wholeCarPrice: 100000,
  comfortSeatPrice: 30000,
  comfortWholeCarPrice: 120000,
  seatsDefault: 4,
};

describe('validateRouteForm', () => {
  it("to'g'ri narxlar — xato yo'q", () => {
    expect(validateRouteForm(VALID)).toEqual({});
  });

  it("Comfort'siz yo'nalish ham to'g'ri", () => {
    expect(validateRouteForm({ ...VALID, comfortSeatPrice: null, comfortWholeCarPrice: null })).toEqual({});
  });

  it('nuqtalar tanlanmagan yoki bir xil', () => {
    expect(validateRouteForm({ ...VALID, originPointId: '' }).originPointId).toBeDefined();
    expect(validateRouteForm({ ...VALID, destinationPointId: '' }).destinationPointId).toBeDefined();
    expect(validateRouteForm({ ...VALID, destinationPointId: 'a' }).destinationPointId).toBeDefined();
  });

  it("o'rindiq narxi musbat butun son va chegaradan oshmaydi", () => {
    expect(validateRouteForm({ ...VALID, seatPrice: 0 }).seatPrice).toBeDefined();
    expect(validateRouteForm({ ...VALID, seatPrice: 1500.5 }).seatPrice).toBeDefined();
    expect(validateRouteForm({ ...VALID, seatPrice: INTERCITY_MAX_PRICE + 1 }).seatPrice).toBeDefined();
  });

  it("butun mashina o'rindiqdan arzon bo'lolmaydi", () => {
    expect(validateRouteForm({ ...VALID, wholeCarPrice: 20000 }).wholeCarPrice).toBeDefined();
    expect(validateRouteForm({ ...VALID, wholeCarPrice: 25000, comfortWholeCarPrice: 120000 })).toEqual({});
  });

  it("Comfort ikkala narxi birga kiritiladi", () => {
    expect(validateRouteForm({ ...VALID, comfortWholeCarPrice: null }).comfortWholeCarPrice).toBeDefined();
    expect(validateRouteForm({ ...VALID, comfortSeatPrice: null }).comfortSeatPrice).toBeDefined();
  });

  it("Comfort Start'dan arzon bo'lolmaydi", () => {
    expect(validateRouteForm({ ...VALID, comfortSeatPrice: 20000 }).comfortSeatPrice).toBeDefined();
    expect(validateRouteForm({ ...VALID, comfortWholeCarPrice: 90000 }).comfortWholeCarPrice).toBeDefined();
  });

  it("Comfort butun mashina Comfort o'rindiqdan arzon bo'lolmaydi", () => {
    const errors = validateRouteForm({
      ...VALID,
      wholeCarPrice: 25000,
      comfortSeatPrice: 130000,
      comfortWholeCarPrice: 120000,
    });
    expect(errors.comfortWholeCarPrice).toBeDefined();
  });

  it("o'rindiqlar soni 1–8 butun son", () => {
    expect(validateRouteForm({ ...VALID, seatsDefault: 0 }).seatsDefault).toBeDefined();
    expect(validateRouteForm({ ...VALID, seatsDefault: 9 }).seatsDefault).toBeDefined();
    expect(validateRouteForm({ ...VALID, seatsDefault: 2.5 }).seatsDefault).toBeDefined();
    expect(validateRouteForm({ ...VALID, seatsDefault: 8 })).toEqual({});
  });
});

describe('validatePointForm', () => {
  const POINT = { name: 'Angren', centerLat: 41.0167, centerLng: 70.1436, radiusKm: 12 };

  it("to'g'ri nuqta", () => {
    expect(validatePointForm(POINT)).toEqual({});
  });

  it('nom, koordinata va radius chegaralari', () => {
    expect(validatePointForm({ ...POINT, name: '  ' }).name).toBeDefined();
    expect(validatePointForm({ ...POINT, centerLat: 91 }).centerLat).toBeDefined();
    expect(validatePointForm({ ...POINT, centerLng: -181 }).centerLng).toBeDefined();
    expect(validatePointForm({ ...POINT, centerLat: Number.NaN }).centerLat).toBeDefined();
    expect(validatePointForm({ ...POINT, radiusKm: 0.4 }).radiusKm).toBeDefined();
    expect(validatePointForm({ ...POINT, radiusKm: 51 }).radiusKm).toBeDefined();
  });
});

describe('validateIntercitySettings', () => {
  const SETTINGS = {
    intercityEnabled: false,
    intercityFreeCancelMinutes: 60,
    intercityMaxSeatsPerBooking: 4,
    intercityMinLeadMinutes: 30,
    intercityMaxAheadDays: 7,
  };

  it('standart qiymatlar to‘g‘ri', () => {
    expect(validateIntercitySettings(SETTINGS)).toEqual({});
  });

  it('backend DTO chegaralari bilan bir xil', () => {
    expect(validateIntercitySettings({ ...SETTINGS, intercityFreeCancelMinutes: 1441 }).intercityFreeCancelMinutes).toBeDefined();
    expect(validateIntercitySettings({ ...SETTINGS, intercityMaxSeatsPerBooking: 0 }).intercityMaxSeatsPerBooking).toBeDefined();
    expect(validateIntercitySettings({ ...SETTINGS, intercityMaxSeatsPerBooking: 9 }).intercityMaxSeatsPerBooking).toBeDefined();
    expect(validateIntercitySettings({ ...SETTINGS, intercityMinLeadMinutes: 721 }).intercityMinLeadMinutes).toBeDefined();
    expect(validateIntercitySettings({ ...SETTINGS, intercityMaxAheadDays: 0 }).intercityMaxAheadDays).toBeDefined();
    expect(validateIntercitySettings({ ...SETTINGS, intercityMaxAheadDays: 31 }).intercityMaxAheadDays).toBeDefined();
    expect(validateIntercitySettings({ ...SETTINGS, intercityMinLeadMinutes: 1.5 }).intercityMinLeadMinutes).toBeDefined();
  });
});

describe('formatlash', () => {
  it('routeLabel', () => {
    expect(routeLabel({ originPoint: { name: 'Angren' }, destinationPoint: { name: 'Rohat krugi' } })).toBe(
      'Angren → Rohat krugi'
    );
    expect(routeLabel({})).toBe('— → —');
  });

  it('parseOptionalPrice: bo‘sh — null, aks holda son', () => {
    expect(parseOptionalPrice('')).toBeNull();
    expect(parseOptionalPrice('  ')).toBeNull();
    expect(parseOptionalPrice('30000')).toBe(30000);
    expect(Number.isNaN(parseOptionalPrice('abc'))).toBe(true);
  });

  it("toRoutePayload: tahrirda uchlar yuborilmaydi (backend ularni o'zgartirmaydi)", () => {
    expect(toRoutePayload(VALID, 'create')).toEqual(VALID);
    const update = toRoutePayload(VALID, 'update');
    expect(update).not.toHaveProperty('originPointId');
    expect(update).not.toHaveProperty('destinationPointId');
    expect(update).toMatchObject({ seatPrice: 25000, comfortSeatPrice: 30000 });
  });
});
