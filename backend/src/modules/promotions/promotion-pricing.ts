import {
  Promotion,
  PromotionDiscountType,
  PromotionScope,
} from '../../database/entities/promotion.entity';

/**
 * Sotuvchi aksiyalari bo'yicha narx hisobi — sof funksiyalar
 * (docs/specs/food-market-ux-v5.md §4).
 *
 * Qoidalar:
 *  · bitta taomga/mahsulotga bir vaqtda faqat ENG KATTA chegirma (so'mda);
 *  · foiz chegirmasi butun so'mga yaxlitlanadi;
 *  · qat'iy chegirma narxdan kichik bo'lsagina qo'llanadi (tekin tovar yo'q);
 *  · `minOrderAmount` li aksiya vitrinada narxga tushmaydi (savat summasi
 *    noma'lum), buyurtmada esa ASL summa shu chegaraga yetsa qo'llanadi.
 *
 * Chegirma sotuvchi hisobidan: buyurtma qatoriga `price = finalPrice`
 * yoziladi, shu sabab komissiya, hamyon o'tkazmasi va fiskal chek
 * avtomatik chegirmali narxdan hisoblanadi.
 */

export interface PricingItem {
  id: string;
  categoryId: string | null;
  price: number;
}

export interface DiscountView {
  title: string;
  discountType: PromotionDiscountType;
  discountValue: number;
}

export interface PricedItem {
  finalPrice: number;
  discountPerUnit: number;
  discount: DiscountView | null;
  promotionId: string | null;
}

export interface PricedLine extends PricedItem {
  unitPrice: number;
  qty: number;
}

export interface PricedOrder {
  lines: PricedLine[];
  /** Asl narxlar bo'yicha tovar summasi. */
  subtotal: number;
  /** Chegirmali tovar summasi (buyurtmaga yoziladigan). */
  itemsTotal: number;
  /** subtotal − itemsTotal. */
  promotionDiscount: number;
}

type PromotionLike = Pick<
  Promotion,
  | 'id'
  | 'title'
  | 'discountType'
  | 'discountValue'
  | 'scope'
  | 'categoryIds'
  | 'itemIds'
  | 'minOrderAmount'
>;

export function isPromotionActive(
  promotion: Pick<Promotion, 'isActive' | 'startsAt' | 'endsAt'>,
  now: Date,
): boolean {
  if (!promotion.isActive) return false;
  if (new Date(promotion.startsAt).getTime() > now.getTime()) return false;
  return promotion.endsAt === null || new Date(promotion.endsAt).getTime() > now.getTime();
}

function covers(promotion: PromotionLike, item: PricingItem): boolean {
  switch (promotion.scope) {
    case PromotionScope.ALL:
      return true;
    case PromotionScope.CATEGORY:
      return item.categoryId !== null && (promotion.categoryIds ?? []).includes(item.categoryId);
    case PromotionScope.ITEMS:
      return (promotion.itemIds ?? []).includes(item.id);
    default:
      return false;
  }
}

/** Bitta dona uchun chegirma (so'm); qo'llanmasa 0. */
export function unitDiscount(promotion: PromotionLike, price: number): number {
  const value = Number(promotion.discountValue);
  if (!(price > 0) || !(value > 0)) return 0;
  if (promotion.discountType === PromotionDiscountType.PERCENT) {
    return Math.min(price, Math.round((price * value) / 100));
  }
  return value < price ? Math.round(value) : 0;
}

export function toDiscountView(promotion: PromotionLike): DiscountView {
  return {
    title: promotion.title,
    discountType: promotion.discountType,
    discountValue: Number(promotion.discountValue),
  };
}

function bestFor(item: PricingItem, promotions: readonly PromotionLike[]): PricedItem {
  const price = Number(item.price);
  let best: { promotion: PromotionLike; amount: number } | null = null;
  for (const promotion of promotions) {
    if (!covers(promotion, item)) continue;
    const amount = unitDiscount(promotion, price);
    if (amount > 0 && (!best || amount > best.amount)) {
      best = { promotion, amount };
    }
  }
  if (!best) {
    return { finalPrice: price, discountPerUnit: 0, discount: null, promotionId: null };
  }
  return {
    finalPrice: price - best.amount,
    discountPerUnit: best.amount,
    discount: toDiscountView(best.promotion),
    promotionId: best.promotion.id,
  };
}

const hasMinimum = (promotion: PromotionLike): boolean => Number(promotion.minOrderAmount ?? 0) > 0;

/** Vitrina narxi: faqat savat summasiga bog'liq bo'lmagan aksiyalar. */
export function priceCatalogItem(item: PricingItem, activePromotions: readonly PromotionLike[]): PricedItem {
  return bestFor(item, activePromotions.filter((p) => !hasMinimum(p)));
}

/** Buyurtma narxi: `minOrderAmount` ASL tovar summasiga nisbatan tekshiriladi. */
export function priceOrderLines(
  lines: ReadonlyArray<{ item: PricingItem; qty: number }>,
  activePromotions: readonly PromotionLike[],
): PricedOrder {
  const subtotal = lines.reduce((sum, line) => sum + line.qty * Number(line.item.price), 0);
  const eligible = activePromotions.filter((p) => Number(p.minOrderAmount ?? 0) <= subtotal);
  const priced = lines.map((line) => ({
    ...bestFor(line.item, eligible),
    unitPrice: Number(line.item.price),
    qty: line.qty,
  }));
  const itemsTotal = priced.reduce((sum, line) => sum + line.qty * line.finalPrice, 0);
  return { lines: priced, subtotal, itemsTotal, promotionDiscount: subtotal - itemsTotal };
}

/**
 * "Eng katta" aksiya tartibi: foizli qat'iydan oldin (foiz har qanday narxda
 * ishlaydi), bir xil turda — qiymat kamayishi bo'yicha.
 */
export function compareStrength(a: PromotionLike, b: PromotionLike): number {
  const typeRank = (p: PromotionLike): number => (p.discountType === PromotionDiscountType.PERCENT ? 0 : 1);
  return typeRank(a) - typeRank(b) || Number(b.discountValue) - Number(a.discountValue);
}

export function strongestPromotion(promotions: readonly PromotionLike[]): DiscountView | null {
  if (promotions.length === 0) return null;
  return toDiscountView([...promotions].sort(compareStrength)[0]);
}
