import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order } from '../../database/entities/order.entity';
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
import { CreateOrderDto } from './dto/create-order.dto';

/**
 * Multi-stop ride coverage: OrdersService.create() should (a) price a route
 * with intermediate waypoints as the sum of Haversine legs across the full
 * path (pickup -> waypoint[0] -> ... -> dropoff), which by the triangle
 * inequality is always >= the direct pickup->dropoff distance, and (b)
 * persist + echo back the waypoints on the created order.
 */
describe('OrdersService - multi-stop rides (waypoints)', () => {
  let service: OrdersService;
  let orderRepository: {
    query: jest.Mock;
    findOne: jest.Mock;
  };

  const tariff = {
    id: 'tariff-1',
    isActive: true,
    basePrice: 5000,
    pricePerKm: 1500,
    pricePerMin: 200,
    minPrice: 5000,
    maxPrice: null as number | null,
    surgeMultiplier: 1,
  };

  const tariffsService = {
    findById: jest.fn().mockResolvedValue(tariff),
    // Mirrors TariffsService.calculatePrice's real formula so the test
    // exercises genuine price-scales-with-distance behavior.
    calculatePrice: jest.fn(
      (t: typeof tariff, distanceKm: number, durationMin: number) => {
        const baseTotal = t.basePrice + distanceKm * t.pricePerKm + durationMin * t.pricePerMin;
        const raw = Math.max(t.minPrice, baseTotal) * (t.surgeMultiplier ?? 1);
        return t.maxPrice != null ? Math.min(raw, t.maxPrice) : raw;
      },
    ),
  };

  // Base coordinates around Angren, matching the DTO's own examples.
  const pickup = { lat: 40.0956, lng: 70.9432 };
  const dropoff = { lat: 40.115, lng: 70.965 };
  // Deliberately off to the side of the direct pickup->dropoff line so the
  // detour adds real distance (triangle inequality), not just a reordering.
  const waypoint = { lat: 40.2, lng: 70.8, address: 'Angren bozori' };

  const baseDto: CreateOrderDto = {
    tariffId: 'tariff-1',
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    dropoffLat: dropoff.lat,
    dropoffLng: dropoff.lng,
    pickupAddress: 'Pickup address',
    dropoffAddress: 'Dropoff address',
  };

  const INSERT_PRICE_PARAM_INDEX = 8;
  const INSERT_WAYPOINTS_PARAM_INDEX = 16;

  beforeEach(async () => {
    orderRepository = {
      query: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Trip), useValue: {} },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: TariffsService, useValue: tariffsService },
        {
          provide: RealtimeGateway,
          useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() },
        },
        { provide: NotificationsService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: DriversService, useValue: { findByUserId: jest.fn() } },
        { provide: PromoCodesService, useValue: {} },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);

    orderRepository.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO orders')) {
        return [{ id: 'created-order-id' }];
      }
      if (sql.includes('FROM orders WHERE id = ANY')) {
        return []; // no PostGIS coords needed for this test
      }
      return [];
    });
  });

  function mockFindOneReturns(waypoints: unknown): void {
    orderRepository.findOne.mockResolvedValue({
      id: 'created-order-id',
      passengerId: 'passenger-1',
      driverId: null,
      waypoints: waypoints ?? null,
    } as unknown as Order);
  }

  it('prices a route with waypoints higher than the direct pickup->dropoff route', async () => {
    mockFindOneReturns(null);

    await service.create('passenger-1', baseDto);
    const directPriceParams = orderRepository.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO orders'),
    )![1];
    const directPrice = directPriceParams[INSERT_PRICE_PARAM_INDEX];

    orderRepository.query.mock.calls.length = 0;
    mockFindOneReturns([waypoint]);

    await service.create('passenger-1', { ...baseDto, waypoints: [waypoint] });
    const waypointPriceParams = orderRepository.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO orders'),
    )![1];
    const waypointPrice = waypointPriceParams[INSERT_PRICE_PARAM_INDEX];

    expect(waypointPrice).toBeGreaterThan(directPrice);
  });

  it('persists the waypoints and returns them on the created order', async () => {
    mockFindOneReturns([waypoint]);

    const order = await service.create('passenger-1', {
      ...baseDto,
      waypoints: [waypoint],
    });

    const insertParams = orderRepository.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO orders'),
    )![1];
    expect(JSON.parse(insertParams[INSERT_WAYPOINTS_PARAM_INDEX])).toEqual([waypoint]);

    expect((order as unknown as { waypoints: unknown[] }).waypoints).toEqual([waypoint]);
  });

  it('defaults waypoints to an empty array when none were supplied', async () => {
    mockFindOneReturns(null);

    const order = await service.create('passenger-1', baseDto);

    const insertParams = orderRepository.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO orders'),
    )![1];
    expect(insertParams[INSERT_WAYPOINTS_PARAM_INDEX]).toBeNull();

    expect((order as unknown as { waypoints: unknown[] }).waypoints).toEqual([]);
  });
});
