import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { SurgeService } from '../surge/surge.service';
import { OsrmService } from '../routing/osrm.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import { fakeDataSourceProvider, fakeTransactionRepository, fakeCitiesServiceProvider } from './orders.testing';
import { OrdersQueryService } from './orders-query.service';
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
import { UserRole } from '../../database/entities/user.entity';

/**
 * Regression coverage for the TOCTOU race in the order state-transition
 * methods: acceptOrder, driverArrived, startTrip, reassignDriver, and
 * cancelOrder used to read the current status, validate it in application
 * code, then call `orderRepository.update(orderId, {...})` unconditionally
 * — no WHERE clause guarding the expected prior status, no row lock. Two
 * concurrent requests (e.g. two drivers accepting the same order) could
 * both pass the status check before either write landed, and the second
 * write would silently clobber the first.
 *
 * The fix routes every transition through `updateOrderStatusAtomic`, which
 * issues `UPDATE orders SET ... WHERE id = :id AND status IN (:expected)`
 * via QueryBuilder and throws ConflictException when the affected row count
 * is 0 (i.e. some other request already moved the order out of the expected
 * status). These tests simulate that race by mocking the QueryBuilder's
 * `execute()` to resolve `{ affected: 0 }`, exactly as would happen for the
 * loser of a concurrent race.
 */
describe('OrdersService - atomic status transitions (TOCTOU race guard)', () => {
  let service: OrdersService;
  // findByIdOrThrow now lives on OrdersQueryService, which the facade and the
  // write-side services both delegate to — so that is where it gets stubbed.
  let queryService: OrdersQueryService;

  let queryBuilderMock: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    setParameters: jest.Mock;
    execute: jest.Mock;
  };
  let orderRepository: {
    findOne: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
  };
  let driversService: { findByUserId: jest.Mock; findByIdOrThrow: jest.Mock };
  let dispatchOverrideRepository: {
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };

  const baseOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'order-1',
      passengerId: 'passenger-1',
      driverId: null,
      status: OrderStatus.SEARCHING,
      tariffId: 'tariff-1',
      ...overrides,
    }) as Order;

  beforeEach(async () => {
    queryBuilderMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      // `driverArrived` `arrived_at` ni xom SQL bilan yozadi
      // (`COALESCE("arrived_at", :arrivedAt)`) va bog'lanuvchi qiymatni
      // `setParameters` orqali uzatadi. Mockda bu metod bo'lmasa chaqiruv
      // `TypeError` bilan yiqiladi va test kutilgan `ConflictException` ni
      // umuman ko'rmaydi — ya'ni TOCTOU qo'riqchisi tekshirilmay qolardi.
      setParameters: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    orderRepository = {
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue([{ distance_meters: 10 }]),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      update: jest.fn(),
    };

    driversService = {
      findByUserId: jest.fn(),
      findByIdOrThrow: jest.fn(),
    };

    // reassignDriver commits the status update and its audit row in one
    // transaction, so the mock hands the callback an EntityManager that routes
    // back to the same queryBuilder/save mocks the assertions below inspect.
    const transactionalManager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      save: jest.fn((_entity: unknown, data: unknown) =>
        dispatchOverrideRepository.save(data),
      ),
    };

    dispatchOverrideRepository = {
      save: jest.fn(),
      manager: {
        transaction: jest.fn(
          async (cb: (m: typeof transactionalManager) => Promise<unknown>) =>
            cb(transactionalManager),
        ),
      },
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
        fakeDataSourceProvider(),
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        {
          provide: getRepositoryToken(Trip),
          useValue: { save: jest.fn(), findOne: jest.fn(), update: jest.fn() },
        },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository(0, { save: jest.fn() }) },
        { provide: getRepositoryToken(DispatchOverride), useValue: dispatchOverrideRepository },
        {
          provide: TariffsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'tariff-1' }),
            calculatePrice: jest.fn().mockReturnValue(0),
            calculatePriceBreakdown: jest.fn().mockReturnValue({
              baseFare: 0, distanceKm: 0, pricePerKm: 0, distanceFare: 0,
              durationMin: 0, pricePerMin: 0, timeFare: 0,
              minPriceAdjustment: 0, surgeMultiplier: 1, surgeFare: 0,
              maxPriceCap: 0, total: 0,
            }),
          },
        },
        {
          provide: RealtimeGateway,
          useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() },
        },
        { provide: NotificationsService, useValue: {} },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: DriversService, useValue: driversService },
        { provide: PromoCodesService, useValue: {} },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);
    queryService = module.get(OrdersQueryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('acceptOrder', () => {
    it('rejects the loser of a concurrent accept race with ConflictException', async () => {
      const order = baseOrder({ status: OrderStatus.SEARCHING, driverId: null });
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);

      // Driver A's conditional update wins the race (1 row affected).
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 1, raw: [] });
      await expect(service.acceptOrder('driver-a', 'order-1')).resolves.toBeDefined();

      // Driver B's concurrent conditional update finds the row no longer in
      // SEARCHING status (Driver A already flipped it to ACCEPTED) -> 0 rows.
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 0, raw: [] });
      await expect(service.acceptOrder('driver-b', 'order-1')).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'status IN (:...expectedStatuses)',
        { expectedStatuses: [OrderStatus.SEARCHING] },
      );
    });
  });

  describe('driverArrived', () => {
    it('throws ConflictException when the conditional update affects 0 rows', async () => {
      const order = baseOrder({ status: OrderStatus.ACCEPTED, driverId: 'driver-1' });
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 0, raw: [] });

      await expect(service.driverArrived('driver-1', 'order-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'status IN (:...expectedStatuses)',
        { expectedStatuses: [OrderStatus.ACCEPTED] },
      );
    });

    /**
     * ⚠️ KUTISH HISOBINI HIMOYA QILADI.
     *
     * `arrived_at` — pul undiriladigan maydon: kutish haqi shu lahzadan
     * safar boshlanishigacha hisoblanadi. Agar u har "Yetib keldim"
     * bosilganda qayta yozilsa, haydovchi tugmani ikkinchi marta bosib
     * kutish hisobini NOLGA tushira olardi va yo'lovchi qancha kutdirgani
     * ahamiyatsiz bo'lib qolardi.
     *
     * Shuning uchun yozuv `COALESCE("arrived_at", :arrivedAt)` — qiymat
     * FAQAT ustun bo'sh bo'lganda tushadi. Qoida shu darajada muhimki, u
     * status qo'riqchisiga tayanmaydi: SQL ning o'zi idempotentlikni
     * kafolatlaydi.
     */
    it('arrivedAt IDEMPOTENT — COALESCE bilan yoziladi, qayta yozilmaydi', async () => {
      const order = baseOrder({ status: OrderStatus.ACCEPTED, driverId: 'driver-1' });
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 1, raw: [] });

      await service.driverArrived('driver-1', 'order-1');

      const [updateData] = queryBuilderMock.set.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(updateData.status).toBe(OrderStatus.ARRIVED);

      // Xom SQL ifodasi: mavjud qiymat bo'lsa u SAQLANADI.
      expect(typeof updateData.arrivedAt).toBe('function');
      expect((updateData.arrivedAt as () => string)()).toBe(
        'COALESCE("arrived_at", :arrivedAt)',
      );

      // Vaqt parametr sifatida BOG'LANADI (SQL ichiga qo'yilmaydi), ya'ni
      // pg drayveri uni `trips.start_time` bilan bir xil serializatsiya
      // qiladi — kutish daqiqalari aynan shu ikki vaqt AYIRMASI.
      const [parameters] = queryBuilderMock.setParameters.mock.calls[0] as [
        { arrivedAt: Date },
      ];
      expect(parameters.arrivedAt).toBeInstanceOf(Date);
    });
  });

  describe('startTrip', () => {
    it('throws ConflictException when the conditional update affects 0 rows', async () => {
      const order = baseOrder({ status: OrderStatus.ARRIVED, driverId: 'driver-1' });
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 0, raw: [] });

      await expect(service.startTrip('driver-1', 'order-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'status IN (:...expectedStatuses)',
        { expectedStatuses: [OrderStatus.ARRIVED] },
      );
    });
  });

  describe('reassignDriver', () => {
    it('throws ConflictException when the conditional update affects 0 rows', async () => {
      const order = baseOrder({ status: OrderStatus.ACCEPTED, driverId: 'driver-1' });
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);
      driversService.findByIdOrThrow.mockResolvedValue({
        id: 'driver-profile-2',
        userId: 'driver-2',
        isOnline: true,
        carModel: 'Cobalt',
        carNumber: '01A123AA',
        rating: 5,
      });
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 0, raw: [] });

      await expect(
        service.reassignDriver('order-1', 'driver-profile-2', 'manager-1', 'No drivers found automatically'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'status IN (:...expectedStatuses)',
        {
          expectedStatuses: [
            OrderStatus.CREATED,
            OrderStatus.SEARCHING,
            OrderStatus.ACCEPTED,
            OrderStatus.ARRIVED,
          ],
        },
      );
      // The race loser must not produce a dispatch_overrides audit entry for
      // an override that never actually took effect.
      expect(dispatchOverrideRepository.save).not.toHaveBeenCalled();
    });

    it('records a dispatch_overrides audit entry once the reassignment succeeds', async () => {
      const order = baseOrder({ status: OrderStatus.SEARCHING, driverId: null });
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);
      driversService.findByIdOrThrow.mockResolvedValue({
        id: 'driver-profile-2',
        userId: 'driver-2',
        isOnline: true,
        carModel: 'Cobalt',
        carNumber: '01A123AA',
        rating: 5,
      });
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 1, raw: [] });

      await service.reassignDriver('order-1', 'driver-profile-2', 'manager-1', 'No drivers found automatically');

      expect(dispatchOverrideRepository.save).toHaveBeenCalledWith({
        orderId: 'order-1',
        performedByUserId: 'manager-1',
        previousDriverId: null,
        newDriverId: 'driver-2',
        reason: 'No drivers found automatically',
      });
    });

    it('commits the reassignment and its audit entry in a single transaction', async () => {
      // Regression: these were two independent writes, so a failure after the
      // status update left the order reassigned with no audit row while the
      // dispatcher saw a 500 and assumed nothing had changed.
      const order = baseOrder({ status: OrderStatus.SEARCHING, driverId: null });
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);
      driversService.findByIdOrThrow.mockResolvedValue({
        id: 'driver-profile-2',
        userId: 'driver-2',
        isOnline: true,
        carModel: 'Cobalt',
        carNumber: '01A123AA',
        rating: 5,
      });
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 1, raw: [] });

      await service.reassignDriver('order-1', 'driver-profile-2', 'manager-1', 'reason');

      expect(dispatchOverrideRepository.manager.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelOrder', () => {
    it('throws ConflictException when the conditional update affects 0 rows', async () => {
      const order = baseOrder({ status: OrderStatus.SEARCHING, passengerId: 'passenger-1' });
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 0, raw: [] });

      await expect(
        service.cancelOrder('passenger-1', UserRole.PASSENGER, 'order-1', 'changed my mind'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'status IN (:...expectedStatuses)',
        {
          expectedStatuses: [
            // SCHEDULED ham bekor qilinadiganlar ichida: yo'lovchi
            // rejalashtirilgan safarni bajarilishidan OLDIN bekor qila
            // olishi kerak — aynan shu narsa uni rejaga aylantiradi.
            // (`reassignDriver` ro'yxati esa o'zgarmadi: hali haydovchi
            // qidirilmagan buyurtmaga haydovchi biriktirish mantiqsiz.)
            OrderStatus.SCHEDULED,
            OrderStatus.CREATED,
            OrderStatus.SEARCHING,
            OrderStatus.ACCEPTED,
            OrderStatus.ARRIVED,
          ],
        },
      );
    });
  });
});
