import { describe, expect, it } from 'vitest';
import { isTinChanged, parseTinInput } from './vendor-tin';

describe('parseTinInput', () => {
  it('accepts exactly 9 digits, ignoring spaces and dashes', () => {
    expect(parseTinInput('123456789')).toEqual({ ok: true, tin: '123456789' });
    expect(parseTinInput(' 123-456 789 ')).toEqual({ ok: true, tin: '123456789' });
  });

  it('treats empty input as clearing the TIN', () => {
    expect(parseTinInput('')).toEqual({ ok: true, tin: null });
    expect(parseTinInput('   ')).toEqual({ ok: true, tin: null });
  });

  it('rejects wrong length or non-digits', () => {
    expect(parseTinInput('12345678').ok).toBe(false);
    expect(parseTinInput('1234567890').ok).toBe(false);
    expect(parseTinInput('12345678a').ok).toBe(false);
  });
});

describe('isTinChanged', () => {
  it('compares with null-normalisation', () => {
    expect(isTinChanged(undefined, null)).toBe(false);
    expect(isTinChanged(null, null)).toBe(false);
    expect(isTinChanged('123456789', '123456789')).toBe(false);
    expect(isTinChanged('123456789', null)).toBe(true);
    expect(isTinChanged(null, '987654321')).toBe(true);
  });
});
