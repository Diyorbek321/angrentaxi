import { MarketService } from './market.service';
import { searchProductIds as searchProductIdsFn } from './market-product-search';

jest.mock('./market-product-search', () => ({
  ...jest.requireActual('./market-product-search'),
  searchProductIds: jest.fn(),
}));
const searchProductIds = searchProductIdsFn as jest.Mock;

/**
 * Xaridor vitrinasi: do'kon ma'lumotida faqat OCHIQ maydonlar (STIR, egasi,
 * ichki telefon, komissiya — yo'q) va barcha do'konlar bo'yicha qidiruv.
 */
describe('MarketService — vitrina', () => {
  const store = {
    id: 's1',
    name: 'Bozorcha',
    address: 'Navoiy 5',
    imageKey: null,
    lat: 41,
    lng: 70,
    workingHoursStart: '08:00',
    workingHoursEnd: '22:00',
    deliveryMode: 'platform',
    status: 'active',
    // Maxfiy / ichki:
    ownerUserId: 'owner-secret',
    owner: { id: 'owner-secret', phone: '+998900000000' },
    phone: '+998911111111',
    tin: '123456789',
    commissionRate: 8,
    lowStockThreshold: 5,
    location: '0101000020E6100000',
  };
  const SECRETS = ['owner-secret', '+998911111111', '123456789', 'commissionRate', 'lowStockThreshold', '0101000020E6100000'];

  function build(products: unknown[] = []) {
    const storeRepo = {
      find: jest.fn().mockResolvedValue([store]),
      findOne: jest.fn().mockResolvedValue(store),
    };
    const productRepo = { query: jest.fn(), find: jest.fn().mockResolvedValue(products) };
    const categoryRepo = { find: jest.fn().mockResolvedValue([]) };
    const promotionsService = {
      activeByVendor: jest.fn().mockResolvedValue(new Map()),
      activeForVendor: jest.fn().mockResolvedValue([]),
    };
    const service = new MarketService(
      storeRepo as never, categoryRepo as never, productRepo as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      undefined, promotionsService as never,
    );
    return { service, productRepo };
  }

  const expectNoSecrets = (payload: unknown) => {
    const json = JSON.stringify(payload);
    for (const secret of SECRETS) expect(json).not.toContain(secret);
  };

  it("do'konlar ro'yxati — faqat ochiq maydonlar", async () => {
    const { service } = build();
    const stores = await service.listActiveStores();
    expectNoSecrets(stores);
    expect(stores[0]).toEqual(
      expect.objectContaining({ id: 's1', name: 'Bozorcha', address: 'Navoiy 5', workingHoursEnd: '22:00', deliveryMode: 'platform' }),
    );
  });

  it("do'kon sahifasi — faqat ochiq maydonlar", async () => {
    const { service } = build();
    const detail = await service.getStoreDetail('s1');
    expectNoSecrets(detail);
    expect(detail.store).toEqual(expect.objectContaining({ id: 's1', name: 'Bozorcha' }));
  });

  describe('searchProducts', () => {
    beforeEach(() => searchProductIds.mockReset());

    it("qisqa so'rov — bazaga bormaydi, bo'sh", async () => {
      const { service } = build();
      await expect(service.searchProducts(' s ', 1, 20)).resolves.toEqual(
        expect.objectContaining({ items: [], hasMore: false }),
      );
      expect(searchProductIds).not.toHaveBeenCalled();
    });

    it("natija do'kon nomi bilan, tartib saqlanadi, do'kon sirlari yo'q", async () => {
      searchProductIds.mockResolvedValue(['p2', 'p1']);
      const product = (id: string) => ({ id, storeId: 's1', categoryId: null, name: id, price: 5000, store });
      const { service } = build([product('p1'), product('p2')]);

      const page = await service.searchProducts('  sut ', 1, 20);

      expect(searchProductIds).toHaveBeenCalledWith(expect.any(Function), 'sut', 21, 0);
      expect(page.items.map((p) => p.id)).toEqual(['p2', 'p1']);
      expect(page.items[0].store).toEqual({ id: 's1', name: 'Bozorcha' });
      expectNoSecrets(page);
    });
  });
});
