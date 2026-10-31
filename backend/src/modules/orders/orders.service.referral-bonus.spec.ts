import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { SurgeService } from '../surge/surge.service';
import { OsrmService } from '../routing/osrm.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import { fakeDataSourceProvider, fakeCitiesServiceProvider } from './orders.testing';
import { OrdersQueryService } from './orders-query.service';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';
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
 * Coverage for the referral-bonus block appended to OrdersService.completeTrip:
 * a referred passenger's first completed trip credits both the passenger and
 * their referrer a fixed CREDIT transaction (externalId
 * `referral_bonus_{passenger|referrer}_{orderId}`), subsequent trips don't
 * re-credit, passengers with no referrer get nothing, and — critically — a
 * failure while crediting must never surface as a completeTrip failure.
 *
 * findByIdOrThrow is stubbed directly (it does its own enrichment queries
 * unrelated to this feature) so these tests exercise only completeTrip's own
 * logic against a fixed IN_PROGRESS order.
 */
describe('OrdersService - completeTrip referral bonus', () => {
  let service: OrdersService;
  // findByIdOrThrow now lives on OrdersQueryService, which the facade and the
  // write-side services both delegate to — so that is where it gets stubbed.
  let queryService: OrdersQueryService;

  const ORDER_ID = 'order-1';
  const DRIVER_ID = 'driver-1';
  const PASSENGER_ID = 'passenger-1';
  const REFERRER_ID = 'referrer-1';

  let transactionSaveMock: jest.Mock;
  let orderCountMock: jest.Mock;
  let usersServiceFindById: jest.Mock;
  let baseOrder: Order;

  beforeEach(async () => {
    baseOrder = {
      id: ORDER_ID,
      status: OrderStatus.IN_PROGRESS,
      driverId: DRIVER_ID,
      passengerId: PASSENGER_ID,
      paymentMethod: PaymentMethod.CASH,
      promoCodeId: null,
      tariffId: 'tariff-1',
    } as Order;

    transactionSaveMock = jest.fn().mockResolvedValue({});
    orderCountMock = jest.fn().mockResolvedValue(1);
    usersServiceFindById = jest.fn().mockResolvedValue({
      id: PASSENGER_ID,
      referredByUserId: REFERRER_ID,
    });

    const orderRepository = {
      query: jest.fn().mockResolvedValue([{ distance_meters: '0' }]),
      update: jest.fn().mockResolvedValue({}),
      count: orderCountMock,
    };
    const tripRepository = { findOne: jest.fn().mockResolvedValue(null), update: jest.fn() };
    const transactionRepository = { save: transactionSaveMock };
    const tariffsService = {
      findById: jest.fn().mockResolvedValue({ id: 'tariff-1' }),
      calculatePrice: jest.fn().mockReturnValue(10000),
      // `calculatePrice` endi `calculatePriceBreakdown` ustidagi qobiq —
      // mock ikkalasini bir manbadan beradi, aks holda ular ajralib ketadi.
      calculatePriceBreakdown: jest.fn((_t: unknown, km = 0, min = 0, surge = 1) => ({
        baseFare: 0, distanceKm: km, pricePerKm: 0, distanceFare: 0,
        durationMin: min, pricePerMin: 0, timeFare: 0,
        minPriceAdjustment: 0, surgeMultiplier: surge, surgeFare: 0,
        maxPriceCap: 0, total: 10000,
      })),
    };
    const realtimeGateway = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
    const notificationsService = { notifyTripCompleted: jest.fn().mockResolvedValue(undefined) };
    const usersService = { findById: usersServiceFindById };
    const driversService = {
      findByUserId: jest.fn().mockResolvedValue(null),
      adjustBalance: jest.fn(),
    };
    const promoCodesService = {};
    const driverBonusesService = { evaluateForDriver: jest.fn() };
    const settingsService = { getDefaultCommissionRate: jest.fn().mockResolvedValue(20) };

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
        fakeDataSourceProvider(),
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Trip), useValue: tripRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: TariffsService, useValue: tariffsService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
        { provide: DriversService, useValue: driversService },
        { provide: PromoCodesService, useValue: promoCodesService },
        { provide: DriverBonusesService, useValue: driverBonusesService },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    queryService = module.get<OrdersQueryService>(OrdersQueryService);
    jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(baseOrder);
  });

  it('credits both the passenger and referrer on the first completed order', async () => {
    orderCountMock.mockResolvedValue(1);

    await service.completeTrip(DRIVER_ID, ORDER_ID);

    expect(transactionSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: PASSENGER_ID,
        type: TransactionType.CREDIT,
        externalId: `referral_bonus_passenger_${ORDER_ID}`,
      }),
    );
    expect(transactionSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: REFERRER_ID,
        type: TransactionType.CREDIT,
        externalId: `referral_bonus_referrer_${ORDER_ID}`,
      }),
    );
  });

  it('does not credit again on a second completed order', async () => {
    orderCountMock.mockResolvedValue(2);

    await service.completeTrip(DRIVER_ID, ORDER_ID);

    const referralCalls = transactionSaveMock.mock.calls.filter(([arg]) =>
      (arg as { externalId?: string }).externalId?.startsWith('referral_bonus_'),
    );
    expect(referralCalls).toHaveLength(0);
  });

  it('does not credit a passenger with no referrer', async () => {
    usersServiceFindById.mockResolvedValue({ id: PASSENGER_ID, referredByUserId: null });
    orderCountMock.mockResolvedValue(1);

    await service.completeTrip(DRIVER_ID, ORDER_ID);

    const referralCalls = transactionSaveMock.mock.calls.filter(([arg]) =>
      (arg as { externalId?: string }).externalId?.startsWith('referral_bonus_'),
    );
    expect(referralCalls).toHaveLength(0);
  });

  it('still completes the trip if bonus crediting throws', async () => {
    orderCountMock.mockResolvedValue(1);
    transactionSaveMock.mockImplementation((arg: { externalId?: string | null }) => {
      if (arg.externalId?.startsWith('referral_bonus_')) {
        throw new Error('boom');
      }
      return Promise.resolve({});
    });

    await expect(service.completeTrip(DRIVER_ID, ORDER_ID)).resolves.toEqual(baseOrder);
  });
});
