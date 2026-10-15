/**
 * Haydovchi huquqiy profili tahrir formasi: validatsiya va PATCH tanasi.
 * Backend qoidalari: `backend/src/modules/drivers/dto/update-driver-legal.dto.ts`.
 */
import type { DriverLegalBrief, DriverLegalPatch, DriverLegalProfile, DriverTaxStatus } from './compliance-api';
import { isIsoDate, isPinfl, isTin } from './compliance';
import { apiErrorDetailText, parseApiError } from './api-error';

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

export const TAX_STATUS_LABELS: Record<DriverTaxStatus, string> = {
  self_employed: "O'zini o'zi band qilgan",
  individual_entrepreneur: 'YaTT',
};

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
export function validateDriverLegalForm(form: DriverLegalForm, today: string): DriverLegalErrors {
  const errors: DriverLegalErrors = {};
  const pinfl = form.pinfl.trim();
  const tin = form.tin.trim();
  // Niqoblangan (o'zgartirilmaydigan) qiymat tekshirilmaydi.
  if (pinfl && !isMaskedLegalId(pinfl) && !isPinfl(pinfl)) {
    errors.pinfl = "JShShIR 14 ta raqamdan iborat bo'lishi kerak";
  }
  if (tin && !isMaskedLegalId(tin) && !isTin(tin)) errors.tin = "STIR 9 ta raqamdan iborat bo'lishi kerak";

  const birth = form.birthDate.trim();
  if (birth) {
    if (!isIsoDate(birth)) errors.birthDate = "Noto'g'ri sana";
    else if (birth > today) errors.birthDate = "Tug'ilgan sana kelajakda bo'lishi mumkin emas";
  }
  const licence = form.drivingLicenceIssuedAt.trim();
  if (licence) {
    if (!isIsoDate(licence)) errors.drivingLicenceIssuedAt = "Noto'g'ri sana";
    else if (licence > today) errors.drivingLicenceIssuedAt = "Sana kelajakda bo'lishi mumkin emas";
    else if (birth && !errors.birthDate && licence <= birth) {
      errors.drivingLicenceIssuedAt = "Guvohnoma tug'ilgan sanadan keyin berilgan bo'lishi kerak";
    }
  }
  if (form.taxiLicenceNumber.trim().length > 50) errors.taxiLicenceNumber = "Ko'pi bilan 50 belgi";
  if (form.taxiLicenceRegion.trim().length > 100) errors.taxiLicenceRegion = "Ko'pi bilan 100 belgi";
  if (!/^[A-Z]{2}$/.test(form.citizenship.trim())) {
    errors.citizenship = '2 harfli ISO kod (masalan UZ)';
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
  if (!brief) return { label: "Noma'lum", variant: 'neutral', title: "Holatni hisoblab bo'lmadi" };
  if (brief.eligible || brief.issueCount === 0) {
    return { label: 'Talablarga javob beradi', variant: 'success', title: 'VMQ 200 talablari bajarilgan' };
  }
  const count = brief.issueCount;
  if (brief.blocking) {
    return {
      label: `Bloklangan · ${count}`,
      variant: 'danger',
      title: `${count} ta kamchilik — taksi uchun onlayn chiqa olmaydi`,
    };
  }
  return { label: `${count} ta kamchilik`, variant: 'info', title: "Kamchiliklar ro'yxati haydovchi sahifasida" };
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

export const LEGAL_DUPLICATE_MESSAGE: Record<'pinfl' | 'tin', string> = {
  pinfl: 'Bu JShShIR boshqa haydovchi profilida roʻyxatdan oʻtgan',
  tin: 'Bu STIR boshqa haydovchi profilida roʻyxatdan oʻtgan',
};

/** 409 `LEGAL_PROFILE_DUPLICATE` — qaysi maydon (`details.field`); boshqa xato — `null`. */
export function legalDuplicateField(err: unknown): 'pinfl' | 'tin' | null {
  if (parseApiError(err).code !== 'LEGAL_PROFILE_DUPLICATE') return null;
  return apiErrorDetailText(err, 'field') === 'tin' ? 'tin' : 'pinfl';
}
