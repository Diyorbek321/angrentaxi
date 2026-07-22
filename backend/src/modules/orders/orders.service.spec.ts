import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
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

  let queryBuilderMock: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
  let orderRepository: {
    findOne: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
  };
  let driversService: { findByUserId: jest.Mock; findByIdOrThrow: jest.Mock };
  let dispatchOverrideRepository: { save: jest.Mock };

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

    dispatchOverrideRepository = { save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        {
          provide: getRepositoryToken(Trip),
          useValue: { save: jest.fn(), findOne: jest.fn(), update: jest.fn() },
        },
        { provide: getRepositoryToken(Transaction), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(DispatchOverride), useValue: dispatchOverrideRepository },
        { provide: TariffsService, useValue: {} },
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('acceptOrder', () => {
    it('rejects the loser of a concurrent accept race with ConflictException', async () => {
      const order = baseOrder({ status: OrderStatus.SEARCHING, driverId: null });
      jest.spyOn(service, 'findByIdOrThrow').mockResolvedValue(order);

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
      jest.spyOn(service, 'findByIdOrThrow').mockResolvedValue(order);
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 0, raw: [] });

      await expect(service.driverArrived('driver-1', 'order-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'status IN (:...expectedStatuses)',
        { expectedStatuses: [OrderStatus.ACCEPTED] },
      );
    });
  });

  describe('startTrip', () => {
    it('throws ConflictException when the conditional update affects 0 rows', async () => {
      const order = baseOrder({ status: OrderStatus.ARRIVED, driverId: 'driver-1' });
      jest.spyOn(service, 'findByIdOrThrow').mockResolvedValue(order);
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
      jest.spyOn(service, 'findByIdOrThrow').mockResolvedValue(order);
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
      jest.spyOn(service, 'findByIdOrThrow').mockResolvedValue(order);
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
  });

  describe('cancelOrder', () => {
    it('throws ConflictException when the conditional update affects 0 rows', async () => {
      const order = baseOrder({ status: OrderStatus.SEARCHING, passengerId: 'passenger-1' });
      jest.spyOn(service, 'findByIdOrThrow').mockResolvedValue(order);
      queryBuilderMock.execute.mockResolvedValueOnce({ affected: 0, raw: [] });

      await expect(
        service.cancelOrder('passenger-1', UserRole.PASSENGER, 'order-1', 'changed my mind'),
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
    });
  });
});
