import { describe, expect, it } from 'vitest';
import { kycDocumentLabel, validateReview } from './driver-review';

const TODAY = new Date('2026-09-27T10:00:00Z');

describe('validateReview', () => {
  it('requires a real reason to reject', () => {
    expect(validateReview({ approved: false, reason: '  ', validUntil: '' }, TODAY).ok).toBe(false);
    expect(validateReview({ approved: false, reason: 'Rasm xira', validUntil: '' }, TODAY)).toEqual({
      ok: true,
      decision: { approved: false, reason: 'Rasm xira' },
    });
  });

  it('approves without an expiry when none is given', () => {
    expect(validateReview({ approved: true, reason: '', validUntil: '' }, TODAY)).toEqual({
      ok: true,
      decision: { approved: true },
    });
  });

  it('passes a future expiry through and refuses a past one', () => {
    expect(validateReview({ approved: true, reason: '', validUntil: '2027-03-14' }, TODAY)).toEqual({
      ok: true,
      decision: { approved: true, validUntil: '2027-03-14' },
    });
    expect(validateReview({ approved: true, reason: '', validUntil: '2026-09-26' }, TODAY).ok).toBe(false);
  });
});

describe('kycDocumentLabel', () => {
  it('names known types and falls back to the raw code', () => {
    expect(kycDocumentLabel('passport')).toBe('Pasport');
    expect(kycDocumentLabel('insurance')).toBe('insurance');
  });
});
