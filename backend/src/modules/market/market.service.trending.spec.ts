import { MarketService } from './market.service';
import { trendingProductIds as trendingProductIdsFn } from './market-trending';
import {
  Promotion,
  PromotionDiscountType,
  PromotionScope,
  PromotionVendorType,
} from '../../database/entities/promotion.entity';

jest.mock('./market-trending', () => ({
  ...jest.requireActual('./market-trending'),
  trendingProductIds: jest.fn(),
}));
const trendingProductIds = trendingProductIdsFn as jest.Mock;

/**
 * Bosh sahifa lentasi: SQL bergan tartibda, vitrinadagi aksiya narxi bilan,
 * har mahsulotda do'koni (savat bitta do'konga bog'langan — ilova shunga
 * qarab "boshqa do'kon" ogohlantirishini ko'rsatadi).
 */
describe('MarketService.listTrendingProducts', () => {
  const promotion = {
    id: 'promo-1',
    vendorType: PromotionVendorType.STORE,
    vendorId: 'store-2',
    discountType: PromotionDiscountType.FIXED,
    discountValue: 1000,
    scope: PromotionScope.ALL,
    categoryIds: [],
    itemIds: [],
    minOrderAmount: null,
    startsAt: new Date('2026-10-01'),
    endsAt: null,
    isActive: true,
  } as unknown as Promotion;

  const row = (id: string, storeId: string, price: number) => ({
    id,
    storeId,
    categoryId: null,
    name: id,
    price,
    store: { id: storeId, name: `Do'kon ${storeId}`, ownerUserId: 'secret-owner', phone: '+998' },
  });

  function build(rows: ReturnType<typeof row>[]) {
    const productRepo = { query: jest.fn(), find: jest.fn().mockResolvedValue(rows) };
    const promotionsService = {
      activeByVendor: jest.fn().mockResolvedValue(new Map([['store-2', [promotion]]])),
    };
    const service = new MarketService(
      {} as never, {} as never, productRepo as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      undefined, promotionsService as never,
    );
    return { service, productRepo };
  }

  beforeEach(() => trendingProductIds.mockReset());

  it('SQL tartibi saqlanadi, aksiya narxi va do‘kon (faqat id/nom) qo‘shiladi', async () => {
    trendingProductIds.mockResolvedValue(['milk', 'bread']);
    const { service } = build([row('bread', 'store-1', 4000), row('milk', 'store-2', 12000)]);

    const page = await service.listTrendingProducts(1, 20);

    expect(page.items.map((p) => p.id)).toEqual(['milk', 'bread']);
    expect(page.items[0]).toEqual(
      expect.objectContaining({ finalPrice: 11000, store: { id: 'store-2', name: "Do'kon store-2" } }),
    );
    expect(page.items[1]).toEqual(expect.objectContaining({ finalPrice: 4000 }));
    expect(JSON.stringify(page)).not.toContain('secret-owner');
    expect(page.hasMore).toBe(false);
  });

  it('limit+1 so‘raladi: ortiqchasi bo‘lsa hasMore va u qaytarilmaydi', async () => {
    trendingProductIds.mockResolvedValue(['a', 'b', 'c']);
    const { service } = build([row('a', 'store-1', 1), row('b', 'store-1', 1), row('c', 'store-1', 1)]);

    const page = await service.listTrendingProducts(2, 2);

    expect(trendingProductIds).toHaveBeenCalledWith(expect.any(Function), 3, 2);
    expect(page.items.map((p) => p.id)).toEqual(['a', 'b']);
    expect(page).toEqual(expect.objectContaining({ page: 2, limit: 2, hasMore: true }));
  });

  it('chegaralar: limit 1..50, sahifa ≥ 1', async () => {
    trendingProductIds.mockResolvedValue([]);
    const { service } = build([]);
    await service.listTrendingProducts(0, 1000);
    expect(trendingProductIds).toHaveBeenLastCalledWith(expect.any(Function), 51, 0);
  });

  it('bo‘sh — find chaqirilmaydi', async () => {
    trendingProductIds.mockResolvedValue([]);
    const { service, productRepo } = build([]);
    await expect(service.listTrendingProducts(1, 20)).resolves.toEqual(
      expect.objectContaining({ items: [], hasMore: false }),
    );
    expect(productRepo.find).not.toHaveBeenCalled();
  });
});
