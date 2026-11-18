import {
  PromotionDiscountType,
  PromotionScope,
  PromotionVendorType,
  Promotion,
} from '../../database/entities/promotion.entity';
import {
  compareStrength,
  isPromotionActive,
  priceCatalogItem,
  priceOrderLines,
  strongestPromotion,
} from './promotion-pricing';

const NOW = new Date('2026-10-16T10:00:00Z');

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p1',
    vendorType: PromotionVendorType.RESTAURANT,
    vendorId: 'r1',
    title: 'Aksiya',
    description: null,
    discountType: PromotionDiscountType.PERCENT,
    discountValue: 10,
    scope: PromotionScope.ALL,
    categoryIds: [],
    itemIds: [],
    minOrderAmount: null,
    startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: null,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const dish = { id: 'd1', categoryId: 'c1', price: 30000 };

describe('isPromotionActive', () => {
  it('requires isActive, a started window and an unexpired end', () => {
    expect(isPromotionActive(promo(), NOW)).toBe(true);
    expect(isPromotionActive(promo({ isActive: false }), NOW)).toBe(false);
    expect(isPromotionActive(promo({ startsAt: new Date('2026-10-17T00:00:00Z') }), NOW)).toBe(false);
    expect(isPromotionActive(promo({ endsAt: new Date('2026-10-16T09:59:59Z') }), NOW)).toBe(false);
    expect(isPromotionActive(promo({ endsAt: new Date('2026-10-20T00:00:00Z') }), NOW)).toBe(true);
  });
});

describe('priceCatalogItem', () => {
  it('no promotion → finalPrice equals price, discount null', () => {
    expect(priceCatalogItem(dish, [])).toEqual({
      finalPrice: 30000,
      discountPerUnit: 0,
      discount: null,
      promotionId: null,
    });
  });

  it('percent discount is rounded to whole so‘m', () => {
    const result = priceCatalogItem({ ...dish, price: 12345 }, [promo({ discountValue: 15 })]);
    expect(result.discountPerUnit).toBe(1852);
    expect(result.finalPrice).toBe(10493);
    expect(result.discount).toEqual({ title: 'Aksiya', discountType: 'percent', discountValue: 15 });
  });

  it('scope=category and scope=items only cover matching items', () => {
    const byCategory = promo({ scope: PromotionScope.CATEGORY, categoryIds: ['c2'] });
    const byItem = promo({ id: 'p2', scope: PromotionScope.ITEMS, itemIds: ['d1'], discountValue: 20 });
    expect(priceCatalogItem(dish, [byCategory]).discount).toBeNull();
    expect(priceCatalogItem(dish, [byCategory, byItem]).finalPrice).toBe(24000);
  });

  it('only the BIGGEST discount applies to one item (no stacking)', () => {
    const tenPercent = promo({ id: 'a', discountValue: 10 });
    const fixed5000 = promo({ id: 'b', discountType: PromotionDiscountType.FIXED, discountValue: 5000, title: 'B' });
    const result = priceCatalogItem(dish, [tenPercent, fixed5000]);
    expect(result.discountPerUnit).toBe(5000);
    expect(result.finalPrice).toBe(25000);
    expect(result.promotionId).toBe('b');
  });

  it('a fixed discount not smaller than the price is ignored for that item', () => {
    const fixed = promo({ discountType: PromotionDiscountType.FIXED, discountValue: 30000 });
    expect(priceCatalogItem(dish, [fixed]).finalPrice).toBe(30000);
  });

  it('promotions with a minimum order amount are not shown as item prices', () => {
    expect(priceCatalogItem(dish, [promo({ minOrderAmount: 50000 })]).discount).toBeNull();
  });
});

describe('priceOrderLines', () => {
  it('applies min-order promotions only when the original subtotal reaches the minimum', () => {
    const minPromo = promo({ minOrderAmount: 60000 });
    const one = priceOrderLines([{ item: dish, qty: 1 }], [minPromo]);
    expect(one.promotionDiscount).toBe(0);
    expect(one.itemsTotal).toBe(30000);

    const two = priceOrderLines([{ item: dish, qty: 2 }], [minPromo]);
    expect(two.subtotal).toBe(60000);
    expect(two.lines[0]).toMatchObject({ unitPrice: 30000, finalPrice: 27000, discountPerUnit: 3000 });
    expect(two.itemsTotal).toBe(54000);
    expect(two.promotionDiscount).toBe(6000);
  });
});

describe('strongestPromotion / compareStrength', () => {
  it('percent ranks above fixed; same type by value', () => {
    const p10 = promo({ id: 'a', discountValue: 10 });
    const p25 = promo({ id: 'b', discountValue: 25 });
    const f9000 = promo({ id: 'c', discountType: PromotionDiscountType.FIXED, discountValue: 9000 });
    expect([f9000, p10, p25].sort(compareStrength).map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(strongestPromotion([f9000, p10])).toEqual({ title: 'Aksiya', discountType: 'percent', discountValue: 10 });
    expect(strongestPromotion([])).toBeNull();
  });
});
