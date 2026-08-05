import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity';
import { DriversService } from '../drivers/drivers.service';
import { OrdersStatsService } from './orders-stats.service';

/**
 * Regression coverage for the reports payload's `activeDrivers` field.
 *
 * It used to be assigned `completedOrders` — the number of completed orders in
 * the range, not the number of drivers who worked it. Any driver taking more
 * than one trip inflated the figure, so the admin reports page showed a
 * "drivers" count that could exceed the total driver headcount. It is now a
 * COUNT(DISTINCT driver_id) over completed orders in the range.
 */
describe('OrdersStatsService.getReports — activeDrivers', () => {
  const FROM = '2026-01-01';
  const TO = '2026-01-31';

  // 7 completed orders driven by 3 distinct drivers.
  const COMPLETED_ORDERS = 7;
  const DISTINCT_DRIVERS = 3;
  const TOTAL_DRIVERS = 12;

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
      getCount: jest.fn().mockResolvedValue(9),
      getRawOne: jest.fn().mockResolvedValue({
        revenue: '140000',
        cnt: String(COMPLETED_ORDERS),
      }),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    // The stats service fires several raw queries in one Promise.all; route
    // each to its answer by matching the SQL rather than by call order.
    rawQuery = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('COUNT(DISTINCT o.driver_id)')) {
        return Promise.resolve([{ cnt: DISTINCT_DRIVERS }]);
      }
      if (sql.includes('FROM drivers')) {
        return Promise.resolve([{ cnt: TOTAL_DRIVERS }]);
      }
      if (sql.includes('FROM users')) {
        return Promise.resolve([{ cnt: 4 }]);
      }
      return Promise.resolve([]);
    });

    const orderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      manager: { query: rawQuery },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersStatsService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: DriversService, useValue: {} },
      ],
    }).compile();

    statsService = module.get<OrdersStatsService>(OrdersStatsService);
  });

  it('reports distinct drivers, not the completed-order count', async () => {
    const result = await statsService.getReports(FROM, TO);

    expect(result.stats.activeDrivers).toBe(DISTINCT_DRIVERS);
    expect(result.stats.activeDrivers).not.toBe(COMPLETED_ORDERS);
  });

  it('never reports more active drivers than the total driver headcount', async () => {
    const result = await statsService.getReports(FROM, TO);

    expect(result.stats.activeDrivers).toBeLessThanOrEqual(result.stats.totalDrivers);
  });

  it('counts only completed orders with a driver, within the range', async () => {
    await statsService.getReports(FROM, TO);

    const activeDriversCall = rawQuery.mock.calls.find(([sql]: [string]) =>
      sql.includes('COUNT(DISTINCT o.driver_id)'),
    );

    expect(activeDriversCall).toBeDefined();
    const [sql, params] = activeDriversCall as [string, unknown[]];
    expect(sql).toContain("o.status = 'completed'");
    expect(sql).toContain('o.driver_id IS NOT NULL');
    expect(sql).toContain('o.created_at >= $1');
    expect(sql).toContain('o.created_at <= $2');
    expect(params).toHaveLength(2);
  });
});
