/**
 * Haydovchi huquqiy profili tahrir formasi: validatsiya va PATCH tanasi.
 * Backend qoidalari: `backend/src/modules/drivers/dto/update-driver-legal.dto.ts`.
 */
import type { DriverLegalBrief, DriverLegalPatch, DriverLegalProfile, DriverTaxStatus } from './compliance-api';
import { isIsoDate, isPinfl, isTin } from './compliance';
import { apiErrorDetailText, parseApiError } from './api-error';
import { isUzRegionCode } from './uz-regions';
import { t } from '@/locales';

export interface DriverLegalForm {
  taxStatus: DriverTaxStatus | '';
  pinfl: string;
  tin: string;
  birthDate: string;
  drivingLicenceIssuedAt: string;
  taxiLicenceNumber: string;
  taxiLicenceRegion: string;
  citizenship: string;
}

export type DriverLegalErrors = Partial<Record<keyof DriverLegalForm, string>>;

/** Soliq maqomi yorliqlari — render paytida chaqiring (til shu paytda olinadi). */
export function taxStatusLabels(): Record<DriverTaxStatus, string> {
  return t().drivers.legal.taxStatus;
}

export function toDriverLegalForm(p: DriverLegalProfile): DriverLegalForm {
  return {
    taxStatus: p.taxStatus ?? '',
    pinfl: p.pinfl ?? '',
    tin: p.tin ?? '',
    birthDate: p.birthDate ?? '',
    drivingLicenceIssuedAt: p.drivingLicenceIssuedAt ?? '',
    taxiLicenceNumber: p.taxiLicenceNumber ?? '',
    taxiLicenceRegion: p.taxiLicenceRegion ?? '',
    citizenship: p.citizenship || 'UZ',
  };
}

/** `today` — `YYYY-MM-DD` (Toshkent), kelajak sanalarni rad etish uchun. */
export function validateDriverLegalForm(
  form: DriverLegalForm,
  today: string,
  initialRegion: string | null = null
): DriverLegalErrors {
  const m = t().drivers.legal.errors;
  const errors: DriverLegalErrors = {};
  const pinfl = form.pinfl.trim();
  const tin = form.tin.trim();
  // Niqoblangan (o'zgartirilmaydigan) qiymat tekshirilmaydi.
  if (pinfl && !isMaskedLegalId(pinfl) && !isPinfl(pinfl)) {
    errors.pinfl = m.pinfl;
  }
  if (tin && !isMaskedLegalId(tin) && !isTin(tin)) errors.tin = m.tin;

  const birth = form.birthDate.trim();
  if (birth) {
    if (!isIsoDate(birth)) errors.birthDate = m.invalidDate;
    else if (birth > today) errors.birthDate = m.birthFuture;
  }
  const licence = form.drivingLicenceIssuedAt.trim();
  if (licence) {
    if (!isIsoDate(licence)) errors.drivingLicenceIssuedAt = m.invalidDate;
    else if (licence > today) errors.drivingLicenceIssuedAt = m.dateFuture;
    else if (birth && !errors.birthDate && licence <= birth) {
      errors.drivingLicenceIssuedAt = m.licenceAfterBirth;
    }
  }
  if (form.taxiLicenceNumber.trim().length > 50) errors.taxiLicenceNumber = m.maxChars(50);
  const region = form.taxiLicenceRegion.trim();
  // Eski erkin matn o'zgartirilmasa yuborilmaydi (patch faqat o'zgarganni oladi);
  // yangi qiymat esa faqat ro'yxatdan.
  if (region && !isUzRegionCode(region) && region !== initialRegion) errors.taxiLicenceRegion = m.region;
  if (!/^[A-Z]{2}$/.test(form.citizenship.trim())) {
    errors.citizenship = m.citizenship;
  }
  return errors;
}

/**
 * Faqat o'zgargan maydonlar. Bo'sh qator — `null` (maydonni tozalash);
 * fuqarolik hech qachon `null` bo'lmaydi.
 */
export function buildDriverLegalPatch(form: DriverLegalForm, original: DriverLegalProfile): DriverLegalPatch {
  const patch: DriverLegalPatch = {};
  const nullable = (v: string) => (v.trim() === '' ? null : v.trim());

  const taxStatus = form.taxStatus === '' ? null : form.taxStatus;
  if (taxStatus !== original.taxStatus) patch.taxStatus = taxStatus;

  const fields = [
    'pinfl',
    'tin',
    'birthDate',
    'drivingLicenceIssuedAt',
    'taxiLicenceNumber',
    'taxiLicenceRegion',
  ] as const;
  for (const key of fields) {
    // Niqoblangan PINFL/STIR — haqiqiy qiymat noma'lum, hech qachon yuborilmaydi.
    if ((key === 'pinfl' || key === 'tin') && isMaskedLegalId(original[key])) continue;
    const next = nullable(form[key]);
    if (next !== (original[key] ?? null)) patch[key] = next;
  }

  const citizenship = form.citizenship.trim();
  if (citizenship && citizenship !== original.citizenship) patch.citizenship = citizenship;
  return patch;
}

export interface LegalBriefBadge {
  label: string;
  variant: 'success' | 'danger' | 'info' | 'neutral';
  title: string;
}

/**
 * Haydovchilar jadvalidagi huquqiy holat badge'i (`GET /drivers` → `legal`).
 * Amber ishlatilmaydi (faqat qo'lda aralashuv): bloklangan — qizil,
 * muhlat davridagi kamchilik — info.
 */
export function legalBriefBadge(brief: DriverLegalBrief | null | undefined): LegalBriefBadge {
  const m = t().drivers.legal.brief;
  if (!brief) return { label: m.unknown, variant: 'neutral', title: m.unknownTitle };
  if (brief.eligible || brief.issueCount === 0) {
    return { label: m.eligible, variant: 'success', title: m.eligibleTitle };
  }
  const count = brief.issueCount;
  if (brief.blocking) {
    return {
      label: m.blocked(count),
      variant: 'danger',
      title: m.blockedTitle(count),
    };
  }
  return { label: m.issues(count), variant: 'info', title: m.issuesTitle };
}

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

/** 409 takror xabari maydon bo'yicha — render/handler paytida chaqiring. */
export function legalDuplicateMessage(field: 'pinfl' | 'tin'): string {
  return t().drivers.legal.duplicate[field];
}

/** 409 `LEGAL_PROFILE_DUPLICATE` — qaysi maydon (`details.field`); boshqa xato — `null`. */
export function legalDuplicateField(err: unknown): 'pinfl' | 'tin' | null {
  if (parseApiError(err).code !== 'LEGAL_PROFILE_DUPLICATE') return null;
  return apiErrorDetailText(err, 'field') === 'tin' ? 'tin' : 'pinfl';
}
