import { describe, expect, it } from 'vitest';
import type { DriverLegalProfile } from './compliance-api';
import {
  buildDriverLegalPatch,
  hasMaskedLegalIds,
  isMaskedLegalId,
  legalBriefBadge,
  legalDuplicateField,
  toDriverLegalForm,
  validateDriverLegalForm,
} from './driver-legal';

const EMPTY: DriverLegalProfile = {
  taxStatus: null,
  pinfl: null,
  tin: null,
  birthDate: null,
  drivingLicenceIssuedAt: null,
  taxiLicenceNumber: null,
  taxiLicenceRegion: null,
  citizenship: 'UZ',
};
const TODAY = '2026-10-15';

describe('validateDriverLegalForm', () => {
  it('accepts an empty profile', () => {
    expect(validateDriverLegalForm(toDriverLegalForm(EMPTY), TODAY)).toEqual({});
  });

  it('checks PINFL (14) and STIR (9) digits', () => {
    const errors = validateDriverLegalForm({ ...toDriverLegalForm(EMPTY), pinfl: '123', tin: '12345678' }, TODAY);
    expect(errors.pinfl).toMatch(/14/);
    expect(errors.tin).toMatch(/9/);
  });

  it('rejects invalid, future and inconsistent dates', () => {
    const base = toDriverLegalForm(EMPTY);
    expect(validateDriverLegalForm({ ...base, birthDate: '2026-02-30' }, TODAY).birthDate).toBeDefined();
    expect(validateDriverLegalForm({ ...base, birthDate: '2027-01-01' }, TODAY).birthDate).toMatch(/kelajak/);
    expect(
      validateDriverLegalForm({ ...base, birthDate: '1990-05-01', drivingLicenceIssuedAt: '1985-01-01' }, TODAY)
        .drivingLicenceIssuedAt
    ).toMatch(/keyin/);
    expect(
      validateDriverLegalForm({ ...base, birthDate: '1990-05-01', drivingLicenceIssuedAt: '2015-03-10' }, TODAY)
    ).toEqual({});
  });

  it('requires a 2-letter citizenship code', () => {
    expect(validateDriverLegalForm({ ...toDriverLegalForm(EMPTY), citizenship: 'uzb' }, TODAY).citizenship).toBeDefined();
  });
});

describe('buildDriverLegalPatch', () => {
  it('sends only changed fields, empty strings clear to null', () => {
    const original: DriverLegalProfile = { ...EMPTY, pinfl: '12345678901234', taxiLicenceNumber: 'TL-1' };
    const form = { ...toDriverLegalForm(original), pinfl: '', tin: '301234567', taxStatus: 'individual_entrepreneur' as const };
    expect(buildDriverLegalPatch(form, original)).toEqual({
      pinfl: null,
      tin: '301234567',
      taxStatus: 'individual_entrepreneur',
    });
  });

  it('returns an empty patch when nothing changed', () => {
    expect(buildDriverLegalPatch(toDriverLegalForm(EMPTY), EMPTY)).toEqual({});
  });
});

describe('legalBriefBadge (GET /drivers → legal)', () => {
  it('maps eligible / info / blocking / unknown', () => {
    expect(legalBriefBadge({ eligible: true, blocking: false, issueCount: 0 }).variant).toBe('success');
    expect(legalBriefBadge({ eligible: false, blocking: false, issueCount: 2 })).toMatchObject({
      label: '2 ta kamchilik',
      variant: 'info',
    });
    expect(legalBriefBadge({ eligible: false, blocking: true, issueCount: 3 })).toMatchObject({
      label: 'Bloklangan · 3',
      variant: 'danger',
    });
    expect(legalBriefBadge(null).variant).toBe('neutral');
    expect(legalBriefBadge(undefined).variant).toBe('neutral');
  });
});

describe('masked PINFL/STIR (§25 #2)', () => {
  const masked: DriverLegalProfile = { ...EMPTY, pinfl: '**********1234', tin: '*****6789' };

  it('detects masked values', () => {
    expect(isMaskedLegalId('**********1234')).toBe(true);
    expect(isMaskedLegalId('12345678901234')).toBe(false);
    expect(isMaskedLegalId(null)).toBe(false);
    expect(hasMaskedLegalIds(masked)).toBe(true);
    expect(hasMaskedLegalIds(EMPTY)).toBe(false);
  });

  it('does not validate or send masked values', () => {
    const form = toDriverLegalForm(masked);
    expect(validateDriverLegalForm(form, TODAY)).toEqual({});
    expect(buildDriverLegalPatch({ ...form, pinfl: '', tin: '123456789', taxiLicenceNumber: 'TL-1' }, masked)).toEqual({
      taxiLicenceNumber: 'TL-1',
    });
  });
});

describe('legalDuplicateField (409 LEGAL_PROFILE_DUPLICATE)', () => {
  const err = (data: unknown) => ({ response: { status: 409, data } });
  it('maps details.field', () => {
    expect(legalDuplicateField(err({ code: 'LEGAL_PROFILE_DUPLICATE', details: { field: 'tin' } }))).toBe('tin');
    expect(legalDuplicateField(err({ code: 'LEGAL_PROFILE_DUPLICATE', details: { field: 'pinfl' } }))).toBe('pinfl');
    expect(legalDuplicateField(err({ code: 'LEGAL_PROFILE_DUPLICATE' }))).toBe('pinfl');
    expect(legalDuplicateField(err({ code: 'OTHER' }))).toBeNull();
  });
});

describe('validateDriverLegalForm — litsenziya hududi', () => {
  const base = toDriverLegalForm(EMPTY);

  it("ro'yxatdagi kod va bo'sh — xatosiz", () => {
    expect(validateDriverLegalForm({ ...base, taxiLicenceRegion: 'UZ-TO' }, TODAY).taxiLicenceRegion).toBeUndefined();
    expect(validateDriverLegalForm({ ...base, taxiLicenceRegion: '' }, TODAY).taxiLicenceRegion).toBeUndefined();
  });

  it("o'zgartirilmagan eski matn — xatosiz; yangi erkin matn — xato", () => {
    const legacy = { ...base, taxiLicenceRegion: 'Angren' };
    expect(validateDriverLegalForm(legacy, TODAY, 'Angren').taxiLicenceRegion).toBeUndefined();
    expect(validateDriverLegalForm(legacy, TODAY, null).taxiLicenceRegion).toBeDefined();
  });
});
