import type { AdBanner, AdLinkType, AdDailyRow } from './api';
import { t } from '@/locales';

/**
 * Reklama sahifasining sof mantig'i — React'siz, testlanadigan.
 *
 * `isActive` admin qo'lidagi kalit; foydalanuvchiga ko'rinish esa kalit VA
 * muddat oynasiga bog'liq. Jadvalda aynan "hozir ko'rinyaptimi" degan savolga
 * javob kerak, shuning uchun to'rt holat.
 */
export type AdState = 'live' | 'scheduled' | 'ended' | 'off';

export function adState(ad: Pick<AdBanner, 'isActive' | 'startsAt' | 'endsAt'>, now = new Date()): AdState {
  if (!ad.isActive) return 'off';
  if (ad.endsAt && new Date(ad.endsAt) <= now) return 'ended';
  if (ad.startsAt && new Date(ad.startsAt) > now) return 'scheduled';
  return 'live';
}

/** Render paytida chaqiring — faol tildagi yorliqlar. */
export function adStateLabels(): Record<AdState, string> {
  return t().ads.state;
}

/** Tartib: none, restaurant, store, url (forma variantlari shu tartibda). */
export function adLinkLabels(): Record<AdLinkType, string> {
  return t().ads.link;
}

/** Bosish/ko'rish foizi; ko'rish bo'lmasa `null` (0% emas — bu boshqa narsa). */
export function adCtr(ad: Pick<AdBanner, 'impressions' | 'clicks'>): number | null {
  if (ad.impressions <= 0) return null;
  return (ad.clicks / ad.impressions) * 100;
}

export function formatCtr(ctr: number | null): string {
  return ctr == null ? '—' : `${ctr.toFixed(ctr < 10 ? 1 : 0)}%`;
}

/** Kunlik hisobotning davr bo'yicha jami — CTR [adCtr] bilan bir xil o'lchovda (%). */
export function dailyTotals(rows: ReadonlyArray<AdDailyRow>): {
  impressions: number;
  clicks: number;
  ctr: number | null;
} {
  const impressions = rows.reduce((sum, r) => sum + r.impressions, 0);
  const clicks = rows.reduce((sum, r) => sum + r.clicks, 0);
  return { impressions, clicks, ctr: adCtr({ impressions, clicks }) };
}

export const AD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const AD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface AdFormInput {
  title: string;
  linkType: AdLinkType;
  linkTarget: string;
  /** `<input type="datetime-local">` qiymati (mahalliy vaqt), bo'sh bo'lishi mumkin. */
  startsAt: string;
  endsAt: string;
  sortOrder: string;
  isActive: boolean;
  image: File | null;
}

export type AdFormErrors = Partial<Record<keyof AdFormInput, string>>;

/**
 * Server baribir hammasini qayta tekshiradi; bu yerda — admin formani
 * yuborishdan oldin xatoni maydon yonida ko'rishi uchun.
 */
export function validateAdForm(input: AdFormInput): AdFormErrors {
  const v = t().ads.validation;
  const errors: AdFormErrors = {};
  if (input.title.trim().length < 2) errors.title = v.titleMin;

  if (!input.image) errors.image = v.imageRequired;
  else if (!AD_IMAGE_TYPES.includes(input.image.type)) errors.image = v.imageType;
  else if (input.image.size > AD_IMAGE_MAX_BYTES) errors.image = v.imageSize;

  const target = input.linkTarget.trim();
  if (input.linkType === 'url' && !/^https:\/\/[^\s/]+\.[^\s]+/.test(target)) {
    errors.linkTarget = v.urlInvalid;
  }
  if ((input.linkType === 'restaurant' || input.linkType === 'store') && !target) {
    errors.linkTarget = input.linkType === 'restaurant' ? v.restaurantRequired : v.storeRequired;
  }

  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    errors.endsAt = v.endAfterStart;
  }

  const order = Number(input.sortOrder || '0');
  if (!Number.isInteger(order) || order < 0 || order > 1000) errors.sortOrder = v.sortOrder;

  return errors;
}

/** Tekshirilgan formani backend kutadigan multipart'ga aylantiradi. */
export function buildAdFormData(input: AdFormInput): FormData {
  const form = new FormData();
  form.append('title', input.title.trim());
  form.append('linkType', input.linkType);
  if (input.linkType !== 'none') form.append('linkTarget', input.linkTarget.trim());
  // datetime-local mahalliy vaqt: `new Date()` uni brauzer mintaqasida
  // o'qiydi va ISO (UTC) qilib yuboradi — server mintaqasidan qat'i nazar to'g'ri.
  if (input.startsAt) form.append('startsAt', new Date(input.startsAt).toISOString());
  if (input.endsAt) form.append('endsAt', new Date(input.endsAt).toISOString());
  form.append('sortOrder', String(Number(input.sortOrder || '0')));
  form.append('isActive', String(input.isActive));
  if (input.image) form.append('image', input.image);
  return form;
}
