import { describe, expect, it } from 'vitest';
import { tinError } from './tin';

describe('tinError', () => {
  it("bo'sh — ixtiyoriy, xato yo'q", () => {
    expect(tinError('')).toBeNull();
    expect(tinError('   ')).toBeNull();
  });
  it('9 raqam — to‘g‘ri', () => {
    expect(tinError('123456789')).toBeNull();
  });
  it('uzunligi noto‘g‘ri yoki raqam emas — xato', () => {
    expect(tinError('12345')).toMatch(/9 ta raqam/);
    expect(tinError('1234567890')).toMatch(/9 ta raqam/);
    expect(tinError('12345678a')).toBe('Faqat raqamlar');
  });
});
