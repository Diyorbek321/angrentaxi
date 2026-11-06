import { describe, expect, it } from 'vitest';
import { debtCloseErrorMessage, isDebtCloseReasonValid, selectedDebtTotal, type WalletDebtItem } from './wallet-debt';

const item = (id: string, amount: number): WalletDebtItem => ({
  id,
  amount,
  reason: 'late_cancel',
  orderId: null,
  createdAt: '2026-11-04T10:00:00Z',
});

describe('wallet debt', () => {
  it('sabab: bo\'shliqsiz 3–500 belgi', () => {
    expect(isDebtCloseReasonValid('   ')).toBe(false);
    expect(isDebtCloseReasonValid(' ab ')).toBe(false);
    expect(isDebtCloseReasonValid('abc')).toBe(true);
    expect(isDebtCloseReasonValid('x'.repeat(501))).toBe(false);
  });

  it('tanlangan summa: id bo\'lmasa hammasi', () => {
    const items = [item('a', 3000), item('b', 5000)];
    expect(selectedDebtTotal(items, null)).toBe(8000);
    expect(selectedDebtTotal(items, ['b'])).toBe(5000);
  });

  it('limit xatosi aniq matn, boshqasi server matni', () => {
    const limit = { response: { status: 403, data: { code: 'MANUAL_ADJUSTMENT_LIMIT', details: { limit: 1000 }, message: 'x' } } };
    expect(debtCloseErrorMessage(limit, 'zaxira')).toMatch(/1\s?000/);
    expect(debtCloseErrorMessage({ response: { status: 500, data: {} } }, 'zaxira')).toBe('zaxira');
  });
});
