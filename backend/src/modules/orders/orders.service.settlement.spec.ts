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
 * Trip settlement used to be five independent writes — order status, the
 * passenger charge, the driver's gross CREDIT, the commission DEBIT and the
 * wallet adjustment. A failure partway through left a trip marked COMPLETED
 * with only some of its ledger rows behind it, or a wallet balance with
 * nothing justifying it. They now run inside one transaction.
 *
 * Redis is deliberately NOT in that transaction (it cannot be rolled back), so
 * dropping a driver from the online set has to happen only once the negative
 * balance is durable.
 */
describe('completeTrip settlement atomicity', () => {
  const DRIVER_USER_ID = 'driver-user-1';
  const DRIVER_ID = 'driver-1';
  const PASSENGER_ID = 'passenger-1';
  const ORDER_ID = 'order-1';

  let service: OrdersService;
  let queryService: OrdersQueryService;
  let managerUpdate: jest.Mock;
  let managerSave: jest.Mock;
  let repoUpdate: jest.Mock;
  let repoSave: jest.Mock;
  let adjustBalanceWithin: jest.Mock;
  let takeOfflineInRedis: jest.Mock;
  let transactionSpy: jest.Mock;
  let txManager: EntityManager;

  async function build(options: {
    wentOffline?: boolean;
    failInsideTransaction?: boolean;
  } = {}) {
    managerUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    managerSave = jest.fn().mockImplementation((_entity: unknown, value: unknown) => {
      if (options.failInsideTransaction) {
        return Promise.reject(new Error('ledger write failed'));
      }
      return Promise.resolve(value);
    });
    repoUpdate = jest.fn().mockResolvedValue({});
    repoSave = jest.fn().mockResolvedValue({});

    adjustBalanceWithin = jest.fn().mockResolvedValue({
      driverId: DRIVER_ID,
      newBalance: options.wentOffline ? -5000 : 10000,
      wentOffline: options.wentOffline ?? false,
    });
    takeOfflineInRedis = jest.fn().mockResolvedValue(undefined);

    txManager = {
      update: managerUpdate,
      save: managerSave,
    } as unknown as EntityManager;

    transactionSpy = jest
      .fn()
      .mockImplementation((cb: (m: EntityManager) => Promise<unknown>) => cb(txManager));

    const orderRepository = {
      query: jest.fn().mockResolvedValue([{ distance_meters: '3000' }]),
      update: repoUpdate,
      count: jest.fn().mockResolvedValue(5),
    };

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
        { provide: DataSource, useValue: { transaction: transactionSpy } },
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        {
          provide: getRepositoryToken(Trip),
          useValue: { findOne: jest.fn().mockResolvedValue(null), update: jest.fn() },
        },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository(0, { save: repoSave }) },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        {
          provide: TariffsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'tariff-1' }),
            calculatePrice: jest.fn().mockReturnValue(20000),
            // `calculatePrice` endi `calculatePriceBreakdown` ustidagi qobiq —
            // mock ikkalasini bir manbadan beradi, aks holda ular ajralib ketadi.
            calculatePriceBreakdown: jest.fn((_t, km = 0, min = 0, surge = 1) => ({
              baseFare: 0, distanceKm: km, pricePerKm: 0, distanceFare: 0,
              durationMin: min, pricePerMin: 0, timeFare: 0,
              minPriceAdjustment: 0, surgeMultiplier: surge, surgeFare: 0,
              maxPriceCap: 0, total: 20000,
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
            findById: jest.fn().mockResolvedValue({ id: PASSENGER_ID, referredByUserId: null }),
          },
        },
        {
          provide: DriversService,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue({
              id: DRIVER_ID,
              userId: DRIVER_USER_ID,
              commissionRate: 10,
              isOnline: true,
            }),
            adjustBalanceWithin,
            takeOfflineInRedis,
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
    queryService = module.get<OrdersQueryService>(OrdersQueryService);
    jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue({
      id: ORDER_ID,
      status: OrderStatus.IN_PROGRESS,
      driverId: DRIVER_USER_ID,
      passengerId: PASSENGER_ID,
      tariffId: 'tariff-1',
      paymentMethod: PaymentMethod.CASH,
      promoCodeId: null,
    } as unknown as Order);
  }

  it('writes the order status and every ledger row inside one transaction', async () => {
    await build();

    await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

    expect(transactionSpy).toHaveBeenCalledTimes(1);

    // Order status update went through the transaction manager...
    expect(managerUpdate).toHaveBeenCalledWith(
      Order,
      ORDER_ID,
      expect.objectContaining({ status: OrderStatus.COMPLETED }),
    );
    // ...and so did the ledger rows: the passenger charge plus the driver's
    // commission debit.
    //
    // NAQD safar uchun IKKITA qator, uchta emas: haydovchiga safar puli
    // CREDIT qilinmaydi, chunki u pulni yo'lovchidan qo'liga olgan. Uchinchi
    // qator yozilishi aynan haydovchiga ikki marta to'lash edi
    // (`orders.service.wallet-settlement.spec.ts` dagi CASH testlariga
    // qarang).
    expect(managerSave).toHaveBeenCalledTimes(2);

    // Nothing settlement-related escaped to the non-transactional repositories.
    expect(repoUpdate).not.toHaveBeenCalled();
    expect(repoSave).not.toHaveBeenCalled();
  });

  it('adjusts the wallet through the same transaction manager', async () => {
    await build();

    await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

    expect(adjustBalanceWithin).toHaveBeenCalledTimes(1);
    const [managerArg, userIdArg, deltaArg] = adjustBalanceWithin.mock.calls[0] as [
      EntityManager,
      string,
      number,
    ];

    // The wallet must move on the *same* manager the ledger rows were written
    // with — a different one would mean a separate, independently committing
    // connection, which is the bug this whole change exists to prevent.
    expect(managerArg).toBe(txManager);
    expect(userIdArg).toBe(DRIVER_USER_ID);

    // CASH trip: the driver already took the fare, so only the platform's
    // commission (10% of 20000, per the driver's own override rate) is debited.
    expect(deltaArg).toBe(-2000);
  });

  it('drops the driver from the online set only after the transaction commits', async () => {
    await build({ wentOffline: true });

    await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

    expect(takeOfflineInRedis).toHaveBeenCalledWith(DRIVER_ID, expect.any(String));
    // The Redis call must come after the transaction, never inside it.
    expect(transactionSpy.mock.invocationCallOrder[0]).toBeLessThan(
      takeOfflineInRedis.mock.invocationCallOrder[0],
    );
  });

  it('leaves the online set untouched when the balance stayed positive', async () => {
    await build({ wentOffline: false });

    await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

    expect(takeOfflineInRedis).not.toHaveBeenCalled();
  });

  it('propagates a settlement failure and never touches Redis', async () => {
    await build({ wentOffline: true, failInsideTransaction: true });

    await expect(service.completeTrip(DRIVER_USER_ID, ORDER_ID)).rejects.toThrow(
      'ledger write failed',
    );

    // A rolled-back settlement must not have taken the driver offline.
    expect(takeOfflineInRedis).not.toHaveBeenCalled();
  });
});
