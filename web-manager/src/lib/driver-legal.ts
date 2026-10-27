import type {
  DriverLegalBrief,
  DriverLegalEligibility,
  DriverLegalPatch,
  DriverLegalProfile,
  DriverTaxStatus,
} from './api';
import { apiErrorDetailText, parseApiError } from './api-error';
import { t } from '@/locales';
import { isUzRegionCode } from './uz-regions';

/**
 * Haydovchining huquqiy profili (VMQ 200 / PQ-247) — panel tomoni.
 * Sof funksiyalar: forma tekshiruvi, PATCH tanasi va jadval badge'i.
 * Backend qoidalari: docs/LEGAL-COMPLIANCE.md §1, `update-driver-legal.dto.ts`.
 */

export function taxStatusLabels(): Record<DriverTaxStatus, string> {
  return t().lib.taxStatus;
}

export function taxStatusOptions(): readonly { value: '' | DriverTaxStatus; label: string }[] {
  const labels = taxStatusLabels();
  return [
    { value: '', label: t().lib.taxStatusNotSet },
    { value: 'self_employed', label: labels.self_employed },
    { value: 'individual_entrepreneur', label: labels.individual_entrepreneur },
  ];
}

/** Formadagi qiymatlar — hammasi satr, bo'sh satr = "kiritilmagan". */
export interface LegalFormValues {
  taxStatus: '' | DriverTaxStatus;
  pinfl: string;
  tin: string;
  birthDate: string;
  drivingLicenceIssuedAt: string;
  taxiLicenceNumber: string;
  taxiLicenceRegion: string;
  citizenship: string;
}

export type LegalFormErrors = Partial<Record<keyof LegalFormValues, string>>;

export function legalFormFromProfile(profile: DriverLegalProfile): LegalFormValues {
  return {
    taxStatus: profile.taxStatus ?? '',
    pinfl: profile.pinfl ?? '',
    tin: profile.tin ?? '',
    birthDate: profile.birthDate ?? '',
    drivingLicenceIssuedAt: profile.drivingLicenceIssuedAt ?? '',
    taxiLicenceNumber: profile.taxiLicenceNumber ?? '',
    taxiLicenceRegion: profile.taxiLicenceRegion ?? '',
    citizenship: profile.citizenship ?? 'UZ',
  };
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  // 2026-02-31 kabi sanalar Date'da boshqa kunga "oqib" ketadi.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** `today` — YYYY-MM-DD (testlar uchun tashqaridan beriladi). */
export function validateLegalForm(
  values: LegalFormValues,
  today: string,
  initialRegion: string | null = null
): LegalFormErrors {
  const m = t().lib.legalForm;
  const errors: LegalFormErrors = {};
  const pinfl = values.pinfl.trim();
  const tin = values.tin.trim();

  // Niqoblangan (o'zgartirilmaydigan) qiymat tekshirilmaydi.
  if (pinfl && !isMaskedLegalId(pinfl) && !/^\d{14}$/.test(pinfl)) {
    errors.pinfl = m.pinflDigits;
  }
  // YaTT'da STIR yo'qligi forma xatosi EMAS — qisman saqlash mumkin bo'lsin;
  // u eligibility sabablarida (`tin_missing`) ko'rinadi.
  if (tin && !isMaskedLegalId(tin) && !/^\d{9}$/.test(tin)) errors.tin = m.tinDigits;

  for (const key of ['birthDate', 'drivingLicenceIssuedAt'] as const) {
    const v = values[key].trim();
    if (!v) continue;
    if (!isRealDate(v)) errors[key] = m.invalidDate;
    else if (v > today) errors[key] = m.futureDate;
    else if (v < '1900-01-01') errors[key] = m.tooOld;
  }

  const birth = values.birthDate.trim();
  const licence = values.drivingLicenceIssuedAt.trim();
  if (!errors.birthDate && !errors.drivingLicenceIssuedAt && birth && licence && licence <= birth) {
    errors.drivingLicenceIssuedAt = m.licenceAfterBirth;
  }

  if (values.taxiLicenceNumber.trim().length > 50) errors.taxiLicenceNumber = m.max50;
  const region = values.taxiLicenceRegion.trim();
  // Eski erkin matn o'zgartirilmasa yuborilmaydi; yangi qiymat faqat ro'yxatdan.
  if (region && !isUzRegionCode(region) && region !== initialRegion) errors.taxiLicenceRegion = m.region;
  if (!/^[A-Z]{2}$/.test(values.citizenship.trim())) {
    errors.citizenship = m.citizenship;
  }
  return errors;
}

/**
 * Faqat o'zgargan maydonlar: PATCH "yuborilgani o'zgaradi" semantikasida,
 * shuning uchun tegilmagan maydonni qayta yozmaymiz. Bo'sh satr → `null`.
 */
export function buildLegalPatch(initial: DriverLegalProfile, values: LegalFormValues): DriverLegalPatch {
  const patch: DriverLegalPatch = {};
  const norm = (v: string) => (v.trim() === '' ? null : v.trim());

  const taxStatus = values.taxStatus === '' ? null : values.taxStatus;
  if (taxStatus !== initial.taxStatus) patch.taxStatus = taxStatus;

  const nullable = [
    'pinfl',
    'tin',
    'birthDate',
    'drivingLicenceIssuedAt',
    'taxiLicenceNumber',
    'taxiLicenceRegion',
  ] as const;
  for (const key of nullable) {
    // Niqoblangan PINFL/STIR — haqiqiy qiymat noma'lum, hech qachon yuborilmaydi.
    if ((key === 'pinfl' || key === 'tin') && isMaskedLegalId(initial[key])) continue;
    const next = norm(values[key]);
    if (next !== (initial[key] ?? null)) patch[key] = next;
  }

  const citizenship = values.citizenship.trim().toUpperCase();
  if (citizenship && citizenship !== initial.citizenship) patch.citizenship = citizenship;
  return patch;
}

export type LegalBadgeVariant = 'success' | 'danger' | 'info' | 'neutral';

export interface LegalBadge {
  label: string;
  variant: LegalBadgeVariant;
  /** Tooltip / screen reader uchun to'liq izoh. */
  title: string;
}

/**
 * Jadvaldagi bitta badge. Amber (`warning`) faqat qo'lda aralashuv uchun
 * (panel qoidasi) — muhlat davridagi kamchilik "e'tibor bering", ya'ni info.
 */
export function legalBadge(e: DriverLegalEligibility): LegalBadge {
  const m = t().lib.legalBadge;
  if (!e.appliesToTaxi) {
    return { label: m.notTaxi, variant: 'neutral', title: m.notTaxiTitle };
  }
  if (e.eligible || e.reasons.length === 0) {
    return { label: m.eligible, variant: 'success', title: m.eligibleTitle };
  }
  const count = e.reasons.length;
  const list = e.reasons.map((r) => r.message).join('; ');
  if (e.blocking) {
    return { label: m.blocked(count), variant: 'danger', title: list };
  }
  return { label: m.issues(count), variant: 'info', title: list };
}

/**
 * `GET /drivers` dagi qisqa xulosa uchun badge (§22). `null` — backend shu
 * haydovchi uchun hisoblay olmadi; to'liq ro'yxat drawer'da
 * (`GET /drivers/:id/legal`). Xulosada `appliesToTaxi` yo'q: taksisiz
 * haydovchida ham kamchiliklar sanaladi, lekin `blocking` hech qachon true emas.
 */
export function legalBriefBadge(brief: DriverLegalBrief | null | undefined): LegalBadge {
  const m = t().lib.legalBadge;
  if (!brief) {
    return { label: m.unknown, variant: 'neutral', title: m.unknownTitle };
  }
  if (brief.eligible || brief.issueCount === 0) {
    return { label: m.eligible, variant: 'success', title: m.eligibleTitle };
  }
  const count = brief.issueCount;
  if (brief.blocking) {
    return {
      label: m.blocked(count),
      variant: 'danger',
      title: m.blockedTitle,
    };
  }
  return { label: m.issues(count), variant: 'info', title: m.issuesTitle };
}

/** Drawer tahriridan keyin jadval qatorini yangilash uchun. */
export function legalBriefFromEligibility(e: DriverLegalEligibility): DriverLegalBrief {
  return { eligible: e.eligible, blocking: e.blocking, issueCount: e.reasons.length };
}

/** Drawer sarlavhasidagi majburlash holati matni. */
export function enforcementText(e: DriverLegalEligibility, formatDate: (iso: string) => string): string {
  const m = t().lib.enforcement;
  if (e.enforced) return m.enforced;
  if (e.enforcedFrom) return m.grace(formatDate(e.enforcedFrom));
  return m.notEnforced;
}

/** Backend xato konverti — `code`/`reasons` bilan ([api-error.ts]). */
export { apiErrorMessage } from './api-error';

// ─── Niqob va takror (docs/LEGAL-COMPLIANCE.md §25 #2, #4) ───────────

/**
 * `GET /drivers/:id/legal` DRIVERS_APPROVE'siz ko'ruvchiga PINFL/STIR ni
 * niqoblab beradi (`**********1234`). Niqoblangan qiymat tahrirlanmaydi va
 * PATCH ga kirmaydi.
 */
export function isMaskedLegalId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.includes('*');
}

export function hasMaskedLegalIds(profile: Pick<DriverLegalProfile, 'pinfl' | 'tin'>): boolean {
  return isMaskedLegalId(profile.pinfl) || isMaskedLegalId(profile.tin);
}

export function legalDuplicateMessages(): Record<'pinfl' | 'tin', string> {
  return t().lib.legalDuplicate;
}

/** 409 `LEGAL_PROFILE_DUPLICATE` — qaysi maydon (`details.field`); boshqa xato — `null`. */
export function legalDuplicateField(err: unknown): 'pinfl' | 'tin' | null {
  if (parseApiError(err).code !== 'LEGAL_PROFILE_DUPLICATE') return null;
  return apiErrorDetailText(err, 'field') === 'tin' ? 'tin' : 'pinfl';
}
