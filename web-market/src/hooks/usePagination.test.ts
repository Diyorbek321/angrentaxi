import { describe, expect, it } from 'vitest';
import { rangeLabel } from './usePagination';

describe('rangeLabel', () => {
  it('birinchi sahifa', () => {
    expect(rangeLabel(1, 25, 118)).toBe('1–25 / 118');
  });

  it('oxirgi to‘liq bo‘lmagan sahifa', () => {
    expect(rangeLabel(5, 25, 118)).toBe('101–118 / 118');
  });

  it('bo‘sh ro‘yxat', () => {
    expect(rangeLabel(1, 25, 0)).toBe('0–0 / 0');
  });
});
