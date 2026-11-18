import { describe, expect, it } from 'vitest';
import {
  BALANCE_ADJUSTMENT_MAX,
  balanceAdjustmentErrorMessage,
  manualAdjustmentLimitMessage,
  validateBalanceAdjustment,
} from './balance-adjustment';
import { formatMoney } from './format';

const axiosError = (data: unknown, status = 400) => ({ response: { status, data } });

describe('validateBalanceAdjustment', () => {
  it('accepts non-zero whole sums within ±5 000 000', () => {
    expect(validateBalanceAdjustment('50000')).toBeNull();
    expect(validateBalanceAdjustment('-10000')).toBeNull();
    expect(validateBalanceAdjustment(String(BALANCE_ADJUSTMENT_MAX))).toBeNull();
    expect(validateBalanceAdjustment(String(-BALANCE_ADJUSTMENT_MAX))).toBeNull();
  });

  it('rejects empty, zero, NaN, fractions and out-of-range', () => {
    expect(validateBalanceAdjustment('')).toMatch(/Noldan/);
    expect(validateBalanceAdjustment('0')).toMatch(/Noldan/);
    expect(validateBalanceAdjustment('abc')).toMatch(/Noldan/);
    expect(validateBalanceAdjustment('100.5')).toMatch(/butun/);
    expect(validateBalanceAdjustment('5000001')).toMatch(/oshmasligi/);
    expect(validateBalanceAdjustment('-5000001')).toMatch(/oshmasligi/);
  });
});

describe('MANUAL_ADJUSTMENT_LIMIT', () => {
  it('names the limit from details', () => {
    const err = axiosError({ code: 'MANUAL_ADJUSTMENT_LIMIT', message: 'srv', details: { limit: 2000000 } }, 403);
    expect(manualAdjustmentLimitMessage(err)).toContain(formatMoney(2000000));
    expect(balanceAdjustmentErrorMessage(err, 'fallback')).toContain(formatMoney(2000000));
  });

  it('falls back without a limit and ignores other codes', () => {
    const noLimit = axiosError({ code: 'MANUAL_ADJUSTMENT_LIMIT' }, 403);
    expect(manualAdjustmentLimitMessage(noLimit)).toMatch(/admin/i);
    const other = axiosError({ code: 'OTHER', message: 'Server matni' });
    expect(manualAdjustmentLimitMessage(other)).toBeNull();
    expect(balanceAdjustmentErrorMessage(other, 'fallback')).toBe('Server matni');
    expect(balanceAdjustmentErrorMessage(new Error('x'), 'fallback')).toBe('fallback');
  });
});
