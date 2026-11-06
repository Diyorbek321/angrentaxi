/**
 * Haydovchining HUQUQIY yaroqliligi — sof funksiya (baza, vaqt manbai yo'q).
 *
 * Manbalar (docs/LEGAL-COMPLIANCE.md da batafsil):
 *  · VMQ No. 200 (02.04.2025) — agregator faqat taksi litsenziya varaqasi bor,
 *    O'zbekiston fuqarosi, 21 yoshdan katta, B toifali guvohnomaga kamida
 *    3 yil ega haydovchiga xizmat ko'rsatadi; shahar ichida mashina yoshi
 *    15 yildan oshmaydi; tibbiy ko'rik, texnik ko'rik va tashuvchi sug'urtasi
 *    majburiy.
 *  · PQ-247 (12.08.2025) + Soliq kodeksi 465/470-moddalar — soliq maqomi
 *    (o'zini o'zi band qilgan yoki YaTT) va JShShIR bo'lmagan haydovchi
 *    qabul qilinmaydi; YaTT uchun STIR ham kerak.
 *
 * ⚠️ Bu funksiya FAQAT xulosa beradi. Bloklash-bloklamaslik qarori
 * (`legalComplianceEnforcedFrom`) chaqiruvchida — muhlat davrida aynan shu
 * sabablar ogohlantirish sifatida ko'rsatiladi.
 */
import { DriverTaxStatus } from '../../database/entities/driver.entity';

export interface LegalDocumentState {
  code: string;
  label: string;
  /** `DriverVerificationStatus` bilan bir xil qiymatlar. */
  status: string;
}

export interface DriverLegalInput {
  /** `YYYY-MM-DD` (Postgres `date`). */
  birthDate: string | null;
  drivingLicenceIssuedAt: string | null;
  carYear: number | null;
  taxStatus: DriverTaxStatus | null;
  pinfl: string | null;
  tin: string | null;
  citizenship: string | null;
  taxiLicenceNumber: string | null;
  /** Huquqiy hujjatlar holati (`LEGAL_REQUIREMENT_CODES`). Ixtiyoriy. */
  documents?: readonly LegalDocumentState[];
}

export interface DriverLegalRules {
  minAgeYears: number;
  minLicenceExperienceYears: number;
  maxVehicleAgeYears: number;
}

export interface LegalIneligibilityReason {
  code: string;
  message: string;
}

export interface DriverLegalEligibility {
  eligible: boolean;
  reasons: LegalIneligibilityReason[];
}

export const DEFAULT_LEGAL_RULES: DriverLegalRules = {
  minAgeYears: 21,
  minLicenceExperienceYears: 3,
  maxVehicleAgeYears: 15,
};

/** Taksi uchun huquqiy hujjat talablari (migratsiya 025 yozadi). */
export const LEGAL_REQUIREMENT_CODES: readonly string[] = [
  'taxi_licence',
  'medical_check',
  'carrier_insurance',
  'tech_inspection',
];

/**
 * Hujjat "bajarilgan" deb hisoblanadigan holatlar. `pending_review` — haydovchi
 * o'z ishini qilgan, ko'rikdagi kechikish biz tomondan (onlayn darvozadagi
 * bilan bir xil qoida, `driver-verification.service.ts`).
 */
const DOCUMENT_OK_STATUSES: readonly string[] = ['ok', 'due_soon', 'pending_review'];

const PINFL_PATTERN = /^\d{14}$/;
const TIN_PATTERN = /^\d{9}$/;

/** Muhlat: `null` — umuman majburlanmaydi; kelajak sana — hali muhlat. */
export function isLegalComplianceEnforced(enforcedFrom: Date | null, now: Date): boolean {
  return enforcedFrom != null && now.getTime() >= enforcedFrom.getTime();
}

/** To'liq yillar: tug'ilgan kun / guvohnoma yilligi aynan bugun bo'lsa — hisoblanadi. */
export function fullYearsBetween(fromIsoDate: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromIsoDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const nowYear = now.getUTCFullYear();
  const beforeAnniversary =
    now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  return nowYear - year - (beforeAnniversary ? 1 : 0);
}

function checkAge(input: DriverLegalInput, rules: DriverLegalRules, now: Date): LegalIneligibilityReason[] {
  if (!input.birthDate) {
    return [{ code: 'birth_date_missing', message: "Tug'ilgan sana kiritilmagan" }];
  }
  const age = fullYearsBetween(input.birthDate, now);
  if (age === null || age < rules.minAgeYears) {
    return [
      {
        code: 'age_below_minimum',
        message: `Haydovchi kamida ${rules.minAgeYears} yoshda bo'lishi shart (VMQ 200)`,
      },
    ];
  }
  return [];
}

function checkExperience(
  input: DriverLegalInput,
  rules: DriverLegalRules,
  now: Date,
): LegalIneligibilityReason[] {
  if (!input.drivingLicenceIssuedAt) {
    return [{ code: 'licence_date_missing', message: 'Haydovchilik guvohnomasi berilgan sana kiritilmagan' }];
  }
  const years = fullYearsBetween(input.drivingLicenceIssuedAt, now);
  if (years === null || years < rules.minLicenceExperienceYears) {
    return [
      {
        code: 'licence_experience_too_short',
        message: `B toifali haydovchilik staji kamida ${rules.minLicenceExperienceYears} yil bo'lishi shart`,
      },
    ];
  }
  return [];
}

function checkVehicle(input: DriverLegalInput, rules: DriverLegalRules, now: Date): LegalIneligibilityReason[] {
  if (input.carYear == null) {
    return [{ code: 'vehicle_year_missing', message: 'Avtomobil ishlab chiqarilgan yili kiritilmagan' }];
  }
  if (now.getUTCFullYear() - input.carYear > rules.maxVehicleAgeYears) {
    return [
      {
        code: 'vehicle_too_old',
        message: `Avtomobil ${rules.maxVehicleAgeYears} yildan eski — shahar ichida taksi sifatida ishlatib bo'lmaydi`,
      },
    ];
  }
  return [];
}

function checkTax(input: DriverLegalInput): LegalIneligibilityReason[] {
  const reasons: LegalIneligibilityReason[] = [];
  if (!input.taxStatus) {
    reasons.push({
      code: 'tax_status_missing',
      message: "Soliq maqomi yo'q: o'zini o'zi band qilgan yoki YaTT sifatida ro'yxatdan o'ting",
    });
  }
  if (!input.pinfl || !PINFL_PATTERN.test(input.pinfl)) {
    reasons.push({ code: 'pinfl_missing', message: 'JShShIR (PINFL, 14 raqam) kiritilmagan' });
  }
  if (
    input.taxStatus === DriverTaxStatus.INDIVIDUAL_ENTREPRENEUR &&
    (!input.tin || !TIN_PATTERN.test(input.tin))
  ) {
    reasons.push({ code: 'tin_missing', message: 'YaTT uchun STIR (INN, 9 raqam) kiritilishi shart' });
  }
  return reasons;
}

function checkIdentity(input: DriverLegalInput): LegalIneligibilityReason[] {
  const reasons: LegalIneligibilityReason[] = [];
  if ((input.citizenship ?? '').toUpperCase() !== 'UZ') {
    reasons.push({
      code: 'citizenship_not_uz',
      message: "Taksi haydovchisi O'zbekiston Respublikasi fuqarosi bo'lishi shart",
    });
  }
  if (!input.taxiLicenceNumber?.trim()) {
    reasons.push({ code: 'taxi_licence_missing', message: 'Taksi litsenziya varaqasi raqami kiritilmagan' });
  }
  return reasons;
}

function checkDocuments(input: DriverLegalInput): LegalIneligibilityReason[] {
  return (input.documents ?? [])
    .filter((doc) => !DOCUMENT_OK_STATUSES.includes(doc.status))
    .map((doc) => ({
      code: `document_${doc.code}`,
      message: `«${doc.label}» yuklanmagan, rad etilgan yoki muddati o'tgan`,
    }));
}

export function evaluateDriverLegalEligibility(
  input: DriverLegalInput,
  rules: DriverLegalRules,
  now: Date,
): DriverLegalEligibility {
  const reasons = [
    ...checkAge(input, rules, now),
    ...checkExperience(input, rules, now),
    ...checkVehicle(input, rules, now),
    ...checkTax(input),
    ...checkIdentity(input),
    ...checkDocuments(input),
  ];
  return { eligible: reasons.length === 0, reasons };
}
