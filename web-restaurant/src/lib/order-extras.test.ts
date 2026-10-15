import { describe, expect, it } from 'vitest';
import {
  addressDetailLines,
  createCancellationTracker,
  customerCancelText,
  disappearedIds,
  formatAddressShort,
  isCustomerCancelled,
  orderDiscounts,
} from './order-extras';

describe('address details', () => {
  const details = { entrance: '2', floor: ' 5 ', apartment: '34', intercom: '34K', landmark: 'Maktab yonida', courierNote: '' };

  it('lists filled fields in spec order with Uzbek labels', () => {
    expect(addressDetailLines(details)).toEqual([
      { key: 'entrance', label: 'Podyezd', value: '2' },
      { key: 'floor', label: 'Qavat', value: '5' },
      { key: 'apartment', label: 'Xonadon', value: '34' },
      { key: 'intercom', label: 'Domofon', value: '34K' },
      { key: 'landmark', label: 'Moʻljal', value: 'Maktab yonida' },
    ]);
  });

  it('short line covers only the building fields', () => {
    expect(formatAddressShort(details)).toBe('2-podyezd · 5-qavat · 34-xonadon · domofon 34K');
    expect(formatAddressShort({ floor: '3' })).toBe('3-qavat');
  });

  it('null / missing → nothing', () => {
    expect(addressDetailLines(null)).toEqual([]);
    expect(addressDetailLines(undefined)).toEqual([]);
    expect(formatAddressShort(null)).toBe('');
  });
});

describe('orderDiscounts', () => {
  it('reads promo code and both discounts', () => {
    expect(orderDiscounts({ promoCode: 'ANGREN10', promoDiscount: 5000, promotionDiscount: 3000.4 })).toEqual({
      promoCode: 'ANGREN10',
      promoDiscount: 5000,
      promotionDiscount: 3000,
      hasAny: true,
    });
  });
  it('tolerates missing fields', () => {
    expect(orderDiscounts({})).toEqual({ promoCode: null, promoDiscount: 0, promotionDiscount: 0, hasAny: false });
    expect(orderDiscounts({ promoCode: '', promoDiscount: null }).hasAny).toBe(false);
  });
});

describe('customer cancellation', () => {
  it('detects cancelledBy customer', () => {
    expect(isCustomerCancelled({ status: 'cancelled', cancelledBy: 'customer' })).toBe(true);
    expect(isCustomerCancelled({ status: 'cancelled', cancelledBy: 'vendor' })).toBe(false);
    expect(isCustomerCancelled({ status: 'new', cancelledBy: 'customer' })).toBe(false);
    expect(customerCancelText({ cancelReason: ' Kech qoldi ' })).toBe('Mijoz bekor qildi: Kech qoldi');
    expect(customerCancelText({})).toBe('Mijoz bekor qildi');
  });

  it('tracker fires once, only for orders seen before as not cancelled', () => {
    const track = createCancellationTracker();
    expect(track([{ id: '1', status: 'new' }, { id: 'old', status: 'cancelled', cancelledBy: 'customer' }])).toEqual([]);
    const next = [
      { id: '1', status: 'cancelled', cancelledBy: 'customer' },
      { id: 'old', status: 'cancelled', cancelledBy: 'customer' },
      { id: 'fresh', status: 'cancelled', cancelledBy: 'customer' },
    ];
    expect(track(next).map((o) => o.id)).toEqual(['1']);
    expect(track(next)).toEqual([]);
  });

  it('disappearedIds', () => {
    expect(disappearedIds(null, ['a'])).toEqual([]);
    expect(disappearedIds(['a', 'b'], ['b', 'c'])).toEqual(['a']);
  });
});
