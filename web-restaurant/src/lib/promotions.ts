import { formatMoney } from './format';
import { t } from '@/locales';

/**
 * Vendor aksiyalari (chegirmalar) — docs/specs/food-market-ux-v5.md §4.
 *
 * Bu fayl restoran va market panellarida BIR XIL (vendorga bog'liq emas):
 * katalog elementi faqat `{ id, categoryId, price }` sifatida ko'riladi.
 * Server baribir qayta tekshiradi — bu yerda faqat forma xatolarini erta
 * ko'rsatish va narx ko'rinishini oldindan chizish.
 */

export type DiscountType = 'percent' | 'fixed';
export type PromotionScope = 'all' | 'category' | 'items';

export interface Promotion {
  id: string;
  vendorType?: 'restaurant' | 'store';
  vendorId?: string;
  title: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  categoryIds?: string[] | null;
  itemIds?: string[] | null;
  minOrderAmount?: number | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** POST / PATCH tanasi — spec'dagi maydonlar AYNAN shu nomlar bilan. */
export interface PromotionPayload {
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  categoryIds: string[];
  itemIds: string[];
  minOrderAmount?: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}

/** Katalog elementi (taom yoki mahsulot) — chegirma qamrovini hisoblash uchun. */
export interface CatalogItem {
  id: string;
  categoryId: string | null;
  price: number;
}

/** Forma holati — input qiymatlari satr ko'rinishida. */
export interface PromotionForm {
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  scope: PromotionScope;
  categoryIds: string[];
  itemIds: string[];
  minOrderAmount: string;
  /** `datetime-local` qiymati (`2026-10-16T09:00`), mahalliy vaqt. */
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export type PromotionFormErrors = Partial<Record<keyof PromotionForm, string>>;

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 200;
export const PERCENT_MIN = 1;
export const PERCENT_MAX = 90;

export function discountTypeLabel(type: DiscountType): string {
  return t().promotions.discountType[type];
}

export function scopeLabel(scope: PromotionScope): string {
  return t().promotions.scope[scope];
}

// ─── Holat (segmentlar) ─────────────────────────────────────────────

export type PromotionPhase = 'active' | 'scheduled' | 'ended';

export function phaseLabel(phase: PromotionPhase): string {
  return t().promotions.phase[phase];
}

const time = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN);

/**
 * Muddati o'tgan yoki qo'lda o'chirilgan — "Tugagan" (o'chirilgani qayta
 * yoqilishi mumkin, jadvalda alohida badge bilan). Boshlanmagani —
 * "Rejalashtirilgan". Qolgani — "Faol".
 */
export function promotionPhase(p: Pick<Promotion, 'startsAt' | 'endsAt' | 'isActive'>, now: number): PromotionPhase {
  const ends = time(p.endsAt);
  if (!Number.isNaN(ends) && ends <= now) return 'ended';
  if (!p.isActive) return 'ended';
  const starts = time(p.startsAt);
  if (!Number.isNaN(starts) && starts > now) return 'scheduled';
  return 'active';
}

/** Faol emas, lekin muddati tugamagan — vendor o'zi o'chirgan. */
export function isPaused(p: Pick<Promotion, 'endsAt' | 'isActive'>, now: number): boolean {
  const ends = time(p.endsAt);
  return !p.isActive && (Number.isNaN(ends) || ends > now);
}

// ─── Narx ──────────────────────────────────────────────────────────

/** Bitta birlik uchun chegirma summasi (so'm, butun). Narxdan oshmaydi. */
export function discountAmount(price: number, type: DiscountType, value: number): number {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(value) || value <= 0) return 0;
  const raw = type === 'percent' ? (price * Math.min(value, 100)) / 100 : value;
  return Math.min(price, Math.round(raw));
}

export interface PricePreview {
  original: number;
  final: number;
  discount: number;
  /** Chegirma bormi — yo'q bo'lsa faqat asl narx chiziladi. */
  hasDiscount: boolean;
}

export function pricePreview(price: number, type: DiscountType, value: number): PricePreview {
  const discount = discountAmount(price, type, value);
  return { original: price, final: price - discount, discount, hasDiscount: discount > 0 };
}

/** "−15%" / "−5 000 soʻm" — badge va ro'yxat uchun. */
export function discountLabel(type: DiscountType, value: number): string {
  return type === 'percent' ? `−${value}%` : `−${formatMoney(value)}`;
}

/** Aksiya qamroviga tushadigan katalog elementlari. */
export function coveredItems<T extends CatalogItem>(
  promo: Pick<PromotionForm, 'scope' | 'categoryIds' | 'itemIds'>,
  items: readonly T[]
): T[] {
  if (promo.scope === 'all') return [...items];
  if (promo.scope === 'category') {
    const set = new Set(promo.categoryIds);
    return items.filter((i) => i.categoryId != null && set.has(i.categoryId));
  }
  const set = new Set(promo.itemIds);
  return items.filter((i) => set.has(i.id));
}

// ─── Forma ─────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → `datetime-local` qiymati (mahalliy vaqt). Bo'sh/yaroqsiz → ''. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` → ISO. Bo'sh/yaroqsiz → null. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function emptyPromotionForm(now: number = Date.now()): PromotionForm {
  return {
    title: '',
    description: '',
    discountType: 'percent',
    discountValue: '',
    scope: 'all',
    categoryIds: [],
    itemIds: [],
    minOrderAmount: '',
    startsAt: toLocalInput(new Date(now).toISOString()),
    endsAt: '',
    isActive: true,
  };
}

export function promotionToForm(p: Promotion): PromotionForm {
  return {
    title: p.title ?? '',
    description: p.description ?? '',
    discountType: p.discountType,
    discountValue: String(p.discountValue ?? ''),
    scope: p.scope,
    categoryIds: [...(p.categoryIds ?? [])],
    itemIds: [...(p.itemIds ?? [])],
    minOrderAmount: p.minOrderAmount != null && p.minOrderAmount > 0 ? String(p.minOrderAmount) : '',
    startsAt: toLocalInput(p.startsAt),
    endsAt: toLocalInput(p.endsAt),
    isActive: p.isActive,
  };
}

const isWholeNumber = (v: string) => /^\d+$/.test(v.trim());

/**
 * Spec qoidalari: sarlavha ≤ 60, tavsif ≤ 200; foiz 1–90; summa > 0 va
 * qamrovdagi ENG ARZON pozitsiya narxidan kichik; kategoriya/pozitsiya
 * qamrovida kamida bittasi tanlangan; tugash boshlanishdan keyin.
 * `items` — vendorning katalogi (summa chegarasini tekshirish uchun).
 */
export function validatePromotion(form: PromotionForm, items: readonly CatalogItem[] = []): PromotionFormErrors {
  const v = t().promotions.validation;
  const errors: PromotionFormErrors = {};
  const title = form.title.trim();
  if (!title) errors.title = v.titleRequired;
  else if (title.length > TITLE_MAX) errors.title = v.maxChars(TITLE_MAX);

  if (form.description.trim().length > DESCRIPTION_MAX) {
    errors.description = v.maxChars(DESCRIPTION_MAX);
  }

  const rawValue = form.discountValue.trim();
  const value = Number(rawValue);
  if (!rawValue) errors.discountValue = v.valueRequired;
  else if (!isWholeNumber(rawValue)) errors.discountValue = v.wholeNumber;
  else if (form.discountType === 'percent' && (value < PERCENT_MIN || value > PERCENT_MAX)) {
    errors.discountValue = v.percentRange(PERCENT_MIN, PERCENT_MAX);
  } else if (form.discountType === 'fixed') {
    if (value <= 0) errors.discountValue = v.amountPositive;
    else {
      const prices = coveredItems(form, items).map((i) => Number(i.price)).filter((p) => p > 0);
      const cheapest = prices.length > 0 ? Math.min(...prices) : null;
      if (cheapest != null && value >= cheapest) {
        errors.discountValue = v.amountBelowCheapest(formatMoney(cheapest));
      }
    }
  }

  if (form.scope === 'category' && form.categoryIds.length === 0) errors.categoryIds = v.categoryRequired;
  if (form.scope === 'items' && form.itemIds.length === 0) errors.itemIds = v.itemRequired;

  const min = form.minOrderAmount.trim();
  if (min && !isWholeNumber(min)) errors.minOrderAmount = v.wholeAmount;

  const starts = fromLocalInput(form.startsAt);
  if (!starts) errors.startsAt = v.startRequired;
  if (form.endsAt) {
    const ends = fromLocalInput(form.endsAt);
    if (!ends) errors.endsAt = v.dateInvalid;
    else if (starts && new Date(ends).getTime() <= new Date(starts).getTime()) {
      errors.endsAt = v.endAfterStart;
    }
  }
  return errors;
}

/** Faqat `validatePromotion` xatosiz bo'lgandan keyin chaqiriladi. */
export function toPromotionPayload(form: PromotionForm): PromotionPayload {
  const description = form.description.trim();
  const min = form.minOrderAmount.trim();
  return {
    title: form.title.trim(),
    ...(description ? { description } : {}),
    discountType: form.discountType,
    discountValue: Number(form.discountValue.trim()),
    scope: form.scope,
    categoryIds: form.scope === 'category' ? [...form.categoryIds] : [],
    itemIds: form.scope === 'items' ? [...form.itemIds] : [],
    ...(min ? { minOrderAmount: Number(min) } : {}),
    startsAt: fromLocalInput(form.startsAt) ?? new Date().toISOString(),
    endsAt: fromLocalInput(form.endsAt),
    isActive: form.isActive,
  };
}

/** Ro'yxat ichida id'ni yoqish/o'chirish — yangi massiv qaytaradi. */
export function toggleId(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

// ─── Katalogdagi chegirma belgisi ──────────────────────────────────

export interface CatalogDiscountSource {
  price: number;
  finalPrice?: number | null;
  discount?: { title?: string; discountType: DiscountType; discountValue: number } | null;
}

export interface CatalogDiscountView {
  label: string;
  title: string;
  final: number;
}

/**
 * API pozitsiyaga `finalPrice` + `discount` qaytargan bo'lsa (faol aksiya) —
 * badge va yakuniy narx. Maydonlar yo'q yoki chegirma 0 bo'lsa → null.
 */
export function catalogDiscount(item: CatalogDiscountSource): CatalogDiscountView | null {
  const d = item.discount;
  const price = Number(item.price);
  const final = Number(item.finalPrice);
  if (!d || !Number.isFinite(final) || item.finalPrice == null || final >= price) return null;
  return { label: discountLabel(d.discountType, d.discountValue), title: d.title ?? '', final };
}
