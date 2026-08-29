import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
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
import { OrdersService } from './orders.service';
import { OrdersQueryService } from './orders-query.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { SurgeService } from '../surge/surge.service';
import { OsrmService } from '../routing/osrm.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import { fakeTransactionRepository, fakeCitiesServiceProvider } from './orders.testing';

/**
 * completeTrip derived the billed distance with
 * `parseFloat(rows[0]?.distance_meters || '0')`.
 *
 * pg returns ST_Distance as a JS number, so a genuine 0-metre result is falsy
 * and took the same `|| '0'` branch as "no row at all" / "NULL geometry". The
 * two cases are now told apart explicitly — the same `!= null` treatment the
 * driverArrived geofence check already got — so a missing distance is logged
 * rather than silently priced as a zero-distance trip.
 */
describe('completeTrip — PostGIS distance falsy-zero handling', () => {
  const DRIVER_USER_ID = 'driver-user-1';
  const ORDER_ID = 'order-1';

  let service: OrdersService;
  let calculatePrice: jest.Mock;
  let tripUpdate: jest.Mock;
  let warn: jest.SpyInstance;

  async function build(distanceRows: unknown[]) {
    calculatePrice = jest.fn().mockReturnValue(20000);
    tripUpdate = jest.fn().mockResolvedValue({});

    const txManager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation((_e: unknown, v: unknown) => Promise.resolve(v)),
    } as unknown as EntityManager;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...ORDERS_PROVIDERS,
        fakeCitiesServiceProvider(),
        // Routing is an accuracy layer over pricing; these tests assert the
        // straight-line behaviour, which is also the shipped default.
        { provide: OsrmService, useValue: { routeDistanceMeters: jest.fn() } },
        { provide: RoutedDistancePricing, useValue: { enabled: false } },
        // Surge is a pricing input, not a dependency of these flows: a quiet
        // zone (1.0x) keeps the expected prices in these tests unchanged.
        {
          provide: SurgeService,
          useValue: {
            snapshotFor: jest.fn().mockResolvedValue({
              multiplier: 1.0,
              demand: 0,
              supply: 0,
              zone: 'test-zone',
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest
              .fn()
              .mockImplementation((cb: (m: EntityManager) => Promise<unknown>) => cb(txManager)),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            query: jest.fn().mockResolvedValue(distanceRows),
            update: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(5),
          },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: {
            // `attachDisplayFields` endi safarlarni paketli o'qiydi.
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'trip-1', startTime: new Date() }),
            update: tripUpdate,
          },
        },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository(0, { save: jest.fn() }) },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        {
          provide: TariffsService,
          useValue: { findById: jest.fn().mockResolvedValue({ id: 'tariff-1' }), calculatePrice,
            // `calculatePrice` endi shu metodning ustidagi qobiq — mock ham
            // ikkalasini bir manbadan beradi, aks holda ular ajralib ketadi.
            // Argumentlar AYNAN qanday kelgan bo'lsa shunday uzatiladi:
            // ishlab chiqarish kodi 3 ta argument bilan chaqiradi, va
            // testlar `calculatePrice` aynan 3 ta bilan chaqirilganini
            // tekshiradi. Bu yerda 4-chi `undefined` qo'shilsa, tekshiruv
            // yiqiladi — mock haqiqatni buzgan bo'lardi.
            calculatePriceBreakdown: jest.fn((...args: unknown[]) => ({
              baseFare: 0,
              distanceKm: args[1] as number,
              pricePerKm: 0,
              distanceFare: 0,
              durationMin: args[2] as number,
              pricePerMin: 0,
              timeFare: 0,
              minPriceAdjustment: 0,
              surgeMultiplier: (args[3] as number) ?? 1,
              surgeFare: 0,
              maxPriceCap: 0,
              total: (calculatePrice as (...a: unknown[]) => number)(...args),
            })),
          },
        },
        {
          provide: RealtimeGateway,
          useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { notifyTripCompleted: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'passenger-1', referredByUserId: null }),
          },
        },
        {
          provide: DriversService,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue({
              id: 'driver-1',
              userId: DRIVER_USER_ID,
              commissionRate: 10,
              isOnline: true,
            }),
            adjustBalanceWithin: jest
              .fn()
              .mockResolvedValue({ driverId: 'driver-1', newBalance: 1, wentOffline: false }),
            takeOfflineInRedis: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: PromoCodesService, useValue: {} },
        {
          provide: DriverBonusesService,
          useValue: { evaluateForDriver: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SettingsService,
          useValue: { getDefaultCommissionRate: jest.fn().mockResolvedValue(20) },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    const queryService = module.get<OrdersQueryService>(OrdersQueryService);
    jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue({
      id: ORDER_ID,
      status: OrderStatus.IN_PROGRESS,
      driverId: DRIVER_USER_ID,
      passengerId: 'passenger-1',
      tariffId: 'tariff-1',
      paymentMethod: PaymentMethod.CASH,
      promoCodeId: null,
    } as unknown as Order);
  }

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('treats a genuine 0-metre distance as a real measurement, not a missing one', async () => {
    await build([{ distance_meters: 0 }]);

    await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

    expect(calculatePrice).toHaveBeenCalledWith({ id: 'tariff-1' }, 0, expect.any(Number));
    expect(tripUpdate).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ actualDistanceKm: 0 }),
    );
    // A real zero is not an anomaly — nothing to warn about.
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('No PostGIS distance'));
  });

  it('flags a missing row instead of silently pricing it as a 0 km trip', async () => {
    await build([]);

    await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No PostGIS distance'));
  });

  it('flags a NULL geometry the same way', async () => {
    await build([{ distance_meters: null }]);

    await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No PostGIS distance'));
  });

  it('still converts a normal metre reading to kilometres', async () => {
    await build([{ distance_meters: '3000' }]);

    await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

    expect(calculatePrice).toHaveBeenCalledWith({ id: 'tariff-1' }, 3, expect.any(Number));
  });
});
