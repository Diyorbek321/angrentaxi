import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { DriverBonusesService } from '../driver-bonuses/driver-bonuses.service';
import { SettingsService } from '../settings/settings.service';

/**
 * Coverage for OrdersService.getDriverEarningsBreakdown, the new
 * /orders/earnings/breakdown endpoint's data source. It aggregates completed
 * orders into today / last-7-days / last-30-days windows and pairs each with
 * the commission actually charged (persisted as a DEBIT transaction with
 * externalId 'commission' at trip completion — see completeTrip).
 *
 * The repository's createQueryBuilder is faked with an in-memory filter over
 * fixture rows rather than a real query engine, so these tests exercise the
 * service's date-boundary math (today/week/month cutoffs), the
 * gross/commission/net/trips aggregation, and status/driver filtering —
 * exactly the logic that determines what the SQL should return.
 */
describe('OrdersService - getDriverEarningsBreakdown', () => {
  let service: OrdersService;

  const DRIVER_ID = 'driver-1';
  const OTHER_DRIVER_ID = 'driver-2';

  // Frozen "now" so today/week/month boundaries are deterministic.
  const NOW = new Date('2024-06-15T12:00:00.000Z');

  interface FixtureOrder {
    id: string;
    driverId: string;
    status: OrderStatus;
    createdAt: Date;
    finalPrice: number | null;
    estimatedPrice: number;
  }

  interface FixtureTransaction {
    orderId: string;
    userId: string;
    externalId: string | null;
    amount: number;
  }

  let orders: FixtureOrder[];
  let transactions: FixtureTransaction[];

  function daysBeforeNow(days: number): Date {
    const d = new Date(NOW);
    d.setDate(d.getDate() - days);
    return d;
  }

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    orders = [];
    transactions = [];

    // Fake query builder: records the WHERE/andWHERE bind params, then
    // computes getRawOne() by filtering the in-memory fixtures the same way
    // the real SQL would (driver_id, status, created_at >= from).
    interface FakeQueryBuilder {
      leftJoin: jest.Mock;
      select: jest.Mock;
      addSelect: jest.Mock;
      where: jest.Mock;
      andWhere: jest.Mock;
      getRawOne: jest.Mock;
    }

    const createQueryBuilder = jest.fn(() => {
      const state: { driverId?: string; s?: OrderStatus; from?: Date } = {};

      const builder: FakeQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn((_cond: string, params: Record<string, unknown>) => {
          Object.assign(state, params);
          return builder;
        }),
        andWhere: jest.fn((_cond: string, params: Record<string, unknown>) => {
          Object.assign(state, params);
          return builder;
        }),
        getRawOne: jest.fn(async () => {
          const matched = orders.filter(
            (o) =>
              o.driverId === state.driverId &&
              o.status === state.s &&
              state.from !== undefined &&
              o.createdAt.getTime() >= state.from.getTime(),
          );
          const gross = matched.reduce(
            (sum, o) => sum + (o.finalPrice ?? o.estimatedPrice ?? 0),
            0,
          );
          const matchedIds = new Set(matched.map((o) => o.id));
          const commission = transactions
            .filter(
              (t) =>
                matchedIds.has(t.orderId) &&
                t.externalId === 'commission' &&
                t.userId === state.driverId,
            )
            .reduce((sum, t) => sum + t.amount, 0);

          return {
            gross: String(gross),
            commission: String(commission),
            trips: String(matched.length),
          };
        }),
      };

      return builder;
    });

    const orderRepository = { createQueryBuilder };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Trip), useValue: {} },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: TariffsService, useValue: {} },
        {
          provide: RealtimeGateway,
          useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() },
        },
        { provide: NotificationsService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: DriversService, useValue: {} },
        { provide: PromoCodesService, useValue: {} },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('counts a completed order from today in today, week, and month', async () => {
    orders.push({
      id: 'order-today',
      driverId: DRIVER_ID,
      status: OrderStatus.COMPLETED,
      createdAt: NOW,
      finalPrice: 20000,
      estimatedPrice: 18000,
    });
    transactions.push({
      orderId: 'order-today',
      userId: DRIVER_ID,
      externalId: 'commission',
      amount: 2000,
    });

    const result = await service.getDriverEarningsBreakdown(DRIVER_ID);

    expect(result.today).toEqual({ gross: 20000, commission: 2000, net: 18000, trips: 1 });
    expect(result.week).toEqual({ gross: 20000, commission: 2000, net: 18000, trips: 1 });
    expect(result.month).toEqual({ gross: 20000, commission: 2000, net: 18000, trips: 1 });
  });

  it('counts an order from 10 days ago in month but not today or week', async () => {
    orders.push({
      id: 'order-10d',
      driverId: DRIVER_ID,
      status: OrderStatus.COMPLETED,
      createdAt: daysBeforeNow(10),
      finalPrice: 15000,
      estimatedPrice: 15000,
    });
    transactions.push({
      orderId: 'order-10d',
      userId: DRIVER_ID,
      externalId: 'commission',
      amount: 1500,
    });

    const result = await service.getDriverEarningsBreakdown(DRIVER_ID);

    expect(result.today).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
    expect(result.week).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
    expect(result.month).toEqual({ gross: 15000, commission: 1500, net: 13500, trips: 1 });
  });

  it('excludes an order from 40 days ago from today, week, and month', async () => {
    orders.push({
      id: 'order-40d',
      driverId: DRIVER_ID,
      status: OrderStatus.COMPLETED,
      createdAt: daysBeforeNow(40),
      finalPrice: 99999,
      estimatedPrice: 99999,
    });
    transactions.push({
      orderId: 'order-40d',
      userId: DRIVER_ID,
      externalId: 'commission',
      amount: 9999,
    });

    const result = await service.getDriverEarningsBreakdown(DRIVER_ID);

    expect(result.today).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
    expect(result.week).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
    expect(result.month).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
  });

  it('sums commission across multiple trips within a period', async () => {
    orders.push(
      {
        id: 'order-a',
        driverId: DRIVER_ID,
        status: OrderStatus.COMPLETED,
        createdAt: NOW,
        finalPrice: 10000,
        estimatedPrice: 10000,
      },
      {
        id: 'order-b',
        driverId: DRIVER_ID,
        status: OrderStatus.COMPLETED,
        createdAt: daysBeforeNow(2),
        finalPrice: 30000,
        estimatedPrice: 30000,
      },
    );
    transactions.push(
      { orderId: 'order-a', userId: DRIVER_ID, externalId: 'commission', amount: 1000 },
      { orderId: 'order-b', userId: DRIVER_ID, externalId: 'commission', amount: 3000 },
    );

    const result = await service.getDriverEarningsBreakdown(DRIVER_ID);

    expect(result.week).toEqual({ gross: 40000, commission: 4000, net: 36000, trips: 2 });
  });

  it('excludes a non-completed (e.g. cancelled) order even from today', async () => {
    orders.push({
      id: 'order-cancelled',
      driverId: DRIVER_ID,
      status: OrderStatus.CANCELLED,
      createdAt: NOW,
      finalPrice: 25000,
      estimatedPrice: 25000,
    });
    transactions.push({
      orderId: 'order-cancelled',
      userId: DRIVER_ID,
      externalId: 'commission',
      amount: 2500,
    });

    const result = await service.getDriverEarningsBreakdown(DRIVER_ID);

    expect(result.today).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
    expect(result.week).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
    expect(result.month).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
  });

  it("excludes another driver's completed order from today", async () => {
    orders.push({
      id: 'order-other-driver',
      driverId: OTHER_DRIVER_ID,
      status: OrderStatus.COMPLETED,
      createdAt: NOW,
      finalPrice: 50000,
      estimatedPrice: 50000,
    });

    const result = await service.getDriverEarningsBreakdown(DRIVER_ID);

    expect(result.today).toEqual({ gross: 0, commission: 0, net: 0, trips: 0 });
  });
});
