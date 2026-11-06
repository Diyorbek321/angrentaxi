import { Repository } from 'typeorm';
import { Product } from '../../database/entities/product.entity';

/**
 * Sotuvchi paneli "Kategoriyalar" va "Zaxira" sahifalari uchun xulosalar.
 * Ilgari ikkala sahifa ham do'konning BUTUN katalogini olib, brauzerda
 * sanardi — katalog o'sgani sari sekinlashardi. Endi sanash bazada.
 */

/** "Kam qolgan" ro'yxatida ko'pi bilan shuncha qator (eng kamlari birinchi). */
export const RESTOCK_LIST_LIMIT = 100;

export interface VendorStockSummary {
  threshold: number;
  /** `stock = 0`. */
  outCount: number;
  /** `0 < stock <= threshold`. */
  lowCount: number;
  /** Do'kondagi barcha mahsulotlar. */
  totalCount: number;
  /** `outCount + lowCount` — ro'yxat kesilgan bo'lsa ham to'liq son. */
  restockTotal: number;
  restock: Product[];
}

/** Kategoriya id → mahsulotlar soni. Kategoriyasiz mahsulotlar hisobga olinmaydi. */
export async function countProductsByCategory(
  repo: Repository<Product>,
  storeId: string,
): Promise<Record<string, number>> {
  const rows = await repo
    .createQueryBuilder('product')
    .select('product.categoryId', 'categoryId')
    .addSelect('COUNT(*)', 'count')
    .where('product.storeId = :storeId', { storeId })
    .groupBy('product.categoryId')
    .getRawMany<{ categoryId: string | null; count: string }>();

  return Object.fromEntries(
    rows.filter((row) => row.categoryId !== null).map((row) => [row.categoryId as string, Number(row.count)]),
  );
}

export async function vendorStockSummary(
  repo: Repository<Product>,
  storeId: string,
  threshold: number,
): Promise<VendorStockSummary> {
  const countsQuery = repo
    .createQueryBuilder('product')
    .select('COUNT(*)', 'total')
    .addSelect('COUNT(*) FILTER (WHERE product.stock = 0)', 'out')
    .addSelect('COUNT(*) FILTER (WHERE product.stock > 0 AND product.stock <= :threshold)', 'low')
    .where('product.storeId = :storeId', { storeId })
    .setParameter('threshold', threshold);

  const listQuery = repo
    .createQueryBuilder('product')
    .where('product.storeId = :storeId', { storeId })
    .andWhere('product.stock <= :threshold', { threshold })
    .orderBy('product.stock', 'ASC')
    .addOrderBy('LOWER(product.name)', 'ASC')
    .addOrderBy('product.id', 'ASC')
    .limit(RESTOCK_LIST_LIMIT);

  const [raw, restock] = await Promise.all([
    countsQuery.getRawOne<{ total: string; out: string; low: string }>(),
    listQuery.getMany(),
  ]);

  const outCount = Number(raw?.out ?? 0);
  const lowCount = Number(raw?.low ?? 0);
  const totalCount = Number(raw?.total ?? 0);
  return { threshold, totalCount, outCount, lowCount, restockTotal: outCount + lowCount, restock };
}
