import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { fakeDataSourceProvider, fakeTransactionRepository } from './orders.testing';
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

/**
 * Regression coverage for the unbounded dispatcher board query.
 *
 * `getActiveOrders` used to `find()` every in-flight order with three eagerly
 * joined relations and no `take`, on every poll of the web-manager dispatcher
 * panel. A matching backlog therefore turned a routine poll into a full table
 * read. The cap must stay in place, and the response must stay a bare array
 * because web-manager unwraps `ApiResponse<Order[]>` directly.
 */
describe('OrdersService - getActiveOrders is bounded', () => {
  let service: OrdersService;
  let orderRepository: { find: jest.Mock };

  const ACTIVE_ORDERS_LIMIT = 200;

  beforeEach(async () => {
    orderRepository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...ORDERS_PROVIDERS,
        fakeDataSourceProvider(),
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Trip), useValue: {} },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository() },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: TariffsService, useValue: {} },
        { provide: RealtimeGateway, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: DriversService, useValue: {} },
        { provide: PromoCodesService, useValue: {} },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);

    // attachDisplayFields does its own enrichment queries; not under test here.
    // It lives on OrdersQueryService, which the facade delegates getActiveOrders to.
    jest
      .spyOn(
        module.get(OrdersQueryService) as unknown as {
          attachDisplayFields: (o: Order[]) => Promise<Order[]>;
        },
        'attachDisplayFields',
      )
      .mockImplementation(async (orders: Order[]) => orders);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('caps the query and keeps the newest-first order', async () => {
    orderRepository.find.mockResolvedValue([]);

    await service.getActiveOrders();

    expect(orderRepository.find).toHaveBeenCalledTimes(1);
    const options = orderRepository.find.mock.calls[0][0];
    expect(options.take).toBe(ACTIVE_ORDERS_LIMIT);
    expect(options.order).toEqual({ createdAt: 'DESC' });
    expect(options.where).toEqual([
      { status: OrderStatus.SEARCHING },
      { status: OrderStatus.ACCEPTED },
      { status: OrderStatus.ARRIVED },
      { status: OrderStatus.IN_PROGRESS },
    ]);
  });

  it('returns a bare array (web-manager depends on this shape)', async () => {
    const orders = [{ id: 'order-1' } as Order];
    orderRepository.find.mockResolvedValue(orders);

    await expect(service.getActiveOrders()).resolves.toEqual(orders);
  });

  it('warns when the cap is reached so a dispatch backlog is visible', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    orderRepository.find.mockResolvedValue(
      Array.from({ length: ACTIVE_ORDERS_LIMIT }, (_, i) => ({ id: `order-${i}` }) as Order),
    );

    await service.getActiveOrders();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn below the cap', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    orderRepository.find.mockResolvedValue([{ id: 'order-1' } as Order]);

    await service.getActiveOrders();

    expect(warn).not.toHaveBeenCalled();
  });
});
