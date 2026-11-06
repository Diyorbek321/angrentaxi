import { countProductsByCategory, vendorStockSummary, RESTOCK_LIST_LIMIT } from './vendor-catalog-summary';

function makeQb(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue(undefined),
    getMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('countProductsByCategory', () => {
  it("do'kon bo'yicha guruhlab sanaydi, kategoriyasizlarni tashlaydi", async () => {
    const qb = makeQb({
      getRawMany: jest.fn().mockResolvedValue([
        { categoryId: 'c1', count: '3' },
        { categoryId: null, count: '5' },
        { categoryId: 'c2', count: '1' },
      ]),
    });
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const counts = await countProductsByCategory(repo as never, 'store-1');

    expect(qb.where).toHaveBeenCalledWith('product.storeId = :storeId', { storeId: 'store-1' });
    expect(qb.groupBy).toHaveBeenCalledWith('product.categoryId');
    expect(counts).toEqual({ c1: 3, c2: 1 });
  });
});

describe('vendorStockSummary', () => {
  function setup(rawCounts: unknown, rows: unknown[] = []) {
    const countsQb = makeQb({ getRawOne: jest.fn().mockResolvedValue(rawCounts) });
    const listQb = makeQb({ getMany: jest.fn().mockResolvedValue(rows) });
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(countsQb).mockReturnValueOnce(listQb),
    };
    return { repo: repo as never, countsQb, listQb };
  }

  it("tugagan va kam qolgan sonlari, chegaraga tushganlar ro'yxati", async () => {
    const { repo, listQb } = setup({ total: '40', out: '2', low: '4' }, [{ id: 'p1', stock: 0 }]);

    const result = await vendorStockSummary(repo, 'store-1', 5);

    expect(listQb.where).toHaveBeenCalledWith('product.storeId = :storeId', { storeId: 'store-1' });
    expect(listQb.andWhere).toHaveBeenCalledWith('product.stock <= :threshold', { threshold: 5 });
    expect(listQb.orderBy).toHaveBeenCalledWith('product.stock', 'ASC');
    expect(listQb.limit).toHaveBeenCalledWith(RESTOCK_LIST_LIMIT);
    expect(result).toEqual({
      threshold: 5,
      totalCount: 40,
      outCount: 2,
      lowCount: 4,
      restockTotal: 6,
      restock: [{ id: 'p1', stock: 0 }],
    });
  });

  it("bo'sh do'kon — nollar", async () => {
    const { repo } = setup(undefined);
    await expect(vendorStockSummary(repo, 'store-1', 0)).resolves.toMatchObject({
      totalCount: 0,
      outCount: 0,
      lowCount: 0,
      restockTotal: 0,
      restock: [],
    });
  });
});
