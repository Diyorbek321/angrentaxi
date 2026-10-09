import { BadRequestException } from '@nestjs/common';
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
 * SAFAR OPSIYALARI HAQI — buyurtma berilganda quote'ga muzlatiladi va
 * taxminiy narxda ham AYNAN shu summa ko'rinadi.
 */
describe('OrdersService — safar opsiyalari haqi', () => {
  let service: OrdersService;
  let orderRepository: { query: jest.Mock; findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let routeDistanceMeters: jest.Mock;
  let calculatePriceBreakdown: jest.Mock;
  let getTripOptionFees: jest.Mock;
  let tariff: { id: string; isActive: boolean; serviceType: string };

  const PICKUP = { pickupLat: 41.011, pickupLng: 70.142, pickupAddress: 'Markaz' };

  beforeEach(async () => {
    orderRepository = {
      query: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    getTripOptionFees = jest.fn().mockResolvedValue({ child_seat: 5000, pet: 7000 });
    routeDistanceMeters = jest.fn().mockResolvedValue(5000);
    tariff = { id: 'tariff-1', isActive: true, serviceType: ServiceType.TAXI };
    calculatePriceBreakdown = jest.fn().mockReturnValue({
      baseFare: 3000, distanceKm: 0, pricePerKm: 1500, distanceFare: 0,
      durationMin: 0, pricePerMin: 200, timeFare: 0,
      minPriceAdjustment: 2000, surgeMultiplier: 1, surgeFare: 0,
      maxPriceCap: 0, waitingMinutes: 0, waitingFare: 0, roundingAdjustment: 0, total: 5000,
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
        { provide: SettingsService, useValue: { getTripOptionFees } },
      ],
    }).compile();

    service = module.get(OrdersService);
    jest
      .spyOn(module.get(OrdersQueryService), 'findByIdOrThrow')
      .mockResolvedValue({ id: 'order-1', status: OrderStatus.CREATED } as Order);
  });

  /** INSERT ustunlari nomi → qiymati. */
  const inserted = (): Record<string, unknown> => {
    const [sql, params] = orderRepository.query.mock.calls[0] as [string, unknown[]];
    const columns = sql
      .slice(sql.indexOf('(') + 1, sql.indexOf(')'))
      .split(',')
      .map((c) => c.trim());
    // pickup/dropoff ikkitadan parametr oladi (lng, lat).
    const values: Record<string, unknown> = {};
    let p = 0;
    for (const column of columns) {
      if (column === 'pickup_location' || column === 'dropoff_location') {
        values[column] = [params[p], params[p + 1]];
        p += 2;
      } else {
        values[column] = params[p];
        p += 1;
      }
    }
    return values;
  };

  it('freezes the option fees into the quote and the estimated price', async () => {
    await service.create('passenger-1', {
      tariffId: 'tariff-1', ...PICKUP, options: ['pet', 'child_seat', 'air_conditioner'],
    } as CreateOrderDto);

    const row = inserted();
    expect(row.estimated_price).toBe(17000);
    const quote = JSON.parse(row.fare_breakdown as string);
    expect(quote.optionsFare).toBe(12000);
    expect(quote.optionCharges).toEqual([
      { option: 'child_seat', fee: 5000 },
      { option: 'pet', fee: 7000 },
    ]);
  });

  it('does not read the settings when no option is asked for', async () => {
    await service.create('passenger-1', { tariffId: 'tariff-1', ...PICKUP } as CreateOrderDto);

    expect(getTripOptionFees).not.toHaveBeenCalled();
    expect(inserted().estimated_price).toBe(5000);
  });

  it('the price estimate includes the same fee', async () => {
    const quote = await service.calculatePrice({
      tariffId: 'tariff-1', distanceKm: 3, durationMin: 8, options: ['child_seat'],
    } as never);

    expect(quote.price).toBe(10000);
    expect(quote.optionsFare).toBe(5000);
  });
});
