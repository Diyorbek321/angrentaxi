import { describe, expect, it } from 'vitest';
import type { DriverLegalEligibility, DriverLegalProfile } from './api';
import {
  buildLegalPatch,
  apiErrorMessage,
  hasMaskedLegalIds,
  isMaskedLegalId,
  legalDuplicateField,
  enforcementText,
  legalBadge,
  legalBriefBadge,
  legalBriefFromEligibility,
  legalFormFromProfile,
  validateLegalForm,
} from './driver-legal';

const profile = (over: Partial<DriverLegalProfile> = {}): DriverLegalProfile => ({
  taxStatus: null,
  pinfl: null,
  tin: null,
  birthDate: null,
  drivingLicenceIssuedAt: null,
  taxiLicenceNumber: null,
  taxiLicenceRegion: null,
  citizenship: 'UZ',
  ...over,
});

const eligibility = (over: Partial<DriverLegalEligibility> = {}): DriverLegalEligibility => ({
  eligible: false,
  enforced: false,
  enforcedFrom: null,
  appliesToTaxi: true,
  blocking: false,
  reasons: [{ code: 'pinfl_missing', message: 'JShShIR kiritilmagan' }],
  ...over,
});

const TODAY = '2026-10-15';

describe('validateLegalForm', () => {
  it('boʻsh forma xatosiz (hamma maydon ixtiyoriy)', () => {
    expect(validateLegalForm(legalFormFromProfile(profile()), TODAY)).toEqual({});
  });

  it('JShShIR 14, STIR 9 raqam', () => {
    const errors = validateLegalForm(
      { ...legalFormFromProfile(profile()), pinfl: '1234', tin: '12345678a' },
      TODAY
    );
    expect(errors.pinfl).toMatch(/14/);
    expect(errors.tin).toMatch(/9/);
    expect(
      validateLegalForm({ ...legalFormFromProfile(profile()), pinfl: '12345678901234', tin: '123456789' }, TODAY)
    ).toEqual({});
  });

  it('kelajakdagi, mavjud boʻlmagan va tartibi buzilgan sanalar', () => {
    const base = legalFormFromProfile(profile());
    expect(validateLegalForm({ ...base, birthDate: '2027-01-01' }, TODAY).birthDate).toMatch(/kelajak/);
    expect(validateLegalForm({ ...base, birthDate: '2001-02-30' }, TODAY).birthDate).toMatch(/notoʻgʻri/);
    expect(
      validateLegalForm({ ...base, birthDate: '2000-01-01', drivingLicenceIssuedAt: '1999-05-05' }, TODAY)
        .drivingLicenceIssuedAt
    ).toMatch(/keyin/);
  });

  it('fuqarolik 2 harfli kod', () => {
    expect(validateLegalForm({ ...legalFormFromProfile(profile()), citizenship: 'uzb' }, TODAY).citizenship).toBeTruthy();
  });
});

describe('buildLegalPatch', () => {
  it('faqat oʻzgargan maydonlar; boʻsh satr → null', () => {
    const initial = profile({ pinfl: '12345678901234', tin: '123456789' });
    const values = { ...legalFormFromProfile(initial), tin: '', taxStatus: 'self_employed' as const };
    expect(buildLegalPatch(initial, values)).toEqual({ tin: null, taxStatus: 'self_employed' });
  });

  it('oʻzgarishsiz forma — boʻsh patch', () => {
    const initial = profile({ birthDate: '1990-01-01' });
    expect(buildLegalPatch(initial, legalFormFromProfile(initial))).toEqual({});
  });
});

describe('legalBadge', () => {
  it('javob beradi → success', () => {
    expect(legalBadge(eligibility({ eligible: true, reasons: [] }))).toMatchObject({
      label: 'Talablarga javob beradi',
      variant: 'success',
    });
  });

  it('muhlat davrida kamchilik — info, son bilan', () => {
    const b = legalBadge(eligibility());
    expect(b).toMatchObject({ label: '1 ta kamchilik', variant: 'info' });
    expect(b.title).toContain('JShShIR');
  });

  it('majburlanganda — danger "Bloklangan"', () => {
    expect(legalBadge(eligibility({ enforced: true, blocking: true })).variant).toBe('danger');
  });

  it('taksi xizmati yoʻq — neytral', () => {
    expect(legalBadge(eligibility({ appliesToTaxi: false })).variant).toBe('neutral');
  });
});

describe('enforcementText', () => {
  it('uch holat', () => {
    const fmt = (iso: string) => iso.slice(0, 10);
    expect(enforcementText(eligibility({ enforced: true }), fmt)).toMatch(/Majburlanmoqda/);
    expect(enforcementText(eligibility({ enforcedFrom: '2026-12-01T00:00:00Z' }), fmt)).toContain('2026-12-01');
    expect(enforcementText(eligibility(), fmt)).toMatch(/Majburlanmaydi/);
  });
});

describe('apiErrorMessage', () => {
  it('satr, massiv va zaxira', () => {
    expect(apiErrorMessage({ response: { data: { message: 'Xato' } } }, 'z')).toBe('Xato');
    expect(apiErrorMessage({ response: { data: { message: ['a', 'b'] } } }, 'z')).toBe('a; b');
    expect(apiErrorMessage(new Error('x'), 'z')).toBe('z');
  });
});

describe('legalBriefBadge (GET /drivers → legal)', () => {
  it('maps the roster brief to a badge', () => {
    expect(legalBriefBadge({ eligible: true, blocking: false, issueCount: 0 }).variant).toBe('success');
    expect(legalBriefBadge({ eligible: false, blocking: false, issueCount: 2 })).toMatchObject({
      label: '2 ta kamchilik',
      variant: 'info',
    });
    expect(legalBriefBadge({ eligible: false, blocking: true, issueCount: 3 })).toMatchObject({
      label: 'Bloklangan · 3 ta kamchilik',
      variant: 'danger',
    });
  });

  it('treats null/missing brief as unknown', () => {
    expect(legalBriefBadge(null).variant).toBe('neutral');
    expect(legalBriefBadge(undefined).label).toBe('Nomaʼlum');
  });

  it('derives a brief from the full eligibility after a drawer edit', () => {
    expect(legalBriefFromEligibility(eligibility({ blocking: true }))).toEqual({
      eligible: false,
      blocking: true,
      issueCount: 1,
    });
  });
});

describe('masked PINFL/STIR (§25 #2)', () => {
  const masked = profile({ pinfl: '**********1234', tin: '*****6789' });

  it('detects masked values', () => {
    expect(isMaskedLegalId('*****6789')).toBe(true);
    expect(isMaskedLegalId('123456789')).toBe(false);
    expect(hasMaskedLegalIds(masked)).toBe(true);
    expect(hasMaskedLegalIds(profile())).toBe(false);
  });

  it('does not validate or send masked values', () => {
    const values = legalFormFromProfile(masked);
    expect(validateLegalForm(values, TODAY)).toEqual({});
    expect(buildLegalPatch(masked, { ...values, pinfl: '', tin: '123456789', taxiLicenceRegion: 'Toshkent' })).toEqual({
      taxiLicenceRegion: 'Toshkent',
    });
  });
});

describe('legalDuplicateField (409 LEGAL_PROFILE_DUPLICATE)', () => {
  const err = (data: unknown) => ({ response: { status: 409, data } });
  it('maps details.field', () => {
    expect(legalDuplicateField(err({ code: 'LEGAL_PROFILE_DUPLICATE', details: { field: 'tin' } }))).toBe('tin');
    expect(legalDuplicateField(err({ code: 'LEGAL_PROFILE_DUPLICATE' }))).toBe('pinfl');
    expect(legalDuplicateField(err({ code: 'LEGAL_NOT_ELIGIBLE' }))).toBeNull();
  });
});
