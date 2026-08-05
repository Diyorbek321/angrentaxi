import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Restaurant, RestaurantStatus } from '../../database/entities/restaurant.entity';
import { MenuCategory } from '../../database/entities/menu-category.entity';
import { Dish } from '../../database/entities/dish.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { MatchingService } from '../matching/matching.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { FoodService } from './food.service';

/**
 * getDashboard loaded every order the restaurant had ever taken to compute a
 * few counters; getReports applied its `since` cut-off in JS *after* the same
 * full read; listCustomerOrders read a customer's whole history. All three are
 * now bounded, with the response shapes unchanged — web-restaurant and the
 * Flutter client read these fields by name.
 */
describe('FoodService — bounded vendor queries', () => {
  const RESTAURANT_ID = 'restaurant-1';

  let service: FoodService;
  let orderFind: jest.Mock;
  let dishCount: jest.Mock;
  let getRawOne: jest.Mock;

  beforeEach(async () => {
    orderFind = jest.fn().mockResolvedValue([]);
    dishCount = jest.fn().mockResolvedValue(12);
    getRawOne = jest
      .fn()
      .mockResolvedValueOnce({ cnt: '5', revenue: '90000' })
      .mockResolvedValueOnce({ avg_minutes: '23.4' });

    const orderQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodService,
        {
          provide: getRepositoryToken(Restaurant),
          useValue: {
            findOneOrFail: jest.fn().mockResolvedValue({
              id: RESTAURANT_ID,
              name: 'Test Oshxona',
              status: RestaurantStatus.ACTIVE,
              commissionRate: 15,
            }),
          },
        },
        { provide: getRepositoryToken(MenuCategory), useValue: {} },
        { provide: getRepositoryToken(Dish), useValue: { count: dishCount, find: jest.fn() } },
        {
          provide: getRepositoryToken(FoodOrder),
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

    service = module.get<FoodService>(FoodService);
  });

  describe('getDashboard', () => {
    it('keeps every field web-restaurant reads', async () => {
      const result = await service.getDashboard(RESTAURANT_ID);

      expect(Object.keys(result).sort()).toEqual(
        [
          'activeDishesCount',
          'avgPrepMinutes',
          'isOpen',
          'recentOrders',
          'restaurantName',
          'todayOrdersCount',
          'todayRevenue',
        ].sort(),
      );
    });

    it('derives the counters from SQL aggregates', async () => {
      const result = await service.getDashboard(RESTAURANT_ID);

      expect(result.todayOrdersCount).toBe(5);
      expect(result.todayRevenue).toBe(90000);
      // AVG over the prep window, rounded exactly as before.
      expect(result.avgPrepMinutes).toBe(23);
      expect(result.activeDishesCount).toBe(12);
      expect(dishCount).toHaveBeenCalledTimes(1);
    });

    it('materialises only the recent-orders strip', async () => {
      await service.getDashboard(RESTAURANT_ID);

      expect(orderFind).toHaveBeenCalledTimes(1);
      const [options] = orderFind.mock.calls[0] as [{ take: number }];
      expect(options.take).toBe(6);
    });
  });

  describe('getReports', () => {
    it('keeps every field web-restaurant reads', async () => {
      const result = await service.getReports(RESTAURANT_ID, 7);

      expect(Object.keys(result).sort()).toEqual(
        ['hourly', 'payout', 'revenue', 'topDishes'].sort(),
      );
      expect(result.revenue).toHaveLength(7);
      expect(result.hourly).toHaveLength(24);
    });

    it('pushes the range and the cancelled-order exclusion into the query', async () => {
      await service.getReports(RESTAURANT_ID, 7);

      const [options] = orderFind.mock.calls[0] as [
        { take?: number; where: { createdAt?: unknown; status?: unknown } },
      ];
      expect(options.where.createdAt).toBeDefined();
      expect(options.where.status).toBeDefined();
      expect(options.take).toBeGreaterThan(0);
    });

    it('honours the 30-day range the controller can select', async () => {
      const result = await service.getReports(RESTAURANT_ID, 30);

      expect(result.revenue).toHaveLength(30);
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

    it('honours explicit pagination and clamps an absurd page size', async () => {
      await service.listCustomerOrders('customer-1', 2, 10);
      expect(orderFind.mock.calls[0][0]).toMatchObject({ skip: 10, take: 10 });

      await service.listCustomerOrders('customer-1', 1, 100000);
      expect((orderFind.mock.calls[1][0] as { take: number }).take).toBeLessThanOrEqual(100);
    });
  });
});
