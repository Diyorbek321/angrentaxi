import {
  DEFAULT_LEGAL_RULES,
  DriverLegalInput,
  evaluateDriverLegalEligibility,
  isLegalComplianceEnforced,
} from './driver-legal-eligibility';
import { DriverTaxStatus } from '../../database/entities/driver.entity';

/**
 * VMQ No. 200 (02.04.2025) + PQ-247 talablari — sof funksiya, bazasiz.
 * Har bir qoida alohida sinaladi: haydovchiga qaytadigan sabab kodi va
 * o'zbekcha matni aniq bo'lishi shart.
 */
describe('evaluateDriverLegalEligibility', () => {
  const now = new Date('2026-10-15T12:00:00Z');

  const valid: DriverLegalInput = {
    birthDate: '1990-05-01',
    drivingLicenceIssuedAt: '2015-01-10',
    carYear: 2018,
    taxStatus: DriverTaxStatus.SELF_EMPLOYED,
    pinfl: '12345678901234',
    tin: null,
    citizenship: 'UZ',
    taxiLicenceNumber: 'TL-0001',
  };

  const codes = (input: Partial<DriverLegalInput>) =>
    evaluateDriverLegalEligibility({ ...valid, ...input }, DEFAULT_LEGAL_RULES, now).reasons.map(
      (r) => r.code,
    );

  it("to'liq va to'g'ri profil — ruxsat", () => {
    expect(evaluateDriverLegalEligibility(valid, DEFAULT_LEGAL_RULES, now)).toEqual({
      eligible: true,
      reasons: [],
    });
  });

  it('21 yoshdan kichik — rad', () => {
    expect(codes({ birthDate: '2005-10-16' })).toEqual(['age_below_minimum']);
  });

  it("21 yosh aynan bugun to'lgan — ruxsat", () => {
    expect(codes({ birthDate: '2005-10-15' })).toEqual([]);
  });

  it("tug'ilgan sana yo'q — rad", () => {
    expect(codes({ birthDate: null })).toEqual(['birth_date_missing']);
  });

  it('haydovchilik staji 3 yildan kam — rad', () => {
    expect(codes({ drivingLicenceIssuedAt: '2024-01-01' })).toEqual(['licence_experience_too_short']);
  });

  it("guvohnoma sanasi yo'q — rad", () => {
    expect(codes({ drivingLicenceIssuedAt: null })).toEqual(['licence_date_missing']);
  });

  it('mashina 15 yildan eski — rad', () => {
    expect(codes({ carYear: 2010 })).toEqual(['vehicle_too_old']);
  });

  it('mashina yoshi chegarasi sozlamadan olinadi', () => {
    const result = evaluateDriverLegalEligibility(
      { ...valid, carYear: 2010 },
      { ...DEFAULT_LEGAL_RULES, maxVehicleAgeYears: 20 },
      now,
    );
    expect(result.eligible).toBe(true);
  });

  it("ishlab chiqarilgan yil yo'q — rad", () => {
    expect(codes({ carYear: null })).toEqual(['vehicle_year_missing']);
  });

  it("soliq maqomi yo'q — rad", () => {
    expect(codes({ taxStatus: null })).toEqual(['tax_status_missing']);
  });

  it("JShShIR yo'q yoki 14 xonali emas — rad", () => {
    expect(codes({ pinfl: null })).toEqual(['pinfl_missing']);
    expect(codes({ pinfl: '123' })).toEqual(['pinfl_missing']);
  });

  it("YaTT uchun STIR majburiy, o'zini o'zi band qilgan uchun emas", () => {
    expect(codes({ taxStatus: DriverTaxStatus.INDIVIDUAL_ENTREPRENEUR, tin: null })).toEqual([
      'tin_missing',
    ]);
    expect(
      codes({ taxStatus: DriverTaxStatus.INDIVIDUAL_ENTREPRENEUR, tin: '123456789' }),
    ).toEqual([]);
  });

  it("fuqarolik UZ bo'lmasa — rad", () => {
    expect(codes({ citizenship: 'KZ' })).toEqual(['citizenship_not_uz']);
  });

  it("litsenziya raqami yo'q — rad", () => {
    expect(codes({ taxiLicenceNumber: null })).toEqual(['taxi_licence_missing']);
  });

  it('huquqiy hujjat (litsenziya, tibbiy ko‘rik...) bajarilmagan — rad', () => {
    const result = evaluateDriverLegalEligibility(
      {
        ...valid,
        documents: [
          { code: 'taxi_licence', label: 'Taksi litsenziyasi', status: 'ok' },
          { code: 'medical_check', label: "Tibbiy ko'rik", status: 'missing' },
          { code: 'carrier_insurance', label: "Sug'urta", status: 'pending_review' },
        ],
      },
      DEFAULT_LEGAL_RULES,
      now,
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual([
      {
        code: 'document_medical_check',
        message: expect.stringContaining("Tibbiy ko'rik"),
      },
    ]);
  });

  it('bir nechta sabab birga qaytadi, har biri o‘zbekcha matn bilan', () => {
    const result = evaluateDriverLegalEligibility(
      { ...valid, birthDate: '2010-01-01', taxStatus: null, pinfl: null },
      DEFAULT_LEGAL_RULES,
      now,
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.map((r) => r.code)).toEqual([
      'age_below_minimum',
      'tax_status_missing',
      'pinfl_missing',
    ]);
    for (const reason of result.reasons) {
      expect(reason.message.length).toBeGreaterThan(10);
    }
  });
});

describe('isLegalComplianceEnforced', () => {
  const now = new Date('2026-10-15T12:00:00Z');

  it("null — majburlanmaydi (standart)", () => {
    expect(isLegalComplianceEnforced(null, now)).toBe(false);
  });

  it('kelajakdagi sana — muhlat davri, hali majburlanmaydi', () => {
    expect(isLegalComplianceEnforced(new Date('2026-11-01T00:00:00Z'), now)).toBe(false);
  });

  it("sana o'tgan — majburlanadi", () => {
    expect(isLegalComplianceEnforced(new Date('2026-10-01T00:00:00Z'), now)).toBe(true);
  });
});
