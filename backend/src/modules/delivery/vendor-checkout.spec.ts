import { isSelfDelivered, vendorItemsTotal, vendorOrderCommission, vendorRevenue } from './vendor-checkout';

/**
 * Sotuvchi komissiyasi FAQAT tovardan (egasi tasdiqlagan biznes qarori):
 * yetkazish haqi hech qachon komissiya bazasiga kirmaydi.
 */
describe('vendor commission base', () => {
  // Tovar 50 000 (aksiyadan keyingi narxlar) + yetkazish 8 000.
  const order = {
    totalPrice: 58000,
    items: [
      { qty: 2, price: 20000 },
      { qty: 1, price: 10000 },
    ],
  };

  it('items total excludes the delivery fee', () => {
    expect(vendorItemsTotal(order)).toBe(50000);
  });

  it('12% of 50 000 items + 8 000 delivery is 6 000, not 6 960', () => {
    expect(vendorOrderCommission(order, 12)).toBe(6000);
  });

  it('free delivery: base is the whole total', () => {
    expect(vendorOrderCommission({ ...order, totalPrice: 50000 }, 12)).toBe(6000);
  });

  it('a platform promo code does not shrink the base (platform pays it, §26)', () => {
    expect(vendorOrderCommission({ ...order, promoDiscount: 10000 } as never, 12)).toBe(6000);
  });

  it('reads decimal strings from the DB the same way', () => {
    expect(vendorOrderCommission({ totalPrice: '58000.00', items: order.items } as never, '12.00' as never)).toBe(6000);
  });
});

describe('vendor revenue by who delivered', () => {
  const order = { totalPrice: 58000, items: [{ qty: 1, price: 50000 }] };

  it('platform courier: vendor earns the items only (delivery fee is the courier’s)', () => {
    expect(isSelfDelivered({ deliveryOrderId: 'ride-1' })).toBe(false);
    expect(vendorRevenue({ ...order, deliveryOrderId: 'ride-1' })).toBe(50000);
  });

  it('own courier: the delivery fee stays the vendor’s revenue', () => {
    expect(isSelfDelivered({ deliveryOrderId: null })).toBe(true);
    expect(vendorRevenue({ ...order, deliveryOrderId: null })).toBe(58000);
  });
});
