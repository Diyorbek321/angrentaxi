import { ProductStatus } from '../../database/entities/product.entity';
import { browseVendorProducts } from './vendor-product-browse';

function makeQb(rows: unknown[] = [], total = 0, raw: unknown[] = []) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
    getRawMany: jest.fn().mockResolvedValue(raw),
  };
  return qb;
}

/** Birinchi chaqiruv — ro'yxat, ikkinchisi — tab sonlari. */
function setup(rows: unknown[] = [], total = 0, raw: unknown[] = []) {
  const list = makeQb(rows, total);
  const counts = makeQb([], 0, raw);
  const repo = { createQueryBuilder: jest.fn().mockReturnValueOnce(list).mockReturnValueOnce(counts) };
  return { repo: repo as never, list, counts };
}

describe('browseVendorProducts', () => {
  it("faqat shu do'kon mahsulotlarini, bitta sahifani oladi", async () => {
    const { repo, list } = setup([{ id: 'p1' }], 60);
    const result = await browseVendorProducts(repo, 'store-1', { page: 3, limit: 25 });
    expect(list.where).toHaveBeenCalledWith('product.storeId = :storeId', { storeId: 'store-1' });
    expect(list.offset).toHaveBeenCalledWith(50);
    expect(list.limit).toHaveBeenCalledWith(25);
    expect(result).toMatchObject({ products: [{ id: 'p1' }], total: 60, page: 3, limit: 25 });
  });

  it("standart: 1-sahifa, 20 ta, filtrsiz", async () => {
    const { repo, list } = setup();
    await browseVendorProducts(repo, 'store-1', {});
    expect(list.offset).toHaveBeenCalledWith(0);
    expect(list.limit).toHaveBeenCalledWith(20);
    expect(list.andWhere).not.toHaveBeenCalled();
  });

  it("nom yoki SKU bo'yicha qidiradi, % belgisi ekranlanadi", async () => {
    const { repo, list, counts } = setup();
    await browseVendorProducts(repo, 'store-1', { search: ' 50% ' });
    const clause = ['(product.name ILIKE :q OR product.sku ILIKE :q)', { q: '%50\\%%' }];
    expect(list.andWhere).toHaveBeenCalledWith(...clause);
    expect(counts.andWhere).toHaveBeenCalledWith(...clause);
  });

  it('holat filtri faqat ro‘yxatga qo‘llanadi — tab sonlari hamma holatni ko‘rsatadi', async () => {
    const { repo, list, counts } = setup();
    await browseVendorProducts(repo, 'store-1', { status: ProductStatus.OUT });
    expect(list.andWhere).toHaveBeenCalledWith('product.status = :status', { status: 'out' });
    expect(counts.andWhere).not.toHaveBeenCalledWith('product.status = :status', expect.anything());
  });

  it('kategoriya filtri ro‘yxatga ham, sonlarga ham qo‘llanadi', async () => {
    const { repo, list, counts } = setup();
    await browseVendorProducts(repo, 'store-1', { categoryId: 'cat-1' });
    const clause = ['product.categoryId = :categoryId', { categoryId: 'cat-1' }];
    expect(list.andWhere).toHaveBeenCalledWith(...clause);
    expect(counts.andWhere).toHaveBeenCalledWith(...clause);
  });

  it('tab sonlari: yo‘q holat 0, all — yig‘indi', async () => {
    const { repo } = setup([], 0, [
      { status: 'active', count: '7' },
      { status: 'hidden', count: '2' },
    ]);
    const result = await browseVendorProducts(repo, 'store-1', {});
    expect(result.counts).toEqual({ all: 9, active: 7, out: 0, hidden: 2 });
  });

  it('avval sotuvdagilar, keyin tugagan, keyin yashirin; ichida nom bo‘yicha', async () => {
    const { repo, list } = setup();
    await browseVendorProducts(repo, 'store-1', {});
    expect(list.orderBy).toHaveBeenCalledWith(
      "CASE product.status WHEN 'active' THEN 0 WHEN 'out' THEN 1 ELSE 2 END",
      'ASC',
    );
    expect(list.addOrderBy).toHaveBeenCalledWith('LOWER(product.name)', 'ASC');
    expect(list.addOrderBy).toHaveBeenLastCalledWith('product.id', 'ASC');
  });
});
