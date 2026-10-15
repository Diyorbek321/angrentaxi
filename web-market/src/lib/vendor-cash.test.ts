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

describe('vendorCashView — hamyon rejimi', () => {
  const order = { ...base };
  const SETTLED = '2026-12-12T10:00:00Z';
  const REVERSED = '2026-12-12T10:30:00Z';
  // Komissiya o'tkazma paytidagi stavka bilan saqlangan (10%) — joriy stavkadan qayta hisoblanmaydi.
  const settlement = { amount: 65000, commission: 6500, net: 58500, settledAt: SETTLED, reversedAt: null, reversalCount: 0 };

  it('hamyon rejimida naqd tasdig‘i so‘ralmaydi', () => {
    expect(vendorCashView(order, { mode: 'wallet' })).toEqual({ step: 'wallet_pending', amount: 65000 });
    // Kuryer "to'ladim" desa ham — sotuvchi qarori emas.
    expect(vendorCashView({ ...order, vendorCashPaidAt: SETTLED }, { mode: 'wallet' }).step).toBe('wallet_pending');
  });

  it('o‘tkazilgan — summalar backend saqlaganidek (vendorWalletSettlement)', () => {
    const settled = { ...order, vendorWalletSettledAt: SETTLED, vendorWalletSettlement: settlement };
    expect(vendorCashView(settled, { mode: 'wallet' })).toEqual({
      step: 'wallet_settled',
      amount: 65000,
      commission: 6500,
      net: 58500,
    });
    // Rejim keyin naqdga qaytgan bo'lsa ham o'tkazma ko'rinadi.
    expect(vendorCashView(settled, { mode: 'cash' }).step).toBe('wallet_settled');
  });

  it('saqlangan summa tovar yig‘indisidan farq qilsa ham — saqlangani', () => {
    const view = vendorCashView({
      ...order,
      vendorWalletSettlement: { ...settlement, amount: 60000, commission: 3000, net: 57000 },
    });
    expect(view).toMatchObject({ amount: 60000, commission: 3000, net: 57000 });
  });

  it('eski backend: faqat payt bor — summa tovardan, komissiyasiz', () => {
    expect(vendorCashView({ ...order, vendorWalletSettledAt: SETTLED })).toEqual({ step: 'wallet_settled', amount: 65000 });
  });

  it('teskari qilingan — Qaytarildi', () => {
    const reversed = {
      ...order,
      vendorWalletSettlement: { ...settlement, settledAt: null, reversedAt: REVERSED, reversalCount: 1 },
      delivery: { status: 'cancelled' },
    };
    expect(vendorCashView(reversed, { mode: 'wallet' })).toEqual({
      step: 'wallet_reversed',
      amount: 65000,
      commission: 6500,
      net: 58500,
      reversedAt: REVERSED,
      reversalCount: 1,
    });
    // Kuryer safari yo'q — ham teskari holat.
    expect(vendorCashView({ ...reversed, delivery: null }, { mode: 'wallet' }).step).toBe('wallet_reversed');
  });

  it('teskaridan keyin yangi kuryer biriktirildi — qayta o‘tkazish kutilmoqda', () => {
    const reversed = {
      ...order,
      vendorWalletSettlement: { ...settlement, settledAt: null, reversedAt: REVERSED, reversalCount: 1 },
    };
    for (const status of ['accepted', 'arrived']) {
      expect(vendorCashView({ ...reversed, delivery: { status } }, { mode: 'wallet' }).step).toBe(
        'wallet_resettle_pending'
      );
    }
    // Hali izlanmoqda — kuryer yo'q.
    expect(vendorCashView({ ...reversed, delivery: { status: 'searching' } }, { mode: 'wallet' }).step).toBe(
      'wallet_reversed'
    );
    // Rejim naqdga o'tgan — yangi kuryer hamyondan o'tkazmaydi.
    expect(vendorCashView({ ...reversed, delivery: { status: 'accepted' } }, { mode: 'cash' }).step).toBe(
      'wallet_reversed'
    );
  });

  it('teskaridan keyin qayta o‘tkazilgan — settled, teskari payti bilan', () => {
    const view = vendorCashView({
      ...order,
      vendorWalletSettlement: { ...settlement, reversedAt: REVERSED, reversalCount: 1 },
    });
    expect(view).toMatchObject({ step: 'wallet_settled', reversedAt: REVERSED, reversalCount: 1 });
  });

  it('karta buyurtmasi hamyon rejimida ham tegilmaydi', () => {
    expect(
      vendorCashView({ ...order, paymentMethod: 'card', vendorWalletSettlement: settlement }, { mode: 'wallet' }).step
    ).toBe('none');
  });
});
