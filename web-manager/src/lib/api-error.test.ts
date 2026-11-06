import { describe, expect, it } from 'vitest';
import { apiErrorDetailNumber, apiErrorDetailText, apiErrorMessage, apiErrorTitle, parseApiError } from './api-error';

const axiosError = (data: unknown, status = 400) => ({ response: { status, data } });

describe('parseApiError', () => {
  it('reads code, reasons and details from the envelope', () => {
    const parsed = parseApiError(
      axiosError({
        success: false,
        statusCode: 400,
        message: 'Taksi uchun onlayn chiqa olmaysiz',
        code: 'LEGAL_NOT_ELIGIBLE',
        reasons: [
          { code: 'pinfl_missing', message: 'JShShIR kiritilmagan' },
          { code: 'bad' },
          'junk',
        ],
        details: { balance: -5000 },
      })
    );
    expect(parsed).toEqual({
      code: 'LEGAL_NOT_ELIGIBLE',
      message: 'Taksi uchun onlayn chiqa olmaysiz',
      reasons: [{ code: 'pinfl_missing', message: 'JShShIR kiritilmagan' }],
      details: { balance: -5000 },
      statusCode: 400,
    });
  });

  it('handles plain errors and missing envelopes', () => {
    expect(parseApiError(new Error('network'))).toEqual({
      code: null,
      message: null,
      reasons: [],
      details: {},
      statusCode: null,
    });
    expect(parseApiError(null).code).toBeNull();
    expect(parseApiError(axiosError(undefined, 502)).statusCode).toBe(502);
  });

  it('joins class-validator message arrays', () => {
    expect(parseApiError(axiosError({ message: ['a', 'b'] })).message).toBe('a; b');
  });
});

describe('apiErrorMessage', () => {
  it('prefers the reasons list over the summary message', () => {
    const err = axiosError({
      message: 'umumiy',
      code: 'LEGAL_NOT_ELIGIBLE',
      reasons: [
        { code: 'pinfl_missing', message: 'JShShIR yoʻq' },
        { code: 'tin_missing', message: 'STIR yoʻq' },
      ],
    });
    expect(apiErrorMessage(err, 'z')).toBe('JShShIR yoʻq; STIR yoʻq');
  });

  it('falls back to message, then to the fallback', () => {
    expect(apiErrorMessage(axiosError({ message: 'Xato' }), 'z')).toBe('Xato');
    expect(apiErrorMessage(axiosError({ message: '  ' }), 'z')).toBe('z');
    expect(apiErrorMessage(new Error('x'), 'z')).toBe('z');
  });
});

describe('apiErrorTitle', () => {
  it('maps known codes and falls back otherwise', () => {
    expect(apiErrorTitle(axiosError({ code: 'LEGAL_NOT_ELIGIBLE' }), 'Xatolik')).toBe(
      'Huquqiy talablar bajarilmagan'
    );
    expect(apiErrorTitle(axiosError({ code: 'UNKNOWN_CODE' }), 'Xatolik')).toBe('Xatolik');
    expect(apiErrorTitle(axiosError({ message: 'x' }), 'Xatolik')).toBe('Xatolik');
  });
});

describe('details helpers (§21)', () => {
  it('apiErrorDetailNumber: number, numeric string, missing', () => {
    const err = axiosError({ code: 'MANUAL_ADJUSTMENT_LIMIT', details: { limit: 2000000, s: '15', bad: 'x' } }, 403);
    expect(apiErrorDetailNumber(err, 'limit')).toBe(2000000);
    expect(apiErrorDetailNumber(err, 's')).toBe(15);
    expect(apiErrorDetailNumber(err, 'bad')).toBeNull();
    expect(apiErrorDetailNumber(err, 'missing')).toBeNull();
    expect(apiErrorDetailNumber(new Error('x'), 'limit')).toBeNull();
  });

  it('apiErrorDetailText', () => {
    const err = axiosError({ code: 'LEGAL_PROFILE_DUPLICATE', details: { field: ' tin ', n: 1 } }, 409);
    expect(apiErrorDetailText(err, 'field')).toBe('tin');
    expect(apiErrorDetailText(err, 'n')).toBeNull();
  });

  it('titles for the new codes', () => {
    for (const code of [
      'WALLET_TOPUP_TOO_MANY_PENDING',
      'WALLET_WITHDRAWAL_ON_HOLD',
      'LEGAL_PROFILE_LOCKED',
      'LEGAL_PROFILE_DUPLICATE',
      'MANUAL_ADJUSTMENT_LIMIT',
    ]) {
      expect(apiErrorTitle(axiosError({ code }), 'Xatolik')).not.toBe('Xatolik');
    }
  });
});
