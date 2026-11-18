import { listFiscalReceipts } from './fiscal-receipts.query';
import { FiscalReceiptStatus } from '../../database/entities/fiscal-receipt.entity';

describe('listFiscalReceipts', () => {
  function fakeRepo() {
    const calls: Array<{ sql: string; params?: unknown }> = [];
    const qb = () => {
      const self: Record<string, jest.Mock> = {};
      const chain = (name: string) =>
        (self[name] = jest.fn((sql?: unknown, params?: unknown) => {
          if (name === 'andWhere') calls.push({ sql: sql as string, params });
          return self;
        }));
      ['andWhere', 'orderBy', 'skip', 'take', 'select', 'addSelect', 'groupBy'].forEach(chain);
      self.getManyAndCount = jest.fn(async () => [[{ id: 'r1' }], 1]);
      self.getRawMany = jest.fn(async () => [
        { status: 'failed', count: '2' },
        { status: 'skipped', count: '7' },
      ]);
      return self;
    };
    return { repo: { createQueryBuilder: jest.fn(qb) }, calls };
  }

  it('sahifa, filtrlar va holat bo‘yicha sanoq (yo‘q holat — 0)', async () => {
    const { repo, calls } = fakeRepo();
    const result = await listFiscalReceipts(repo as never, {
      status: FiscalReceiptStatus.FAILED,
      serviceType: 'taxi',
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      items: [{ id: 'r1' }],
      total: 1,
      page: 1,
      limit: 20,
      counts: { pending: 0, sent: 0, failed: 2, skipped: 7 },
    });
    // `status` faqat ro'yxatga qo'llanadi, sanoqqa emas.
    expect(calls.filter((c) => c.sql.includes('r.status'))).toHaveLength(1);
    expect(calls.filter((c) => c.sql.includes('r.service_type'))).toHaveLength(2);
  });
});
