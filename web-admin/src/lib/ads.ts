import type { AdBanner, AdLinkType } from './api';

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

export const AD_STATE_LABELS: Record<AdState, string> = {
  live: "Ko'rsatilmoqda",
  scheduled: 'Rejalashtirilgan',
  ended: 'Muddati tugagan',
  off: "O'chirilgan",
};

export const AD_LINK_LABELS: Record<AdLinkType, string> = {
  none: "Havolasiz",
  restaurant: 'Restoran',
  store: "Do'kon",
  url: 'Tashqi havola',
};

/** Bosish/ko'rish foizi; ko'rish bo'lmasa `null` (0% emas — bu boshqa narsa). */
export function adCtr(ad: Pick<AdBanner, 'impressions' | 'clicks'>): number | null {
  if (ad.impressions <= 0) return null;
  return (ad.clicks / ad.impressions) * 100;
}

export function formatCtr(ctr: number | null): string {
  return ctr == null ? '—' : `${ctr.toFixed(ctr < 10 ? 1 : 0)}%`;
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
  const errors: AdFormErrors = {};
  if (input.title.trim().length < 2) errors.title = 'Kamida 2 ta belgi';

  if (!input.image) errors.image = 'Rasm tanlang';
  else if (!AD_IMAGE_TYPES.includes(input.image.type)) errors.image = 'Faqat JPEG, PNG yoki WEBP';
  else if (input.image.size > AD_IMAGE_MAX_BYTES) errors.image = 'Rasm 2 MB dan katta';

  const target = input.linkTarget.trim();
  if (input.linkType === 'url' && !/^https:\/\/[^\s/]+\.[^\s]+/.test(target)) {
    errors.linkTarget = 'https:// bilan boshlanadigan havola kiriting';
  }
  if ((input.linkType === 'restaurant' || input.linkType === 'store') && !target) {
    errors.linkTarget = input.linkType === 'restaurant' ? 'Restoranni tanlang' : "Do'konni tanlang";
  }

  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    errors.endsAt = 'Tugash boshlanishdan keyin bo\'lishi kerak';
  }

  const order = Number(input.sortOrder || '0');
  if (!Number.isInteger(order) || order < 0 || order > 1000) errors.sortOrder = '0–1000 butun son';

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
