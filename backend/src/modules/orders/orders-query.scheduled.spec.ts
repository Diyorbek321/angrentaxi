// `GET /orders/scheduled` o'qish yo'li.
//
// Uchta narsa muhim: faqat CHAQIRUVCHINING rejalari, faqat SCHEDULED
// holatidagilar, va javob mobil ilova o'qiy oladigan shaklda bo'lishi
// (`attachDisplayFields`).
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { Trip } from '../../database/entities/trip.entity';
import { DriversService } from '../drivers/drivers.service';
import { OrdersQueryService } from './orders-query.service';
import { SCHEDULED_LIST_LIMIT } from './scheduled-orders.constants';

describe('OrdersQueryService.getScheduledOrders', () => {
  let service: OrdersQueryService;
  let find: jest.Mock;
  let orderQuery: jest.Mock;

  const scheduled = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'order-1',
      passengerId: 'passenger-1',
      driverId: null,
      status: OrderStatus.SCHEDULED,
      pickupAddress: 'Angren markazi',
      dropoffAddress: 'Angren bozori',
      waypoints: null,
      scheduledAt: new Date('2026-08-20T03:00:00.000Z'),
      completedAt: null,
      ...overrides,
    }) as Order;

  beforeEach(async () => {
    find = jest.fn().mockResolvedValue([]);
    orderQuery = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersQueryService,
        { provide: getRepositoryToken(Order), useValue: { find, query: orderQuery } },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: getRepositoryToken(Trip), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: DriversService, useValue: { findByUserId: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersQueryService);
  });

  it("faqat chaqiruvchining SCHEDULED buyurtmalarini so'raydi", async () => {
    await service.getScheduledOrders('passenger-1');

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { passengerId: 'passenger-1', status: OrderStatus.SCHEDULED },
      }),
    );
  });

  it('eng yaqin reja birinchi, va ro\'yxat cheklangan', async () => {
    await service.getScheduledOrders('passenger-1');

    const args = find.mock.calls[0][0];
    expect(args.order).toEqual({ scheduledAt: 'ASC' });
    expect(args.take).toBe(SCHEDULED_LIST_LIMIT);
  });

  it('boshqa yo\'lovchining rejalari so\'ralmaydi', async () => {
    await service.getScheduledOrders('passenger-2');

    const where = find.mock.calls[0][0].where as { passengerId: string };
    expect(where.passengerId).toBe('passenger-2');
  });

  it("pickup/dropoff koordinatalari javobga qo'shiladi", async () => {
    // ⚠️ `pickupLocation` ORM orqali opaque PostGIS geometry bo'lib
    // qaytadi. `attachDisplayFields` chaqirilmasa, mobil `Order.fromJson`
    // `json['pickup']` da null exception beradi va rejalar ekrani bo'sh
    // qoladi.
    find.mockResolvedValue([scheduled()]);
    orderQuery.mockResolvedValue([
      {
        id: 'order-1',
        pickup_lat: '40.0956',
        pickup_lng: '70.9432',
        dropoff_lat: '40.1050',
        dropoff_lng: '70.9500',
      },
    ]);

    const [order] = await service.getScheduledOrders('passenger-1');
    const record = order as unknown as Record<string, unknown>;

    expect(record.pickup).toEqual({
      address: 'Angren markazi',
      lat: 40.0956,
      lng: 70.9432,
    });
    expect(record.dropoff).toEqual({
      address: 'Angren bozori',
      lat: 40.105,
      lng: 70.95,
    });
  });
});

describe('OrdersQueryService.getActiveOrders — rejalar taxtaga chiqmaydi', () => {
  let service: OrdersQueryService;
  let find: jest.Mock;

  beforeEach(async () => {
    find = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersQueryService,
        {
          provide: getRepositoryToken(Order),
          useValue: { find, query: jest.fn().mockResolvedValue([]) },
        },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: getRepositoryToken(Trip), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: DriversService, useValue: { findByUserId: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersQueryService);
  });

  it('dispetcher taxtasi SCHEDULED buyurtmalarni so\'ramaydi', async () => {
    await service.getActiveOrders();

    // Taxta 200 qator bilan cheklangan va faqat JONLI safarlar uchun —
    // kelasi haftagacha bo'lgan rejalar uni bosib ketardi.
    const where = find.mock.calls[0][0].where as Array<{ status: OrderStatus }>;
    expect(where.map((w) => w.status)).not.toContain(OrderStatus.SCHEDULED);
  });
});
