import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
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
 * Regression coverage for the settlement money leak.
 *
 * Trip completion used to write the passenger's non-cash charge as PENDING —
 * i.e. never collected — while unconditionally crediting the driver the full
 * net payout as COMPLETED (spendable) and adding it to `drivers.balance`.
 * Every card and wallet ride therefore paid the driver out of platform funds
 * against a receivable nobody was collecting.
 *
 * WALLET was worse: there was no balance check and no debit at all, so a
 * passenger with an empty wallet could take unlimited rides, each one paying
 * out a driver.
 *
 * The rules now under test:
 *   CASH                     -> charge COMPLETED, driver ledger gets ONLY the
 *                               commission DEBIT (the driver already holds the
 *                               fare — crediting it again paid them twice),
 *                               balance -= commission
 *   WALLET, funds available  -> charge COMPLETED (debited), legs COMPLETED,
 *                               balance += net payout
 *   WALLET, funds short      -> charge PENDING (a debt), legs PENDING,
 *                               balance unchanged
 *   CARD                     -> charge PENDING until the provider callback,
 *                               legs PENDING, balance unchanged
 */
describe('completeTrip — wallet and card settlement', () => {
  const DRIVER_USER_ID = 'driver-user-1';
  const DRIVER_ID = 'driver-1';
  const PASSENGER_ID = 'passenger-1';
  const ORDER_ID = 'order-1';

  const FARE = 20000;
  const COMMISSION_RATE = 10;
  const COMMISSION = 2000;
  const NET_PAYOUT = FARE - COMMISSION;

  let service: OrdersService;
  let managerSave: jest.Mock;
  let adjustBalanceWithin: jest.Mock;
  let emitToUser: jest.Mock;

  /** Ledger rows written inside the settlement transaction. */
  const savedTransactions = (): Array<Record<string, unknown>> =>
    managerSave.mock.calls
      .filter(([entity]) => entity === Transaction)
      .map(([, value]) => value as Record<string, unknown>);

  const chargeRow = () =>
    savedTransactions().find(
      (row) => row['userId'] === PASSENGER_ID && row['type'] === TransactionType.DEBIT,
    );

  const driverCreditRow = () =>
    savedTransactions().find(
      (row) => row['userId'] === DRIVER_USER_ID && row['type'] === TransactionType.CREDIT,
    );

  const driverCommissionRow = () =>
    savedTransactions().find(
      (row) => row['userId'] === DRIVER_USER_ID && row['type'] === TransactionType.DEBIT,
    );

  async function build(options: {
    paymentMethod: PaymentMethod;
    walletBalance?: number;
  }): Promise<void> {
    managerSave = jest
      .fn()
      .mockImplementation((_entity: unknown, value: unknown) => Promise.resolve(value));

    adjustBalanceWithin = jest.fn().mockResolvedValue({
      driverId: DRIVER_ID,
      newBalance: 0,
      wentOffline: false,
    });

    emitToUser = jest.fn();

    // The wallet balance is read through a QueryBuilder aggregate inside the
    // settlement transaction, so the manager-scoped repository has to answer
    // it. `query` covers the advisory lock.
    const txManager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: managerSave,
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawOne: jest
            .fn()
            .mockResolvedValue({ balance: String(options.walletBalance ?? 0) }),
        })),
      }),
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
            transaction: (cb: (m: EntityManager) => Promise<unknown>) => cb(txManager),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            query: jest.fn().mockResolvedValue([{ distance_meters: '3000' }]),
            update: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(5),
          },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: { findOne: jest.fn().mockResolvedValue(null), update: jest.fn() },
        },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository() },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        {
          provide: TariffsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'tariff-1' }),
            calculatePrice: jest.fn().mockReturnValue(FARE),
            // `calculatePrice` endi `calculatePriceBreakdown` ustidagi qobiq —
            // mock ikkalasini bir manbadan beradi, aks holda ular ajralib ketadi.
            calculatePriceBreakdown: jest.fn((_t, km = 0, min = 0, surge = 1) => ({
              baseFare: 0, distanceKm: km, pricePerKm: 0, distanceFare: 0,
              durationMin: min, pricePerMin: 0, timeFare: 0,
              minPriceAdjustment: 0, surgeMultiplier: surge, surgeFare: 0,
              maxPriceCap: 0, total: FARE,
            })),
          },
        },
        {
          provide: RealtimeGateway,
          useValue: { emitToUser, emitToManagers: jest.fn() },
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
              commissionRate: COMMISSION_RATE,
              isOnline: true,
            }),
            adjustBalanceWithin,
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
      passengerId: PASSENGER_ID,
      tariffId: 'tariff-1',
      paymentMethod: options.paymentMethod,
      promoCodeId: null,
    } as unknown as Order);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CASH', () => {
    it('settles immediately and charges the driver only the commission', async () => {
      await build({ paymentMethod: PaymentMethod.CASH });

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(chargeRow()).toMatchObject({ status: TransactionStatus.COMPLETED });
      // The driver already holds the cash, so the platform is owed its cut.
      expect(adjustBalanceWithin).toHaveBeenCalledWith(
        expect.anything(),
        DRIVER_USER_ID,
        -COMMISSION,
      );
    });

    it("haydovchining hamyoniga safar puli TUSHMAYDI — u allaqachon qo'lida", async () => {
      // ⚠️ Aynan tuzatilgan pul yo'qotishi. Ilgari naqd safarda ham to'liq
      // summa CREDIT bo'lib, `chargeStatus` esa naqd uchun COMPLETED edi —
      // ya'ni sof daromad haydovchining YECHIB OLINADIGAN hamyoniga
      // tushardi. Pul esa allaqachon uning cho'ntagida edi.
      //
      // Natijada faqat naqd bilan ishlaydigan haydovchi bir pulni ikki
      // marta olishi mumkin edi: yo'lovchidan naqd, keyin platformadan
      // yechib. Yechish so'rovi aynan shu daftarni tekshiradi.
      await build({ paymentMethod: PaymentMethod.CASH });

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(driverCreditRow()).toBeUndefined();
    });

    it('naqd safarda daftarga FAQAT komissiya qarzi yoziladi', async () => {
      // Bitta hisob modeli: naqd haydovchining qoldig'i minusga ketadi va
      // bu uning platformaga qarzini bildiradi.
      await build({ paymentMethod: PaymentMethod.CASH });

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      const driverRows = savedTransactions().filter(
        (row) => row['userId'] === DRIVER_USER_ID,
      );
      expect(driverRows).toHaveLength(1);
      expect(driverRows[0]).toMatchObject({
        type: TransactionType.DEBIT,
        amount: COMMISSION,
        status: TransactionStatus.COMPLETED,
        externalId: 'commission',
      });
    });
  });

  describe('WALLET with sufficient balance', () => {
    it('collects the fare and releases the driver payout', async () => {
      await build({ paymentMethod: PaymentMethod.WALLET, walletBalance: FARE });

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(chargeRow()).toMatchObject({
        amount: FARE,
        status: TransactionStatus.COMPLETED,
      });
      expect(driverCreditRow()).toMatchObject({ status: TransactionStatus.COMPLETED });
      expect(driverCommissionRow()).toMatchObject({ status: TransactionStatus.COMPLETED });
      expect(adjustBalanceWithin).toHaveBeenCalledWith(
        expect.anything(),
        DRIVER_USER_ID,
        NET_PAYOUT,
      );
    });

    it('settles a balance exactly equal to the fare', async () => {
      await build({ paymentMethod: PaymentMethod.WALLET, walletBalance: FARE });

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(chargeRow()).toMatchObject({ status: TransactionStatus.COMPLETED });
    });
  });

  describe('WALLET with insufficient balance', () => {
    it('records an unpaid charge and pays the driver nothing', async () => {
      await build({ paymentMethod: PaymentMethod.WALLET, walletBalance: 500 });

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(chargeRow()).toMatchObject({
        amount: FARE,
        status: TransactionStatus.PENDING,
      });
      // Both payout legs stay unspendable until the debt is settled.
      expect(driverCreditRow()).toMatchObject({ status: TransactionStatus.PENDING });
      expect(driverCommissionRow()).toMatchObject({ status: TransactionStatus.PENDING });
      expect(adjustBalanceWithin).toHaveBeenCalledWith(expect.anything(), DRIVER_USER_ID, 0);
    });

    it('tells the passenger how much they still owe', async () => {
      await build({ paymentMethod: PaymentMethod.WALLET, walletBalance: 500 });

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(emitToUser).toHaveBeenCalledWith(
        PASSENGER_ID,
        'order:completed',
        expect.objectContaining({ unpaidAmount: FARE - 500 }),
      );
    });
  });

  describe('CARD', () => {
    it('leaves the charge and the payout pending until the provider settles', async () => {
      await build({ paymentMethod: PaymentMethod.CARD });

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(chargeRow()).toMatchObject({ status: TransactionStatus.PENDING });
      expect(driverCreditRow()).toMatchObject({ status: TransactionStatus.PENDING });
      expect(adjustBalanceWithin).toHaveBeenCalledWith(expect.anything(), DRIVER_USER_ID, 0);
    });
  });
});

/**
 * A passenger who owes money from a failed wallet settlement must not be able
 * to keep ordering — otherwise the debt just compounds, ride after ride.
 */
describe('createOrder — outstanding wallet debt', () => {
  async function buildCreation(outstandingDebt: number): Promise<OrdersService> {
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
          useValue: { transaction: jest.fn() },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            query: jest.fn().mockResolvedValue([{ id: 'new-order' }]),
            findOne: jest.fn().mockResolvedValue({
              id: 'new-order',
              passengerId: 'passenger-1',
              status: OrderStatus.CREATED,
            }),
          },
        },
        { provide: getRepositoryToken(Trip), useValue: { find: jest.fn().mockResolvedValue([]),} },
        {
          provide: getRepositoryToken(Transaction),
          useValue: fakeTransactionRepository(outstandingDebt),
        },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        {
          provide: TariffsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'tariff-1', isActive: true }),
            calculatePrice: jest.fn().mockReturnValue(15000),
            // `calculatePrice` endi `calculatePriceBreakdown` ustidagi qobiq —
            // mock ikkalasini bir manbadan beradi, aks holda ular ajralib ketadi.
            calculatePriceBreakdown: jest.fn((_t, km = 0, min = 0, surge = 1) => ({
              baseFare: 0, distanceKm: km, pricePerKm: 0, distanceFare: 0,
              durationMin: min, pricePerMin: 0, timeFare: 0,
              minPriceAdjustment: 0, surgeMultiplier: surge, surgeFare: 0,
              maxPriceCap: 0, total: 15000,
            })),
          },
        },
        { provide: RealtimeGateway, useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() } },
        { provide: NotificationsService, useValue: {} },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: DriversService, useValue: {} },
        { provide: PromoCodesService, useValue: {} },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    return module.get<OrdersService>(OrdersService);
  }

  const dto = {
    tariffId: 'tariff-1',
    pickupLat: 41.2995,
    pickupLng: 69.2401,
    dropoffLat: 41.3495,
    dropoffLng: 69.2801,
  } as never;

  it('refuses a new order while a previous wallet trip is unpaid', async () => {
    const service = await buildCreation(18000);

    await expect(service.create('passenger-1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows ordering once nothing is outstanding', async () => {
    const service = await buildCreation(0);

    await expect(service.create('passenger-1', dto)).resolves.toBeDefined();
  });
});
