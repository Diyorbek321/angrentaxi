import { describe, expect, it } from 'vitest';
import { advanceLabelFor, canConfirmReturned, statusMeta } from './order-status';
import { tabOf } from '@/components/orders/queue';

describe('advanceLabelFor', () => {
  it('kuryer chaqirilgan buyurtmada "yetkazildi" tugmasi yo\'q', () => {
    expect(advanceLabelFor({ status: 'ready', deliveryOrderId: 'ride-1' })).toBeUndefined();
  });

  it('kuryersiz buyurtmada (o\'z yetkazishi) tugma bor', () => {
    expect(advanceLabelFor({ status: 'ready', deliveryOrderId: null })).toBe('Yetkazildi deb belgilash');
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
    expect(statusMeta('returning').label).toBe('Qaytarilmoqda');
    expect(statusMeta('returned').label).toBe('Qaytarildi');
  });

  it('qaytarilayotgan buyurtma faol tabda (Tayyor), qaytarilgani jurnalda', () => {
    expect(tabOf('returning')).toBe('ready');
    expect(tabOf('returned')).toBe('done');
  });

  it('qaytarish bosqichlarida oldinga tugma yo\'q', () => {
    expect(advanceLabelFor({ status: 'returning' })).toBeUndefined();
    expect(advanceLabelFor({ status: 'returned' })).toBeUndefined();
  });

  it('"Qaytib keldi" faqat returning holatida', () => {
    expect(canConfirmReturned({ status: 'returning' })).toBe(true);
    expect(canConfirmReturned({ status: 'returned' })).toBe(false);
    expect(canConfirmReturned({ status: 'ready' })).toBe(false);
  });
});
