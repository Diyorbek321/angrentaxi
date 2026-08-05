import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity';
import { DriversService } from '../drivers/drivers.service';
import { MAX_REPORT_RANGE_DAYS, OrdersStatsService } from './orders-stats.service';

/**
 * getReports takes `from`/`to` straight off the query string. Nothing bounded
 * the range, so a caller asking for a decade made every query in the payload —
 * including a per-day GROUP BY and a three-table top-drivers JOIN — scan the
 * whole orders table. It also accepted unparseable and inverted ranges, which
 * degraded silently to an all-zero report instead of an error.
 */
describe('OrdersStatsService.getReports — range validation', () => {
  let statsService: OrdersStatsService;
  let rawQuery: jest.Mock;

  beforeEach(async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getRawOne: jest.fn().mockResolvedValue({ revenue: '0', cnt: '0' }),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    rawQuery = jest.fn().mockResolvedValue([{ cnt: 0 }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersStatsService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            manager: { query: rawQuery },
          },
        },
        { provide: DriversService, useValue: {} },
      ],
    }).compile();

    statsService = module.get<OrdersStatsService>(OrdersStatsService);
  });

  it('accepts a range at the maximum width', async () => {
    const from = new Date();
    from.setDate(from.getDate() - (MAX_REPORT_RANGE_DAYS - 1));

    await expect(
      statsService.getReports(from.toISOString(), new Date().toISOString()),
    ).resolves.toBeDefined();
  });

  it('rejects a range wider than the maximum instead of scanning the table', async () => {
    const from = new Date();
    from.setDate(from.getDate() - (MAX_REPORT_RANGE_DAYS + 30));

    await expect(
      statsService.getReports(from.toISOString(), new Date().toISOString()),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The point of the guard: no query is issued at all for an over-wide range.
    expect(rawQuery).not.toHaveBeenCalled();
  });

  it('names the limit in the error so the caller can narrow the request', async () => {
    await expect(statsService.getReports('2000-01-01', '2026-01-01')).rejects.toThrow(
      new RegExp(String(MAX_REPORT_RANGE_DAYS)),
    );
  });

  it('rejects an unparseable date rather than reporting all zeros', async () => {
    await expect(statsService.getReports('not-a-date', '2026-01-31')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rawQuery).not.toHaveBeenCalled();
  });

  it('rejects an inverted range', async () => {
    await expect(statsService.getReports('2026-01-31', '2026-01-01')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('still keeps the top-drivers query capped', async () => {
    await statsService.getReports('2026-01-01', '2026-01-31');

    const topDriversCall = rawQuery.mock.calls.find(([sql]: [string]) =>
      sql.includes('ORDER BY total_revenue DESC'),
    );

    expect(topDriversCall).toBeDefined();
    expect((topDriversCall as [string])[0]).toMatch(/LIMIT\s+10/);
  });
});
