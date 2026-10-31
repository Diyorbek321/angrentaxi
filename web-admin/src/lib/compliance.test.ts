import { describe, expect, it } from 'vitest';
import * as compliance from './compliance';
import {
  currentTashkentMonth,
  dateRangeToIso,
  describeVendorSettlement,
  enforcementPhase,
  estimateShiftRefund,
  isFiscalProviderLikelyMissing,
  isIsoDate,
  isoToTashkentDate,
  isPinfl,
  isPromoActive,
  isTin,
  isUuid,
  isValidMonth,
  normalizePresets,
  tashkentDateToIso,
  tashkentToday,
  validateOptionalTin,
  validateTopupSettings,
} from './compliance';

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isIsoDate('2026-12-12')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-1-5')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('round-trips a Tashkent date through ISO', () => {
    const iso = tashkentDateToIso('2026-12-12');
    expect(iso).toBe('2026-12-12T00:00:00+05:00');
    expect(isoToTashkentDate(iso)).toBe('2026-12-12');
    // Backend may return UTC: 2026-12-11T19:00Z is 12 Dec in Tashkent.
    expect(isoToTashkentDate('2026-12-11T19:00:00.000Z')).toBe('2026-12-12');
    expect(isoToTashkentDate(null)).toBe('');
    expect(isoToTashkentDate('garbage')).toBe('');
  });

  it('computes today and month in Tashkent time', () => {
    const lateUtc = new Date('2026-10-31T20:00:00Z'); // 1 Nov 01:00 Tashkent
    expect(tashkentToday(lateUtc)).toBe('2026-11-01');
    expect(currentTashkentMonth(lateUtc)).toBe('2026-11');
  });

  it('validates months', () => {
    expect(isValidMonth('2026-10')).toBe(true);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-1')).toBe(false);
  });

  it('turns an inclusive day range into an ISO half-open range', () => {
    expect(dateRangeToIso({ from: '2026-10-01', to: '2026-10-31' })).toEqual({
      from: '2026-10-01T00:00:00+05:00',
      to: '2026-11-01T00:00:00+05:00',
    });
    expect(dateRangeToIso({ from: null, to: '2026-12-31' })).toEqual({ to: '2027-01-01T00:00:00+05:00' });
    expect(dateRangeToIso({ from: null, to: null })).toEqual({});
  });
});

describe('enforcement / promo', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  it('classifies the enforcement phase', () => {
    expect(enforcementPhase(null, now)).toBe('off');
    expect(enforcementPhase('2026-12-01T00:00:00+05:00', now)).toBe('grace');
    expect(enforcementPhase('2026-10-01T00:00:00+05:00', now)).toBe('enforced');
  });

  it('knows when the launch promo is active', () => {
    expect(isPromoActive(null, now)).toBe(false);
    expect(isPromoActive('2027-01-01T00:00:00+05:00', now)).toBe(true);
    expect(isPromoActive('2026-01-01T00:00:00+05:00', now)).toBe(false);
  });
});

describe('identifiers', () => {
  it('checks PINFL, TIN and UUID shapes', () => {
    expect(isPinfl('12345678901234')).toBe(true);
    expect(isPinfl('1234567890123')).toBe(false);
    expect(isTin('301234567')).toBe(true);
    expect(isTin('30123456a')).toBe(false);
    expect(validateOptionalTin('')).toBeNull();
    expect(validateOptionalTin('301234567')).toBeNull();
    expect(validateOptionalTin('3012')).toMatch(/9 ta raqam/);
    expect(isUuid('6f1d2c3b-1a2b-4c3d-8e9f-0a1b2c3d4e5f')).toBe(true);
    expect(isUuid('nope')).toBe(false);
  });
});

describe('wallet top-up settings', () => {
  it('normalizes presets', () => {
    expect(normalizePresets([200000, 50000, 50000, 100000])).toEqual([50000, 100000, 200000]);
  });

  it('accepts the defaults', () => {
    expect(
      validateTopupSettings({ walletTopupMin: 10000, walletTopupMax: 2000000, walletTopupPresets: [50000] })
    ).toEqual({});
  });

  it('rejects inverted bounds, out-of-range and too many presets', () => {
    expect(
      validateTopupSettings({ walletTopupMin: 50000, walletTopupMax: 10000, walletTopupPresets: [] })
        .walletTopupMax
    ).toBeDefined();
    expect(
      validateTopupSettings({ walletTopupMin: 500, walletTopupMax: 10000, walletTopupPresets: [] }).walletTopupMin
    ).toBeDefined();
    expect(
      validateTopupSettings({ walletTopupMin: 10000, walletTopupMax: 20000, walletTopupPresets: [30000] })
        .walletTopupPresets
    ).toBeDefined();
    expect(
      validateTopupSettings({
        walletTopupMin: 1000,
        walletTopupMax: 100000,
        walletTopupPresets: [1000, 2000, 3000, 4000, 5000, 6000, 7000],
      }).walletTopupPresets
    ).toMatch(/6/);
  });
});

describe('estimateShiftRefund', () => {
  const pass = { price: 24000, startsAt: '2026-10-15T00:00:00Z', endsAt: '2026-10-16T00:00:00Z' };
  it('refunds in full before start, nothing after end, pro-rata in between', () => {
    expect(estimateShiftRefund(pass, new Date('2026-10-14T00:00:00Z'))).toBe(24000);
    expect(estimateShiftRefund(pass, new Date('2026-10-17T00:00:00Z'))).toBe(0);
    expect(estimateShiftRefund(pass, new Date('2026-10-15T18:00:00Z'))).toBe(6000);
  });
  it('floors fractional refunds', () => {
    expect(estimateShiftRefund({ ...pass, price: 25000 }, new Date('2026-10-15T16:00:00Z'))).toBe(8333);
  });
});

describe('describeVendorSettlement', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  it('explains the scheduled automatic switch', () => {
    expect(
      describeVendorSettlement(
        { vendorSettlementMode: 'cash', vendorWalletSettlementFrom: '2026-12-12T00:00:00+05:00' },
        now
      )
    ).toBe('Hozir naqd rejim. 12.12.2026 dan avtomatik hamyon rejimi.');
  });
  it('says when the date has passed', () => {
    expect(
      describeVendorSettlement(
        { vendorSettlementMode: 'cash', vendorWalletSettlementFrom: '2026-10-01T00:00:00+05:00' },
        now
      )
    ).toMatch(/amalda/);
  });
  it('handles manual wallet and no date', () => {
    expect(describeVendorSettlement({ vendorSettlementMode: 'wallet', vendorWalletSettlementFrom: null }, now)).toMatch(
      /qo'lda/
    );
    expect(describeVendorSettlement({ vendorSettlementMode: 'cash', vendorWalletSettlementFrom: null }, now)).toMatch(
      /belgilanmagan/
    );
  });
});

describe('isFiscalProviderLikelyMissing', () => {
  it('is true only when skipped is the majority', () => {
    expect(isFiscalProviderLikelyMissing({ pending: 0, sent: 0, failed: 0, skipped: 0 })).toBe(false);
    expect(isFiscalProviderLikelyMissing({ pending: 1, sent: 1, failed: 0, skipped: 8 })).toBe(true);
    expect(isFiscalProviderLikelyMissing({ pending: 0, sent: 5, failed: 0, skipped: 5 })).toBe(false);
  });
});

describe('apiErrorMessage', () => {
  it('reads string or array messages, else falls back', () => {
    const { apiErrorMessage } = compliance;
    expect(apiErrorMessage({ response: { data: { message: 'Smena allaqachon bekor' } } }, 'x')).toBe(
      'Smena allaqachon bekor'
    );
    expect(apiErrorMessage({ response: { data: { message: ['a', 'b'] } } }, 'x')).toBe('a; b');
    expect(apiErrorMessage(new Error('net'), 'Xatolik')).toBe('Xatolik');
    expect(apiErrorMessage(null, 'Xatolik')).toBe('Xatolik');
  });
});

describe('validateTopupSettings — hold days & manager limit (§25)', () => {
  const base = { walletTopupMin: 10000, walletTopupMax: 2000000, walletTopupPresets: [50000] };
  it('accepts valid and omitted values', () => {
    expect(validateTopupSettings({ ...base, walletTopupHoldDays: 0, manualAdjustmentManagerLimit: 0 })).toEqual({});
    expect(validateTopupSettings({ ...base, walletTopupHoldDays: 90, manualAdjustmentManagerLimit: 5000000 })).toEqual({});
    expect(validateTopupSettings(base)).toEqual({});
  });
  it('rejects out-of-range or fractional values', () => {
    expect(validateTopupSettings({ ...base, walletTopupHoldDays: 91 }).walletTopupHoldDays).toBeDefined();
    expect(validateTopupSettings({ ...base, walletTopupHoldDays: 1.5 }).walletTopupHoldDays).toBeDefined();
    expect(validateTopupSettings({ ...base, walletTopupHoldDays: -1 }).walletTopupHoldDays).toBeDefined();
    expect(
      validateTopupSettings({ ...base, manualAdjustmentManagerLimit: 5000001 }).manualAdjustmentManagerLimit
    ).toBeDefined();
    expect(
      validateTopupSettings({ ...base, manualAdjustmentManagerLimit: Number.NaN }).manualAdjustmentManagerLimit
    ).toBeDefined();
  });
});
