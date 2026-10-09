import { describe, expect, it } from 'vitest';
import { advanceLabelFor } from './order-status';

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
