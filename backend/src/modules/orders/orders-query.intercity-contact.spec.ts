// Shaharlararo band: `orders.driver_id` band paytidayoq yoziladi, shuning
// uchun umumiy yo'lovchi yo'llari haydovchi telefonini erta ochib qo'yardi.
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order, OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { Trip } from '../../database/entities/trip.entity';
import { UserRole } from '../../database/entities/user.entity';
import { DriversService } from '../drivers/drivers.service';
import { OrdersQueryService } from './orders-query.service';

const PHONE = '+998901112233';
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);

describe('OrdersQueryService — shaharlararo haydovchi telefoni', () => {
  let service: OrdersQueryService;
  let tripDeparture: Date;

  const order = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'order-1',
      passengerId: 'pax-1',
      driverId: 'driver-user',
      status: OrderStatus.SCHEDULED,
      serviceType: ServiceType.INTERCITY,
      intercityTripId: 'trip-1',
      pickupAddress: 'Angren',
      dropoffAddress: 'Rohat krugi',
      waypoints: null,
      completedAt: null,
      driver: { id: 'driver-user', firstName: 'Ali', lastName: null, phone: PHONE },
      ...overrides,
    }) as unknown as Order;

  let rows: Order[];

  beforeEach(async () => {
    tripDeparture = inHours(4);
    rows = [order()];
    const orderQuery = jest.fn(async (sql: string) =>
      sql.includes('"intercity_trips"') ? [{ id: 'trip-1', status: 'open', departure_at: tripDeparture }] : [],
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersQueryService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            find: jest.fn(async () => rows),
            findAndCount: jest.fn(async () => [rows, rows.length]),
            findOne: jest.fn(async () => rows[0]),
            query: orderQuery,
          },
        },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: getRepositoryToken(Trip), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: DriversService, useValue: { findByUserId: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    service = module.get(OrdersQueryService);
  });

  const phoneOf = (o: Order) => (o.driver as unknown as { phone: string | null }).phone;

  it("rejalar: jo'nashga 4 soat — telefon yashirin", async () => {
    const [result] = await service.getScheduledOrders('pax-1');
    expect(phoneOf(result)).toBeNull();
  });

  it("tarix: jo'nashga 30 daqiqa — telefon ochiq", async () => {
    tripDeparture = inHours(0.5);
    const page = await service.getPassengerHistory('pax-1');
    expect(phoneOf(page.orders[0])).toBe(PHONE);
  });

  it("GET /orders/:id yo'lovchi sifatida — yashirin; tayinlangan haydovchi va menejer — o'zgarishsiz", async () => {
    expect(phoneOf(await service.findByIdForUser('order-1', { id: 'pax-1', role: UserRole.PASSENGER }))).toBeNull();
    expect(phoneOf(await service.findByIdForUser('order-1', { id: 'driver-user', role: UserRole.DRIVER }))).toBe(PHONE);
    expect(phoneOf(await service.findByIdForUser('order-1', { id: 'm1', role: UserRole.MANAGER }))).toBe(PHONE);
  });

  it("taksi buyurtmasi — telefon avvalgidek (regressiya)", async () => {
    rows = [order({ serviceType: ServiceType.TAXI, intercityTripId: null, status: OrderStatus.ACCEPTED })];
    const page = await service.getPassengerHistory('pax-1');
    expect(phoneOf(page.orders[0])).toBe(PHONE);
  });
});
