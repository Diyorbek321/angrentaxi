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
 * FOIZLI PROMOKOD — taxminiy narx yakuniy undiriladigan summa bilan BIR XIL
 * yaxlitlanadi (`applyDiscount`). Ilgari taxmin `estimatedPrice − chegirma`
 * ni yaxlitlamasdan saqlardi: 23 400 × 15% → taxmin 19 890, yakunda 19 900.
 */
describe('OrdersService — promokodli taxminiy narx yaxlitlanadi', () => {
  let service: OrdersService;
  let orderRepository: { query: jest.Mock; findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let routeDistanceMeters: jest.Mock;
  let calculatePriceBreakdown: jest.Mock;
  let getTripOptionFees: jest.Mock;
  let tariff: { id: string; isActive: boolean; serviceType: string };
  let promoValidate: jest.Mock;

  const PICKUP = { pickupLat: 41.011, pickupLng: 70.142, pickupAddress: 'Markaz' };

  beforeEach(async () => {
    orderRepository = {
      query: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    promoValidate = jest.fn().mockResolvedValue({ promoCodeId: 'promo-1', discountAmount: 3510 });
    getTripOptionFees = jest.fn().mockResolvedValue({ child_seat: 5000, pet: 7000 });
    routeDistanceMeters = jest.fn().mockResolvedValue(5000);
    tariff = { id: 'tariff-1', isActive: true, serviceType: ServiceType.TAXI };
    calculatePriceBreakdown = jest.fn().mockReturnValue({
      baseFare: 3000, distanceKm: 0, pricePerKm: 1500, distanceFare: 0,
      durationMin: 0, pricePerMin: 200, timeFare: 0,
      minPriceAdjustment: 2000, surgeMultiplier: 1, surgeFare: 0,
      maxPriceCap: 0, waitingMinutes: 0, waitingFare: 0, roundingAdjustment: 0, total: 23400,
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
        { provide: PromoCodesService, useValue: { validate: promoValidate } },
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

  it('15% promo on 23 400 — estimate 19 900 (same as the completion charge), discount 3 500', async () => {
    await service.create('passenger-1', {
      tariffId: 'tariff-1', ...PICKUP, promoCode: 'FIFTEEN',
    } as CreateOrderDto);

    const row = inserted();
    expect(row.estimated_price).toBe(19900);
    expect(row.discount_amount).toBe(3500);
    expect(row.promo_code_id).toBe('promo-1');
  });

  it('no promo — the estimate is untouched', async () => {
    await service.create('passenger-1', { tariffId: 'tariff-1', ...PICKUP } as CreateOrderDto);

    expect(promoValidate).not.toHaveBeenCalled();
    expect(inserted().estimated_price).toBe(23400);
    expect(inserted().discount_amount).toBeNull();
  });
});
