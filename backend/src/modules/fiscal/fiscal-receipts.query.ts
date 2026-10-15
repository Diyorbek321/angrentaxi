import { Repository, SelectQueryBuilder } from 'typeorm';
import { FiscalReceipt, FiscalReceiptStatus } from '../../database/entities/fiscal-receipt.entity';

export interface FiscalReceiptListQuery {
  status?: FiscalReceiptStatus;
  serviceType?: string;
  principalType?: string;
  orderId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export type FiscalStatusCounts = Record<FiscalReceiptStatus, number>;

export interface FiscalReceiptListResult {
  items: FiscalReceipt[];
  total: number;
  page: number;
  limit: number;
  /** Holat bo'yicha sanoq — `status` filtridan TASHQARI, qolgan filtrlar bilan. */
  counts: FiscalStatusCounts;
}

function applyFilters(
  qb: SelectQueryBuilder<FiscalReceipt>,
  query: Omit<FiscalReceiptListQuery, 'page' | 'limit'>,
): SelectQueryBuilder<FiscalReceipt> {
  if (query.serviceType) qb.andWhere('r.service_type = :serviceType', { serviceType: query.serviceType });
  if (query.principalType) qb.andWhere('r.principal_type = :principalType', { principalType: query.principalType });
  if (query.orderId) qb.andWhere('r.order_id = :orderId', { orderId: query.orderId });
  if (query.from) qb.andWhere('r.created_at >= :from', { from: query.from });
  if (query.to) qb.andWhere('r.created_at < :to', { to: query.to });
  return qb;
}

function emptyCounts(): FiscalStatusCounts {
  return Object.fromEntries(
    Object.values(FiscalReceiptStatus).map((status) => [status, 0]),
  ) as FiscalStatusCounts;
}

export async function listFiscalReceipts(
  repo: Repository<FiscalReceipt>,
  query: FiscalReceiptListQuery,
): Promise<FiscalReceiptListResult> {
  const { page, limit, status, ...filters } = query;

  const listQb = applyFilters(repo.createQueryBuilder('r'), filters);
  if (status) listQb.andWhere('r.status = :status', { status });
  const [items, total] = await listQb
    .orderBy('r.created_at', 'DESC')
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  const rawCounts = await applyFilters(repo.createQueryBuilder('r'), filters)
    .select('r.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('r.status')
    .getRawMany<{ status: FiscalReceiptStatus; count: string }>();

  const counts = rawCounts.reduce<FiscalStatusCounts>(
    (acc, row) => ({ ...acc, [row.status]: Number(row.count) }),
    emptyCounts(),
  );

  return { items, total, page, limit, counts };
}
