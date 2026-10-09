import { describe, expect, it } from 'vitest';
import { vendorCashView } from './vendor-cash';

const base = {
  paymentMethod: 'cash' as const,
  items: [
    { qty: 2, price: 30000 },
    { qty: 1, price: 5000 },
  ],
};

describe('vendorCashView', () => {
  it('karta buyurtmasida kuryer hech narsa to‘lamaydi', () => {
    expect(vendorCashView({ ...base, paymentMethod: 'card' })).toEqual({ step: 'none', amount: 0 });
  });

  it('summa — faqat tovar, yetkazishsiz', () => {
    expect(vendorCashView(base)).toEqual({ step: 'awaiting_courier', amount: 65000 });
  });

  it('kuryer to‘ladi → sotuvchi qarori, keyin tasdiq yoki nizo', () => {
    const paid = { ...base, vendorCashPaidAt: '2026-10-07T10:00:00Z' };
    expect(vendorCashView(paid).step).toBe('awaiting_vendor');
    expect(vendorCashView({ ...paid, vendorCashConfirmedAt: '2026-10-07T10:01:00Z' }).step).toBe('confirmed');
    expect(vendorCashView({ ...paid, vendorCashDisputedAt: '2026-10-07T10:01:00Z' }).step).toBe('disputed');
  });

  it('dispetcher nizoni yopgach — hal qilindi, izohi bilan', () => {
    const view = vendorCashView({
      ...base,
      vendorCashPaidAt: '2026-10-07T10:00:00Z',
      vendorCashDisputedAt: '2026-10-07T10:01:00Z',
      vendorCashDisputeResolvedAt: '2026-10-07T11:00:00Z',
      vendorCashDisputeResolution: 'Kuryer pulni olib keldi',
    });
    expect(view.step).toBe('resolved');
    expect(view.resolution).toBe('Kuryer pulni olib keldi');
  });
});
