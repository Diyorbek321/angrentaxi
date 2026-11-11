import { Repository, SelectQueryBuilder } from 'typeorm';
import { Product, ProductStatus } from '../../database/entities/product.entity';
import { likePattern } from '../../common/dto/catalog-moderation-query.dto';
import { VendorProductQueryDto } from './dto/vendor-product-query.dto';

export type ProductStatusCounts = Record<'all' | ProductStatus, number>;

export interface VendorProductPage {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  /** Tab sonlari — qidiruv va kategoriya hisobga olinadi, holat filtri emas. */
  counts: ProductStatusCounts;
}

/** Sotuvdagilar avval, keyin tugagan, keyin yashirin (panel tab tartibi). */
const STATUS_RANK = "CASE product.status WHEN 'active' THEN 0 WHEN 'out' THEN 1 ELSE 2 END";

function scoped(
  repo: Repository<Product>,
  storeId: string,
  query: VendorProductQueryDto,
): SelectQueryBuilder<Product> {
  const qb = repo.createQueryBuilder('product').where('product.storeId = :storeId', { storeId });
  const search = query.search?.trim();
  if (search) {
    qb.andWhere('(product.name ILIKE :q OR product.sku ILIKE :q)', { q: likePattern(search) });
  }
  if (query.categoryId) {
    qb.andWhere('product.categoryId = :categoryId', { categoryId: query.categoryId });
  }
  return qb;
}

/**
 * Sotuvchi katalogi server tomonida sahifalanadi: katalog o'sgani sari
 * hammasini bir so'rovda olib, brauzerda filtrlash sekinlashib borardi.
 * Join yo'q, shuning uchun `skip/take` o'rniga oddiy OFFSET/LIMIT.
 */
export async function browseVendorProducts(
  repo: Repository<Product>,
  storeId: string,
  query: VendorProductQueryDto,
): Promise<VendorProductPage> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const list = scoped(repo, storeId, query);
  if (query.status) {
    list.andWhere('product.status = :status', { status: query.status });
  }
  list
    .orderBy(STATUS_RANK, 'ASC')
    .addOrderBy('LOWER(product.name)', 'ASC')
    // Bir xil nomli mahsulotlar sahifalar orasida takrorlanmasin/yo'qolmasin.
    .addOrderBy('product.id', 'ASC')
    .offset((page - 1) * limit)
    .limit(limit);

  const countsQb = scoped(repo, storeId, query)
    .select('product.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('product.status');

  const [[products, total], raw] = await Promise.all([
    list.getManyAndCount(),
    countsQb.getRawMany<{ status: ProductStatus; count: string }>(),
  ]);

  const counts: ProductStatusCounts = { all: 0, active: 0, out: 0, hidden: 0 };
  for (const row of raw) {
    const n = Number(row.count);
    counts[row.status] = n;
    counts.all += n;
  }
  return { products, total, page, limit, counts };
}
