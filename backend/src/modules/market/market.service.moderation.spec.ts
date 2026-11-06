import { MarketService } from './market.service';

function setup(rows: unknown[] = [], total = 0) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
  const productRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const none = {} as never;
  const service = new MarketService(
    none, none, productRepo as never, none, none, none, none, none, none, none, none, none,
  );
  return { service, qb };
}

describe('MarketService.adminListProducts', () => {
  it('sahifalaydi: hammasini emas, faqat bitta sahifani oladi', async () => {
    const { service, qb } = setup([{ id: 'd1' }], 45);
    const result = await service.adminListProducts({ page: 3, limit: 20 });
    expect(qb.skip).toHaveBeenCalledWith(40);
    expect(qb.take).toHaveBeenCalledWith(20);
    expect(qb.where).not.toHaveBeenCalled();
    expect(result).toEqual({ products: [{ id: 'd1' }], total: 45, page: 3, limit: 20 });
  });

  it("nom yoki do'kon nomi bo'yicha qidiradi", async () => {
    const { service, qb } = setup();
    await service.adminListProducts({ search: '  osh ' });
    expect(qb.where).toHaveBeenCalledWith('(product.name ILIKE :q OR store.name ILIKE :q)', { q: '%osh%' });
  });

  it('standart: 1-sahifa, 20 ta', async () => {
    const { service, qb } = setup();
    await service.adminListProducts({});
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(20);
  });
});
