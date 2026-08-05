import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { fakeDataSourceProvider } from './orders.testing';
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
 * Regression coverage for the IDOR on `GET /orders/:id`.
 *
 * The controller used to call `findByIdOrThrow` directly with no ownership
 * check, so any authenticated user could read any order by guessing/leaking
 * its UUID — including the passenger's and driver's names, phone numbers and
 * pickup/dropoff addresses, which the endpoint eagerly joins.
 *
 * `findByIdForUser` adds the access rule: passenger, assigned driver, or
 * manager/admin only. `findByIdOrThrow` deliberately stays permissive because
 * it is used from many internal call sites.
 */
describe('OrdersService - findByIdForUser access control', () => {
  let service: OrdersService;
  // findByIdOrThrow now lives on OrdersQueryService, which the facade and the
  // write-side services both delegate to — so that is where it gets stubbed.
  let queryService: OrdersQueryService;

  const order = {
    id: 'order-1',
    passengerId: 'passenger-1',
    driverId: 'driver-user-1',
    status: OrderStatus.IN_PROGRESS,
    tariffId: 'tariff-1',
  } as Order;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...ORDERS_PROVIDERS,
        fakeDataSourceProvider(),
        {
          provide: getRepositoryToken(Order),
          useValue: {
            findOne: jest.fn(),
            query: jest.fn(),
            createQueryBuilder: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: { save: jest.fn(), findOne: jest.fn(), update: jest.fn() },
        },
        { provide: getRepositoryToken(Transaction), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(DispatchOverride), useValue: { save: jest.fn() } },
        { provide: TariffsService, useValue: {} },
        {
          provide: RealtimeGateway,
          useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() },
        },
        { provide: NotificationsService, useValue: {} },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: DriversService, useValue: { findByUserId: jest.fn(), findByIdOrThrow: jest.fn() } },
        { provide: PromoCodesService, useValue: {} },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);
    queryService = module.get(OrdersQueryService);
    jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue(order);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects an unrelated passenger with ForbiddenException', async () => {
    await expect(
      service.findByIdForUser('order-1', { id: 'stranger-1', role: UserRole.PASSENGER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an unrelated driver with ForbiddenException', async () => {
    await expect(
      service.findByIdForUser('order-1', { id: 'other-driver', role: UserRole.DRIVER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the order owner (passenger)', async () => {
    await expect(
      service.findByIdForUser('order-1', { id: 'passenger-1', role: UserRole.PASSENGER }),
    ).resolves.toBe(order);
  });

  it('allows the assigned driver (driverId references User.id)', async () => {
    await expect(
      service.findByIdForUser('order-1', { id: 'driver-user-1', role: UserRole.DRIVER }),
    ).resolves.toBe(order);
  });

  it('allows a manager (dispatcher panel must keep working)', async () => {
    await expect(
      service.findByIdForUser('order-1', { id: 'manager-1', role: UserRole.MANAGER }),
    ).resolves.toBe(order);
  });

  it('allows an admin (admin panel must keep working)', async () => {
    await expect(
      service.findByIdForUser('order-1', { id: 'admin-1', role: UserRole.ADMIN }),
    ).resolves.toBe(order);
  });

  it('does not treat an unassigned order (driverId null) as owned by a driver', async () => {
    jest
      .spyOn(queryService, 'findByIdOrThrow')
      .mockResolvedValue({ ...order, driverId: null } as Order);

    await expect(
      service.findByIdForUser('order-1', { id: 'driver-user-1', role: UserRole.DRIVER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propagates NotFoundException for unknown orders', async () => {
    jest
      .spyOn(queryService, 'findByIdOrThrow')
      .mockRejectedValue(new NotFoundException('Order missing not found'));

    await expect(
      service.findByIdForUser('missing', { id: 'passenger-1', role: UserRole.PASSENGER }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
