import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Store } from '../../database/entities/store.entity';
import { MarketCategory } from '../../database/entities/market-category.entity';
import { Product } from '../../database/entities/product.entity';
import { StockMovement } from '../../database/entities/stock-movement.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { MatchingService } from '../matching/matching.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { MarketService } from './market.service';

/**
 * getDashboard/getReports used to load the store's entire catalogue and its
 * entire order history (with the `customer` relation joined) purely to compute
 * counters in JS, and listCustomerOrders read a customer's whole history. All
 * three are now bounded. The response shapes must not move — web-market and the
 * Flutter client read these fields by name.
 */
describe('MarketService — bounded vendor queries', () => {
  const STORE_ID = 'store-1';

  let service: MarketService;
  let orderFind: jest.Mock;
  let productFind: jest.Mock;
  let productCount: jest.Mock;
  let orderQb: Record<string, jest.Mock>;
  let productQb: Record<string, jest.Mock>;

  beforeEach(async () => {
    orderFind = jest.fn().mockResolvedValue([]);
    productFind = jest.fn().mockResolvedValue([]);
    productCount = jest.fn().mockResolvedValue(4);

    orderQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ cnt: '3', revenue: '75000' }),
    };
    productQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ stock: '120' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        {
          provide: getRepositoryToken(Store),
          useValue: {
            findOneOrFail: jest.fn().mockResolvedValue({
              id: STORE_ID,
              name: 'Test Do‘kon',
              lowStockThreshold: 5,
            }),
          },
        },
        { provide: getRepositoryToken(MarketCategory), useValue: {} },
        {
          provide: getRepositoryToken(Product),
          useValue: {
            find: productFind,
            count: productCount,
            createQueryBuilder: jest.fn().mockReturnValue(productQb),
          },
        },
        { provide: getRepositoryToken(StockMovement), useValue: {} },
        {
          provide: getRepositoryToken(MarketOrder),
          useValue: { find: orderFind, createQueryBuilder: jest.fn().mockReturnValue(orderQb) },
        },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: RealtimeGateway, useValue: { emitToUser: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: OrdersService, useValue: { findByIdOrThrow: jest.fn() } },
        { provide: MatchingService, useValue: {} },
        { provide: TariffsService, useValue: {} },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
  });

  describe('getDashboard', () => {
    it('keeps every field web-market reads', async () => {
      const result = await service.getDashboard(STORE_ID);

      expect(Object.keys(result).sort()).toEqual(
        [
          'activeProductsCount',
          'bestSellers',
          'hiddenProductsCount',
          'lowStock',
          'lowStockThreshold',
          'outOfStockCount',
          'recentOrders',
          'storeName',
          'todayOrdersCount',
          'todayRevenue',
        ].sort(),
      );
    });

    it('derives today’s counters from a SQL aggregate, not from loaded rows', async () => {
      const result = await service.getDashboard(STORE_ID);

      expect(orderQb.getRawOne).toHaveBeenCalled();
      expect(result.todayOrdersCount).toBe(3);
      expect(result.todayRevenue).toBe(75000);
    });

    it('counts products with COUNT queries instead of loading the catalogue', async () => {
      await service.getDashboard(STORE_ID);

      expect(productCount).toHaveBeenCalledTimes(3);
      // The only product rows materialised are the capped low-stock list.
      expect(productFind).toHaveBeenCalledTimes(1);
      const [options] = productFind.mock.calls[0] as [{ take: number }];
      expect(options.take).toBeGreaterThan(0);
    });

    it('bounds every order read it makes', async () => {
      await service.getDashboard(STORE_ID);

      expect(orderFind).toHaveBeenCalled();
      for (const [options] of orderFind.mock.calls as Array<[{ take?: number }]>) {
        expect(options.take).toBeGreaterThan(0);
      }
    });
  });

  describe('getReports', () => {
    it('keeps every field web-market reads', async () => {
      const result = await service.getReports(STORE_ID);

      expect(Object.keys(result).sort()).toEqual(
        ['bestSellers', 'categoryBreakdown', 'stockTurnover', 'weeklyRevenue'].sort(),
      );
      expect(result.weeklyRevenue).toHaveLength(7);
    });

    it('sums stock on hand in SQL rather than reducing every product row', async () => {
      await service.getReports(STORE_ID);

      expect(productQb.getRawOne).toHaveBeenCalled();
    });

    it('bounds the order read to a rolling window', async () => {
      await service.getReports(STORE_ID);

      const [options] = orderFind.mock.calls[0] as [
        { take?: number; where: { createdAt?: unknown } },
      ];
      expect(options.take).toBeGreaterThan(0);
      expect(options.where.createdAt).toBeDefined();
    });
  });

  describe('listCustomerOrders', () => {
    it('applies a default page size when the caller sends nothing', async () => {
      await service.listCustomerOrders('customer-1');

      const [options] = orderFind.mock.calls[0] as [{ skip: number; take: number }];
      expect(options.skip).toBe(0);
      expect(options.take).toBeGreaterThan(0);
    });

    it('still returns a bare array — the Flutter client decodes a list', async () => {
      const result = await service.listCustomerOrders('customer-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('honours explicit pagination', async () => {
      await service.listCustomerOrders('customer-1', 3, 10);

      const [options] = orderFind.mock.calls[0] as [{ skip: number; take: number }];
      expect(options).toMatchObject({ skip: 20, take: 10 });
    });

    it('clamps an absurd page size instead of trusting it', async () => {
      await service.listCustomerOrders('customer-1', 1, 100000);

      const [options] = orderFind.mock.calls[0] as [{ take: number }];
      expect(options.take).toBeLessThanOrEqual(100);
    });
  });
});
