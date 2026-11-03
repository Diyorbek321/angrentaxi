import { describe, expect, it } from 'vitest';
import {
  DELIVERY_FAILURE_REASONS,
  INCIDENT_NOTE_MAX,
  canMarkDeliveryFailed,
  deliveryState,
  isHandoverService,
  upsertStuckDelivery,
  validateIncidentNote,
  type StuckDelivery,
} from './delivery-incident';

const ride = (over: Record<string, unknown> = {}) => ({
  status: 'in_progress' as const,
  serviceType: 'food',
  deliveryFailedAt: null,
  deliveryOutcome: null,
  ...over,
});

describe('yetkazish holati (deliveryState)', () => {
  it("in_progress + deliveryFailedAt → qaytarilmoqda", () => {
    expect(deliveryState(ride({ deliveryFailedAt: '2026-11-03T10:00:00Z' }))).toBe('returning');
  });

  it("completed + deliveryOutcome=returned → qaytarildi", () => {
    expect(deliveryState(ride({ status: 'completed', deliveryOutcome: 'returned' }))).toBe('returned');
  });

  it('oddiy safar → null', () => {
    expect(deliveryState(ride())).toBeNull();
    expect(deliveryState(ride({ status: 'completed' }))).toBeNull();
    // Maydonlar umuman yo'q (eski javob) — xato bermaydi
    expect(deliveryState({ status: 'in_progress' })).toBeNull();
  });
});

describe('"Yetkazib bo\'lmadi" tugmasi', () => {
  it('faqat parcel/food/market, in_progress va hali qaytarilmayotgan', () => {
    expect(canMarkDeliveryFailed(ride())).toBe(true);
    expect(canMarkDeliveryFailed(ride({ serviceType: 'parcel' }))).toBe(true);
    expect(canMarkDeliveryFailed(ride({ serviceType: 'market' }))).toBe(true);
  });

  it('taksi/yuk, boshqa status yoki qaytarilayotgan safarda yo\'q', () => {
    expect(canMarkDeliveryFailed(ride({ serviceType: 'taxi' }))).toBe(false);
    expect(canMarkDeliveryFailed(ride({ serviceType: 'cargo' }))).toBe(false);
    expect(canMarkDeliveryFailed(ride({ serviceType: undefined }))).toBe(false);
    expect(canMarkDeliveryFailed(ride({ status: 'arrived' }))).toBe(false);
    expect(canMarkDeliveryFailed(ride({ deliveryFailedAt: '2026-11-03T10:00:00Z' }))).toBe(false);
  });

  it('topshirish kodi xizmatlari', () => {
    expect(['parcel', 'food', 'market'].every(isHandoverService)).toBe(true);
    expect(isHandoverService('taxi')).toBe(false);
  });

  it('sabablar backend enum bilan bir xil', () => {
    expect([...DELIVERY_FAILURE_REASONS]).toEqual(['customer_absent', 'customer_refused', 'unreachable']);
  });
});

describe('hodisa izohi', () => {
  it("bo'sh yoki juda qisqa izoh qabul qilinmaydi", () => {
    expect(validateIncidentNote('')).toBeTruthy();
    expect(validateIncidentNote('  a ')).toBeTruthy();
  });

  it('oddiy izoh o\'tadi, 500 dan uzuni yo\'q', () => {
    expect(validateIncidentNote("Mijoz telefonni ko'tarmadi")).toBeNull();
    expect(validateIncidentNote('a'.repeat(INCIDENT_NOTE_MAX))).toBeNull();
    expect(validateIncidentNote('a'.repeat(INCIDENT_NOTE_MAX + 1))).toBeTruthy();
  });
});

describe('osilib qolgan yetkazishlar ro\'yxati (socket)', () => {
  const base: StuckDelivery = {
    orderId: 'a',
    status: 'in_progress',
    serviceType: 'food',
    returning: false,
    driverId: 'd1',
    driverName: 'Ali',
    driverPhone: '+998901112233',
    pickupAddress: 'X',
    dropoffAddress: 'Y',
    startedAt: '2026-11-03T09:00:00Z',
    locationUpdatedAt: null,
    reasons: ['too_long'],
  };

  it('yangisi boshiga qo\'shiladi', () => {
    const list = upsertStuckDelivery([base], { ...base, orderId: 'b' });
    expect(list.map((s) => s.orderId)).toEqual(['b', 'a']);
  });

  it('mavjudi joyida yangilanadi, asl massiv o\'zgarmaydi', () => {
    const original = [base];
    const list = upsertStuckDelivery(original, { ...base, reasons: ['too_long', 'stale_location'] });
    expect(list).toHaveLength(1);
    expect(list[0].reasons).toEqual(['too_long', 'stale_location']);
    expect(original[0].reasons).toEqual(['too_long']);
  });
});
