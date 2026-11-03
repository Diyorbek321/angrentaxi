import { describe, expect, it } from 'vitest';
import { advanceLabelFor, canConfirmReturned, compareOrders, orderStatusMeta, terminalLabel } from './order-status';
import type { MarketOrder } from './api';

describe('advanceLabelFor', () => {
  it('kuryer chaqirilgan buyurtmada "yetkazildi" tugmasi yo\'q', () => {
    expect(advanceLabelFor({ status: 'shipped', deliveryOrderId: 'ride-1' })).toBeUndefined();
  });

  it('kuryersiz buyurtmada (o\'z yetkazishi) tugma bor', () => {
    expect(advanceLabelFor({ status: 'shipped', deliveryOrderId: null })).toBe('Yetkazildi deb belgilash');
  });

  it('oldingi bosqichlar kuryerga bog\'liq emas', () => {
    expect(advanceLabelFor({ status: 'new', deliveryOrderId: 'ride-1' })).toBeTruthy();
  });

  it('yakunlangan buyurtmada tugma yo\'q', () => {
    expect(advanceLabelFor({ status: 'delivered' })).toBeUndefined();
  });
});

describe('qaytarish holatlari (INCIDENT-POLICY §2)', () => {
  it('returning va returned o\'z yozuvi bilan, "new" ga tushib qolmaydi', () => {
    expect(orderStatusMeta('returning').label).toBe('Qaytarilmoqda');
    expect(orderStatusMeta('returned').label).toBe('Qaytarildi');
  });

  it('qaytarish bosqichlarida oldinga tugma yo\'q, qaytarilgani yakuniy', () => {
    expect(advanceLabelFor({ status: 'returning' })).toBeUndefined();
    expect(advanceLabelFor({ status: 'returned' })).toBeUndefined();
    expect(terminalLabel('returned')).toBeTruthy();
  });

  it('"Qaytib keldi" faqat returning holatida', () => {
    expect(canConfirmReturned({ status: 'returning' })).toBe(true);
    expect(canConfirmReturned({ status: 'shipped' })).toBe(false);
    expect(canConfirmReturned({ status: 'returned' })).toBe(false);
  });

  it('navbatda qaytarilayotgan faol buyurtmalar bilan, qaytarilgani yakunlanganlar bilan', () => {
    const o = (status: string, createdAt: string) => ({ status, createdAt }) as unknown as MarketOrder;
    const sorted = [
      o('returned', '2026-11-03T09:00:00Z'),
      o('delivered', '2026-11-03T09:00:00Z'),
      o('returning', '2026-11-03T09:00:00Z'),
      o('shipped', '2026-11-03T09:00:00Z'),
    ].sort(compareOrders);
    expect(sorted.map((x) => x.status)).toEqual(['shipped', 'returning', 'delivered', 'returned']);
  });
});
