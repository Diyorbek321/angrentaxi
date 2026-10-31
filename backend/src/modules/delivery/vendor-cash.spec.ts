import { BadRequestException } from '@nestjs/common';
import { assertCashWithinLimit, vendorCashState } from './vendor-cash';

describe('assertCashWithinLimit — naqd buyurtma chegarasi', () => {
  it('chegaragacha naqd mumkin', () => {
    expect(() => assertCashWithinLimit(true, 200000, 200000)).not.toThrow();
  });

  it('chegaradan oshsa naqd rad etiladi, sabab tushunarli', () => {
    expect(() => assertCashWithinLimit(true, 200001, 200000)).toThrow(BadRequestException);
    expect(() => assertCashWithinLimit(true, 250000, 200000)).toThrow(/200 000/);
  });

  it('karta bilan chegara yo\'q', () => {
    expect(() => assertCashWithinLimit(false, 900000, 200000)).not.toThrow();
  });

  it('chegara 0 — o\'chirilgan', () => {
    expect(() => assertCashWithinLimit(true, 900000, 0)).not.toThrow();
  });
});

describe('vendorCashState', () => {
  const none = { vendorCashPaidAt: null, vendorCashConfirmedAt: null, vendorCashDisputedAt: null };
  const at = new Date('2026-10-07T10:00:00Z');

  it('naqd bo\'lmasa holat yo\'q', () => {
    expect(vendorCashState(false, none)).toBe('not_applicable');
  });

  it('kuryer to\'lamaguncha — kutilmoqda', () => {
    expect(vendorCashState(true, none)).toBe('awaiting_courier');
  });

  it('kuryer to\'ladi, sotuvchi tasdiqlamagan', () => {
    expect(vendorCashState(true, { ...none, vendorCashPaidAt: at })).toBe('awaiting_vendor');
  });

  it('tasdiqlangan va nizo', () => {
    expect(vendorCashState(true, { ...none, vendorCashPaidAt: at, vendorCashConfirmedAt: at })).toBe('confirmed');
    expect(vendorCashState(true, { ...none, vendorCashPaidAt: at, vendorCashDisputedAt: at })).toBe('disputed');
    expect(
      vendorCashState(true, { ...none, vendorCashPaidAt: at, vendorCashDisputedAt: at, vendorCashDisputeResolvedAt: at }),
    ).toBe('resolved');
  });
});
