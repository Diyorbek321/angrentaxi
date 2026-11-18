import { describe, expect, it } from 'vitest';
import { RESOLUTION_MAX, validateResolution } from './cash-dispute';

describe('naqd nizo izohi', () => {
  it('bo\'sh yoki juda qisqa izoh qabul qilinmaydi', () => {
    expect(validateResolution('')).toBeTruthy();
    expect(validateResolution('   ok ')).toBeTruthy();
  });

  it('oddiy izoh o\'tadi', () => {
    expect(validateResolution("Kuryer pulni do'konga olib bordi")).toBeNull();
  });

  it('backend chegarasidan (500) uzun izoh qabul qilinmaydi', () => {
    expect(validateResolution('a'.repeat(RESOLUTION_MAX + 1))).toBeTruthy();
    expect(validateResolution('a'.repeat(RESOLUTION_MAX))).toBeNull();
  });
});
