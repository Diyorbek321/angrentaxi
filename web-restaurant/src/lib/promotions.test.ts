import { describe, expect, it } from 'vitest';
import {
  catalogDiscount,
  coveredItems,
  discountAmount,
  discountLabel,
  emptyPromotionForm,
  fromLocalInput,
  isPaused,
  pricePreview,
  promotionPhase,
  promotionToForm,
  toLocalInput,
  toPromotionPayload,
  toggleId,
  validatePromotion,
  type PromotionForm,
} from './promotions';

const NOW = new Date('2026-10-16T12:00:00Z').getTime();
const items = [
  { id: 'a', categoryId: 'c1', price: 30000 },
  { id: 'b', categoryId: 'c1', price: 12000 },
  { id: 'c', categoryId: 'c2', price: 8000 },
];

const form = (over: Partial<PromotionForm> = {}): PromotionForm => ({
  ...emptyPromotionForm(NOW),
  title: 'Kuzgi aksiya',
  discountValue: '15',
  ...over,
});

describe('promotionPhase', () => {
  const base = { startsAt: '2026-10-10T00:00:00Z', endsAt: null, isActive: true };
  it('active inside the window', () => expect(promotionPhase(base, NOW)).toBe('active'));
  it('scheduled before start', () =>
    expect(promotionPhase({ ...base, startsAt: '2026-10-20T00:00:00Z' }, NOW)).toBe('scheduled'));
  it('ended after endsAt', () =>
    expect(promotionPhase({ ...base, endsAt: '2026-10-15T00:00:00Z' }, NOW)).toBe('ended'));
  it('paused counts as ended but is flagged', () => {
    expect(promotionPhase({ ...base, isActive: false }, NOW)).toBe('ended');
    expect(isPaused({ ...base, isActive: false }, NOW)).toBe(true);
    expect(isPaused({ ...base, isActive: false, endsAt: '2026-10-01T00:00:00Z' }, NOW)).toBe(false);
  });
});

describe('price preview', () => {
  it('percent rounds to whole so‘m', () => {
    expect(discountAmount(12345, 'percent', 15)).toBe(1852);
    expect(pricePreview(30000, 'percent', 20)).toEqual({ original: 30000, final: 24000, discount: 6000, hasDiscount: true });
  });
  it('fixed never exceeds the price', () => {
    expect(discountAmount(5000, 'fixed', 8000)).toBe(5000);
    expect(pricePreview(30000, 'fixed', 5000).final).toBe(25000);
  });
  it('no discount for empty / invalid values', () => {
    expect(pricePreview(30000, 'percent', 0).hasDiscount).toBe(false);
    expect(discountAmount(NaN, 'fixed', 100)).toBe(0);
  });
  it('labels', () => {
    expect(discountLabel('percent', 15)).toBe('−15%');
    expect(discountLabel('fixed', 5000)).toMatch(/^−5\s000/);
  });
});

describe('coveredItems', () => {
  it('scope all / category / items', () => {
    expect(coveredItems({ scope: 'all', categoryIds: [], itemIds: [] }, items)).toHaveLength(3);
    expect(coveredItems({ scope: 'category', categoryIds: ['c1'], itemIds: [] }, items).map((i) => i.id)).toEqual(['a', 'b']);
    expect(coveredItems({ scope: 'items', categoryIds: [], itemIds: ['c'] }, items).map((i) => i.id)).toEqual(['c']);
  });
});

describe('validatePromotion', () => {
  it('accepts a valid form', () => expect(validatePromotion(form(), items)).toEqual({}));

  it('title required and ≤ 60', () => {
    expect(validatePromotion(form({ title: '  ' }), items).title).toBeTruthy();
    expect(validatePromotion(form({ title: 'x'.repeat(61) }), items).title).toBeTruthy();
  });

  it('description ≤ 200', () => {
    expect(validatePromotion(form({ description: 'x'.repeat(201) }), items).description).toBeTruthy();
  });

  it('percent 1–90', () => {
    expect(validatePromotion(form({ discountValue: '0' }), items).discountValue).toBeTruthy();
    expect(validatePromotion(form({ discountValue: '91' }), items).discountValue).toBeTruthy();
    expect(validatePromotion(form({ discountValue: '90' }), items).discountValue).toBeUndefined();
    expect(validatePromotion(form({ discountValue: '12.5' }), items).discountValue).toBeTruthy();
  });

  it('fixed must be below the cheapest covered price', () => {
    const fixed = (v: string, over: Partial<PromotionForm> = {}) =>
      validatePromotion(form({ discountType: 'fixed', discountValue: v, ...over }), items).discountValue;
    expect(fixed('8000')).toMatch(/kichik/);
    expect(fixed('7999')).toBeUndefined();
    // Only c1 is covered → cheapest is 12 000.
    expect(fixed('10000', { scope: 'category', categoryIds: ['c1'] })).toBeUndefined();
    expect(fixed('0')).toBeTruthy();
  });

  it('category / item scope needs a selection', () => {
    expect(validatePromotion(form({ scope: 'category' }), items).categoryIds).toBeTruthy();
    expect(validatePromotion(form({ scope: 'items' }), items).itemIds).toBeTruthy();
  });

  it('end must be after start', () => {
    const errs = validatePromotion(form({ startsAt: '2026-10-16T10:00', endsAt: '2026-10-16T09:00' }), items);
    expect(errs.endsAt).toBeTruthy();
    expect(validatePromotion(form({ startsAt: '' }), items).startsAt).toBeTruthy();
  });

  it('min order must be a whole number', () => {
    expect(validatePromotion(form({ minOrderAmount: '-5' }), items).minOrderAmount).toBeTruthy();
    expect(validatePromotion(form({ minOrderAmount: '50000' }), items).minOrderAmount).toBeUndefined();
  });
});

describe('payload / form round trip', () => {
  it('drops ids that do not belong to the scope and empty optionals', () => {
    const payload = toPromotionPayload(
      form({ scope: 'category', categoryIds: ['c1'], itemIds: ['a'], startsAt: '2026-10-16T10:00', endsAt: '' })
    );
    expect(payload.categoryIds).toEqual(['c1']);
    expect(payload.itemIds).toEqual([]);
    expect(payload.endsAt).toBeNull();
    expect(payload).not.toHaveProperty('description');
    expect(payload).not.toHaveProperty('minOrderAmount');
    expect(payload.discountValue).toBe(15);
  });

  it('promotionToForm tolerates missing arrays', () => {
    const f = promotionToForm({
      id: 'p',
      title: 'T',
      discountType: 'fixed',
      discountValue: 5000,
      scope: 'all',
      categoryIds: null,
      startsAt: '2026-10-16T10:00:00Z',
      endsAt: null,
      isActive: true,
    });
    expect(f.categoryIds).toEqual([]);
    expect(f.itemIds).toEqual([]);
    expect(f.endsAt).toBe('');
    expect(f.discountValue).toBe('5000');
  });

  it('local input conversion is symmetric', () => {
    const iso = fromLocalInput('2026-10-16T09:30');
    expect(iso).not.toBeNull();
    expect(toLocalInput(iso)).toBe('2026-10-16T09:30');
    expect(fromLocalInput('')).toBeNull();
    expect(toLocalInput('garbage')).toBe('');
  });

  it('toggleId adds and removes without mutating', () => {
    const list = ['a'];
    expect(toggleId(list, 'b')).toEqual(['a', 'b']);
    expect(toggleId(list, 'a')).toEqual([]);
    expect(list).toEqual(['a']);
  });
});

describe('catalogDiscount', () => {
  it('shows only when the API sent a real discount', () => {
    expect(
      catalogDiscount({ price: 30000, finalPrice: 24000, discount: { title: 'Kuz', discountType: 'percent', discountValue: 20 } })
    ).toEqual({ label: '−20%', title: 'Kuz', final: 24000 });
    expect(catalogDiscount({ price: 30000 })).toBeNull();
    expect(catalogDiscount({ price: 30000, finalPrice: 30000, discount: { discountType: 'fixed', discountValue: 1 } })).toBeNull();
    expect(catalogDiscount({ price: 30000, finalPrice: null, discount: { discountType: 'fixed', discountValue: 1 } })).toBeNull();
  });
});
