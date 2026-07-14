import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';
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
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Trip), useValue: tripRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
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
    jest.spyOn(service, 'findByIdOrThrow').mockResolvedValue(baseOrder);
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
