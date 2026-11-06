import { LAUNCH_PROMO_COMMISSION_RATE, resolveCommissionRate } from './commission-policy';
import { ServiceType } from '../../database/entities/order.entity';

describe('resolveCommissionRate', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const future = new Date('2026-12-31T00:00:00Z');
  const past = new Date('2026-10-01T00:00:00Z');

  const base = {
    serviceType: ServiceType.TAXI,
    driverRate: null,
    defaultRate: 10,
    launchPromoUntil: null,
    now,
  };

  it('aksiya yo‘q — platforma standarti (mavjud xulq)', () => {
    expect(resolveCommissionRate(base)).toBe(10);
  });

  it('aksiya yo‘q — haydovchining shaxsiy stavkasi yutadi (mavjud xulq)', () => {
    expect(resolveCommissionRate({ ...base, driverRate: 5 })).toBe(5);
    expect(resolveCommissionRate({ ...base, driverRate: 15 })).toBe(15);
  });

  it('aksiya davomida taksi komissiyasi 0', () => {
    expect(LAUNCH_PROMO_COMMISSION_RATE).toBe(0);
    expect(resolveCommissionRate({ ...base, launchPromoUntil: future })).toBe(0);
  });

  it('aksiya davomida shaxsiy stavka aksiyadan YUQORI bo‘lsa — aksiya yutadi', () => {
    expect(resolveCommissionRate({ ...base, driverRate: 5, launchPromoUntil: future })).toBe(0);
  });

  it('aksiya tugagan — oddiy qoida', () => {
    expect(resolveCommissionRate({ ...base, launchPromoUntil: past })).toBe(10);
  });

  it('aksiya faqat taksiga tegishli — yuk/yetkazish o‘zgarmaydi', () => {
    for (const serviceType of [ServiceType.CARGO, ServiceType.PARCEL, ServiceType.FOOD, ServiceType.MARKET]) {
      expect(resolveCommissionRate({ ...base, serviceType, launchPromoUntil: future })).toBe(10);
    }
  });

  it('aksiya tugash lahzasining o‘zida aksiya endi amal qilmaydi', () => {
    expect(resolveCommissionRate({ ...base, launchPromoUntil: now })).toBe(10);
  });
});

describe('resolveCommissionRate — smena (shift pass)', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const future = new Date('2026-12-31T00:00:00Z');
  const base = {
    serviceType: ServiceType.TAXI,
    driverRate: null,
    defaultRate: 10,
    launchPromoUntil: null,
    now,
  };

  it('faol smena — komissiya 0 (standart stavka o‘rniga)', () => {
    expect(resolveCommissionRate({ ...base, shiftPassActive: true })).toBe(0);
  });

  it('faol smena shaxsiy stavkadan ham ustun', () => {
    expect(resolveCommissionRate({ ...base, driverRate: 15, shiftPassActive: true })).toBe(0);
  });

  it('smena va aksiya birga — baribir 0', () => {
    expect(resolveCommissionRate({ ...base, launchPromoUntil: future, shiftPassActive: true })).toBe(0);
  });

  it('smena yo‘q (false yoki berilmagan) — avvalgi qoida', () => {
    expect(resolveCommissionRate({ ...base, shiftPassActive: false })).toBe(10);
    expect(resolveCommissionRate({ ...base, driverRate: 7 })).toBe(7);
  });

  it('smena qaysi xizmatga tegishliligini chaqiruvchi hal qiladi — kuryer safarida ham 0', () => {
    expect(
      resolveCommissionRate({ ...base, serviceType: ServiceType.FOOD, shiftPassActive: true }),
    ).toBe(0);
  });
});
