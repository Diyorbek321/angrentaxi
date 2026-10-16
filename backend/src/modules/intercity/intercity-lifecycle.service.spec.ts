import { IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { OrderStatus } from '../../database/entities/order.entity';
import { IntercityLifecycleService } from './intercity-lifecycle.service';

const DEPARTURE = new Date('2026-10-20T07:00:00.000Z');
const IN_WINDOW = new Date('2026-10-20T06:30:00.000Z');

const updated = (rows: unknown[]) => [rows, rows.length];

function build(
  options: {
    trip?: Record<string, unknown>;
    bookings?: Array<{ id: string; status: OrderStatus }>;
    busyCityOrders?: number;
    booking?: Record<string, unknown> | null;
  } = {},
) {
  const trip = {
    id: 'trip-1',
    driverId: 'driver-1',
    status: IntercityTripStatus.OPEN,
    departureAt: DEPARTURE,
    ...options.trip,
  };
  const tripRepository = {
    findOne: jest.fn(async () => trip),
  };
  const bookings = options.bookings ?? [
    { id: 'order-1', status: OrderStatus.SCHEDULED },
    { id: 'order-2', status: OrderStatus.SCHEDULED },
  ];
  const orderRepository = {
    find: jest.fn(async () => bookings),
    count: jest.fn(async () => options.busyCityOrders ?? 0),
    findOne: jest.fn(async () =>
      options.booking === undefined
        ? { id: 'order-1', status: OrderStatus.ACCEPTED, intercityTripId: 'trip-1', driverId: 'driver-user-1' }
        : options.booking,
    ),
  };
  const driverRepository = { findOne: jest.fn(async () => ({ id: 'driver-1', userId: 'driver-user-1' })) };
  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('UPDATE "intercity_trips"')) return updated([{ id: 'trip-1' }]);
      if (sql.includes('UPDATE "orders"')) return updated([{ id: 'order-1' }]);
      if (sql.includes('INSERT INTO "trips"')) return [];
      throw new Error(`unexpected SQL ${sql}`);
    }),
  };
  const dataSource = { transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  const settings = { isIntercityEnabled: jest.fn(async () => true) };
  const trips = { getView: jest.fn(async () => ({ id: 'trip-1' })) };
  const service = new IntercityLifecycleService(
    tripRepository as never,
    orderRepository as never,
    driverRepository as never,
    dataSource as never,
    settings as never,
    trips as never,
  );
  return { service, manager, orderRepository, tripRepository };
}

const sqls = (manager: { query: jest.Mock }) =>
  (manager.query.mock.calls as unknown[][]).map((call) => ({ sql: String(call[0]), params: call[1] as unknown[] }));

describe('IntercityLifecycleService.startBoarding', () => {
  it("oynada: qatnov → boarding, SCHEDULED bandlar → ACCEPTED (bitta tranzaksiya)", async () => {
    const { service, manager } = build();
    await service.startBoarding('driver-user-1', 'trip-1', IN_WINDOW);
    const calls = sqls(manager);
    expect(calls[0].sql).toContain(`"status" = 'boarding'`);
    expect(calls[0].sql).toContain(`"status" IN ('open', 'full')`);
    expect(calls[1].sql).toContain('UPDATE "orders"');
    expect(calls[1].params).toEqual(expect.arrayContaining(['trip-1', OrderStatus.ACCEPTED, OrderStatus.SCHEDULED]));
  });

  it("hali erta — 409 TOO_EARLY, hech narsa yozilmaydi", async () => {
    const { service, manager } = build();
    await expect(
      service.startBoarding('driver-user-1', 'trip-1', new Date('2026-10-20T05:00:00.000Z')),
    ).rejects.toMatchObject({
      response: { code: 'INTERCITY_TRIP_ACTION_NOT_ALLOWED', details: { reason: 'TOO_EARLY' } },
    });
    expect(manager.query).not.toHaveBeenCalled();
  });

  it("haydovchi hozir shahar ichidagi safarda — 409 DRIVER_BUSY", async () => {
    const { service, orderRepository } = build({ busyCityOrders: 1 });
    await expect(service.startBoarding('driver-user-1', 'trip-1', IN_WINDOW)).rejects.toMatchObject({
      response: { details: { reason: 'DRIVER_BUSY' } },
    });
    // Faqat shaharlararo bo'lmagan buyurtmalar sanaladi.
    expect(JSON.stringify(orderRepository.count.mock.calls[0])).toContain('intercityTripId');
  });

  it("begona qatnov — 404", async () => {
    const { service, tripRepository } = build();
    tripRepository.findOne.mockResolvedValueOnce(null as never);
    await expect(service.startBoarding('driver-user-1', 'trip-1', IN_WINDOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_TRIP_NOT_FOUND' },
    });
  });
});

describe('IntercityLifecycleService.depart', () => {
  it("hamma olingan: qatnov → in_progress, ARRIVED bandlar → IN_PROGRESS + safar yozuvi", async () => {
    const { service, manager } = build({
      trip: { status: IntercityTripStatus.BOARDING },
      bookings: [
        { id: 'order-1', status: OrderStatus.ARRIVED },
        { id: 'order-2', status: OrderStatus.CANCELLED },
      ],
    });
    await service.depart('driver-user-1', 'trip-1', IN_WINDOW);
    const calls = sqls(manager);
    expect(calls.some((c) => c.sql.includes(`"status" = 'in_progress'`) && c.sql.includes('"intercity_trips"'))).toBe(true);
    const orders = calls.find((c) => c.sql.includes('UPDATE "orders"'));
    expect(orders?.params).toEqual(expect.arrayContaining([OrderStatus.IN_PROGRESS, OrderStatus.ARRIVED]));
    expect(calls.some((c) => c.sql.includes('INSERT INTO "trips"'))).toBe(true);
  });

  it("olinmagan yo'lovchi bor — 409 PASSENGERS_PENDING", async () => {
    const { service, manager } = build({
      trip: { status: IntercityTripStatus.BOARDING },
      bookings: [
        { id: 'order-1', status: OrderStatus.ARRIVED },
        { id: 'order-2', status: OrderStatus.ACCEPTED },
      ],
    });
    await expect(service.depart('driver-user-1', 'trip-1', IN_WINDOW)).rejects.toMatchObject({
      response: { details: { reason: 'PASSENGERS_PENDING' } },
    });
    expect(manager.query).not.toHaveBeenCalled();
  });
});

describe('IntercityLifecycleService.markNoShow', () => {
  it("yig'ish paytida: band bekor (sabab — kelmadi), joylar QAYTARILMAYDI", async () => {
    const { service, manager } = build({ trip: { status: IntercityTripStatus.BOARDING } });
    await service.markNoShow('driver-user-1', 'order-1', IN_WINDOW);
    const calls = sqls(manager);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('UPDATE "orders"');
    expect(calls[0].sql).toContain(`"status" IN ('accepted', 'arrived')`);
    expect(calls.some((c) => c.sql.includes('"seats_taken"'))).toBe(false);
  });

  it("yig'ish boshlanmagan qatnov — 409 WRONG_STATUS", async () => {
    const { service } = build({ trip: { status: IntercityTripStatus.OPEN } });
    await expect(service.markNoShow('driver-user-1', 'order-1', IN_WINDOW)).rejects.toMatchObject({
      response: { details: { reason: 'WRONG_STATUS' } },
    });
  });

  it("boshqa haydovchining bandi — 404", async () => {
    const { service } = build({ booking: { id: 'order-1', status: OrderStatus.ACCEPTED, intercityTripId: 'trip-1', driverId: 'someone-else' } });
    await expect(service.markNoShow('driver-user-1', 'order-1', IN_WINDOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_BOOKING_NOT_FOUND' },
    });
  });
});
