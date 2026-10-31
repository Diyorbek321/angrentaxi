import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { SurgeService } from '../surge/surge.service';
import { OsrmService } from '../routing/osrm.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import { fakeDataSourceProvider, fakeTransactionRepository, fakeCitiesServiceProvider } from './orders.testing';
import { OrdersQueryService } from './orders-query.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus, ServiceType } from '../../database/entities/order.entity';
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
 * Bir vaqtda faqat BITTA jonli taksi buyurtmasi (egasi qarori, 2026-10-31).
 * Ovqat/market/posilka va rejalashtirilgan safar cheklovga kirmaydi.
 */
describe('OrdersService.create — bitta faol taksi buyurtmasi', () => {
  let service: OrdersService;
  let orderRepository: { query: jest.Mock; findOne: jest.Mock; count?: jest.Mock; createQueryBuilder: jest.Mock };
  let routeDistanceMeters: jest.Mock;
  let calculatePriceBreakdown: jest.Mock;
  let tariff: { id: string; isActive: boolean; serviceType: string };

  const PICKUP = { pickupLat: 41.011, pickupLng: 70.142, pickupAddress: 'Markaz' };

  beforeEach(async () => {
    orderRepository = {
      count: jest.fn().mockResolvedValue(0),
      query: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    routeDistanceMeters = jest.fn().mockResolvedValue(5000);
    tariff = { id: 'tariff-1', isActive: true, serviceType: ServiceType.TAXI };
    calculatePriceBreakdown = jest.fn().mockReturnValue({
      baseFare: 3000, distanceKm: 0, pricePerKm: 1500, distanceFare: 0,
      durationMin: 0, pricePerMin: 200, timeFare: 0,
      minPriceAdjustment: 2000, surgeMultiplier: 1, surgeFare: 0,
      maxPriceCap: 0, waitingMinutes: 0, waitingFare: 0, total: 5000,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...ORDERS_PROVIDERS,
        fakeCitiesServiceProvider(),
        { provide: OsrmService, useValue: { routeDistanceMeters } },
        { provide: RoutedDistancePricing, useValue: { enabled: false } },
        {
          provide: SurgeService,
          useValue: { snapshotFor: jest.fn().mockResolvedValue({ multiplier: 1, demand: 0, supply: 0, zone: 'z' }) },
        },
        fakeDataSourceProvider(),
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Trip), useValue: { save: jest.fn(), findOne: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository(0) },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        {
          provide: TariffsService,
          useValue: { findById: jest.fn(async () => tariff), calculatePriceBreakdown },
        },
        { provide: RealtimeGateway, useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() } },
        { provide: NotificationsService, useValue: {} },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: DriversService, useValue: { findByUserId: jest.fn() } },
        { provide: PromoCodesService, useValue: { validate: jest.fn() } },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);
    jest
      .spyOn(module.get(OrdersQueryService), 'findByIdOrThrow')
      .mockResolvedValue({ id: 'order-1', status: OrderStatus.CREATED } as Order);
  });

  const DEST = { dropoffLat: 41.02, dropoffLng: 70.15, dropoffAddress: 'Bozor' };

  it('faol taksi buyurtmasi bo‘lsa — 409, INSERT bajarilmaydi', async () => {
    orderRepository.count!.mockResolvedValue(1);

    await expect(
      service.create('passenger-1', { tariffId: 'tariff-1', ...PICKUP, ...DEST } as CreateOrderDto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orderRepository.query).not.toHaveBeenCalled();
  });

  it('faqat shu yo‘lovchining jonli TAKSI holatlari sanaladi', async () => {
    await service.create('passenger-1', { tariffId: 'tariff-1', ...PICKUP, ...DEST } as CreateOrderDto);

    const where = orderRepository.count!.mock.calls[0][0].where;
    expect(where.passengerId).toBe('passenger-1');
    expect(where.serviceType).toBe(ServiceType.TAXI);
    expect(where.status.value).toEqual([
      OrderStatus.CREATED,
      OrderStatus.SEARCHING,
      OrderStatus.ACCEPTED,
      OrderStatus.ARRIVED,
      OrderStatus.IN_PROGRESS,
    ]);
  });

  it('faol buyurtma yo‘q — odatdagidek yaratiladi', async () => {
    await service.create('passenger-1', { tariffId: 'tariff-1', ...PICKUP, ...DEST } as CreateOrderDto);

    expect(orderRepository.query).toHaveBeenCalled();
  });

  it('rejalashtirilgan safar cheklovga kirmaydi', async () => {
    orderRepository.count!.mockResolvedValue(1);
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();

    await service.create('passenger-1', {
      tariffId: 'tariff-1', ...PICKUP, ...DEST, scheduledAt,
    } as CreateOrderDto);

    expect(orderRepository.count).not.toHaveBeenCalled();
    expect(orderRepository.query).toHaveBeenCalled();
  });

  it('posilka cheklovga kirmaydi', async () => {
    orderRepository.count!.mockResolvedValue(1);
    tariff.serviceType = ServiceType.PARCEL;

    await service.create('passenger-1', {
      tariffId: 'tariff-1', ...PICKUP, ...DEST, serviceType: ServiceType.PARCEL,
      details: { recipientName: 'Ali', recipientPhone: '+998901234567', itemDescription: 'Hujjat', size: 'small' },
    } as unknown as CreateOrderDto);

    expect(orderRepository.count).not.toHaveBeenCalled();
  });
});
