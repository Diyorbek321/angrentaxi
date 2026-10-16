import { BadRequestException } from '@nestjs/common';
import { IntercityTripClass, IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { IntercityBookingKind, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { IntercityBookingsService } from './intercity-bookings.service';

const NOW = new Date('2026-10-20T03:00:00.000Z');
const DEPARTURE = new Date('2026-10-20T07:00:00.000Z');

const angren = { id: 'p-angren', name: 'Angren', centerLat: 40.0956, centerLng: 70.9432, radiusKm: 12, isActive: true };
const rohat = { id: 'p-rohat', name: 'Rohat krugi', centerLat: 41.3111, centerLng: 69.2797, radiusKm: 1.5, isActive: true };

const tripRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'trip-1',
  routeId: 'route-1',
  driverId: 'driver-1',
  tripClass: IntercityTripClass.START,
  departureAt: DEPARTURE,
  seatsTotal: 4,
  seatsTaken: 0,
  wholeCarBooked: false,
  status: IntercityTripStatus.OPEN,
  seatPrice: 25000,
  wholeCarPrice: 100000,
  cancelReason: null,
  route: { id: 'route-1', originPointId: angren.id, destinationPointId: rohat.id, originPoint: angren, destinationPoint: rohat },
  driver: { id: 'driver-1', userId: 'driver-user-1', rating: 4.9, carModel: 'Cobalt', licensePlate: '10A123BC', carNumber: null, user: { firstName: 'Ali', phone: '+998901112233' } },
  ...overrides,
});

const dto = (overrides: Record<string, unknown> = {}) => ({
  kind: IntercityBookingKind.SEAT,
  seats: 2,
  pickup: { lat: 40.0956, lng: 70.9432, address: 'Angren, Navoiy 12' },
  dropoff: { lat: 41.3111, lng: 69.2797, address: 'Rohat krugi' },
  ...overrides,
});

/** TypeORM UPDATE ... RETURNING shakli. */
const updated = (rows: unknown[]) => [rows, rows.length];

function build(options: { enabled?: boolean; debt?: number } = {}) {
  const tripRepository = { findOne: jest.fn(async () => tripRow()) };
  const bookingOrder = {
    id: 'order-1',
    passengerId: 'pax-1',
    createdAt: NOW,
    updatedAt: NOW,
    status: OrderStatus.SCHEDULED,
    bookingKind: IntercityBookingKind.SEAT,
    seats: 2,
    estimatedPrice: 50000,
    finalPrice: null,
    paymentMethod: PaymentMethod.CASH,
    pickupAddress: 'Angren, Navoiy 12',
    dropoffAddress: 'Rohat krugi',
    cancelReason: null,
    intercityTrip: tripRow(),
  };
  const orderRepository = {
    findOne: jest.fn(async () => bookingOrder),
    findAndCount: jest.fn(async () => [[bookingOrder], 1]),
    find: jest.fn(async () => [
      { ...bookingOrder, passenger: { firstName: 'Jasur', lastName: null, phone: '+998901234567' }, createdAt: NOW, updatedAt: NOW, cancelReason: null },
    ]),
  };
  const tariffRepository = { findOne: jest.fn(async () => ({ id: 'tariff-intercity' })) };
  const transactionRepository = {
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      qb.select = jest.fn(() => qb);
      qb.where = jest.fn(() => qb);
      qb.andWhere = jest.fn(() => qb);
      qb.getRawOne = jest.fn(async () => ({ debt: String(options.debt ?? 0) }));
      return qb;
    }),
  };
  // Har bir so'rov SQL matni bo'yicha javob beradi — tartibga bog'lanmaydi.
  const answers: Record<string, unknown> = {
    advisory: [],
    existing: [],
    claimSeats: updated([{ id: 'trip-1', seats_taken: 2, seats_total: 4, status: 'open' }]),
    claimWholeCar: updated([{ id: 'trip-1', seats_taken: 4, seats_total: 4, status: 'full' }]),
    insert: [{ id: 'order-1' }],
    cancelOrder: updated([{ intercity_trip_id: 'trip-1', seats: 2, booking_kind: 'seat', scheduled_at: DEPARTURE }]),
    release: updated([{ id: 'trip-1', seats_taken: 0, seats_total: 4, status: 'open' }]),
  };
  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return answers.advisory;
      if (sql.includes('SELECT "id" FROM "orders"')) return answers.existing;
      if (sql.includes('"whole_car_booked" = true')) return answers.claimWholeCar;
      if (sql.includes('"seats_taken" = "seats_taken" +')) return answers.claimSeats;
      if (sql.includes('INSERT INTO "orders"')) return answers.insert;
      if (sql.includes('UPDATE "orders"')) return answers.cancelOrder;
      if (sql.includes('GREATEST("seats_taken"')) return answers.release;
      throw new Error(`unexpected SQL: ${sql}`);
    }),
  };
  const dataSource = { transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  const settings = {
    isIntercityEnabled: jest.fn(async () => options.enabled ?? true),
    getIntercitySettings: jest.fn(async () => ({
      intercityEnabled: options.enabled ?? true,
      intercityFreeCancelMinutes: 60,
      intercityMaxSeatsPerBooking: 4,
      intercityMinLeadMinutes: 30,
      intercityMaxAheadDays: 7,
    })),
  };
  const notifier = {
    bookingCreated: jest.fn(async () => undefined),
    bookingCancelled: jest.fn(async () => undefined),
    bookingCancelledByDispatcher: jest.fn(async () => undefined),
  };
  const service = new IntercityBookingsService(
    tripRepository as never,
    orderRepository as never,
    tariffRepository as never,
    transactionRepository as never,
    dataSource as never,
    settings as never,
    notifier as never,
  );
  return { service, manager, answers, orderRepository, tripRepository, notifier };
}

const sqlCalls = (manager: { query: jest.Mock }) =>
  (manager.query.mock.calls as unknown[][]).map((call) => ({ sql: String(call[0]), params: call[1] as unknown[] }));

describe('IntercityBookingsService.book', () => {
  it("flag o'chiq — 404 INTERCITY_DISABLED", async () => {
    const { service } = build({ enabled: false });
    await expect(service.book('pax-1', 'trip-1', dto(), NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_DISABLED' },
    });
  });

  it("o'rindiq bandi: shartli UPDATE, so'ng SHU tranzaksiyada buyurtma", async () => {
    const { service, manager } = build();
    const view = await service.book('pax-1', 'trip-1', dto(), NOW);

    const calls = sqlCalls(manager);
    const claim = calls.findIndex((call) => call.sql.includes('"seats_taken" = "seats_taken" +'));
    const insert = calls.findIndex((call) => call.sql.includes('INSERT INTO "orders"'));
    expect(claim).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(claim);
    expect(calls[claim].params).toEqual(['trip-1', 2, NOW]);

    const params = calls[insert].params;
    // Haydovchi — qatnov egasi (users.id), narx = 2 × 25 000, qat'iy narx, rejalashtirilgan.
    expect(params).toEqual(
      expect.arrayContaining(['pax-1', 'driver-user-1', 'tariff-intercity', 50000, OrderStatus.SCHEDULED, 'intercity', 'trip-1', 2, 'seat', DEPARTURE]),
    );
    expect(view).toMatchObject({ orderId: 'order-1', seats: 2 });
  });

  it("butun mashina: alohida shart (seats_taken = 0), narx — butun mashina narxi", async () => {
    const { service, manager } = build();
    await service.book('pax-1', 'trip-1', dto({ kind: IntercityBookingKind.WHOLE_CAR, seats: undefined }), NOW);
    const calls = sqlCalls(manager);
    const claim = calls.find((call) => call.sql.includes('"whole_car_booked" = true'));
    expect(claim?.sql).toContain('"seats_taken" = 0');
    const insert = calls.find((call) => call.sql.includes('INSERT INTO "orders"'));
    expect(insert?.params).toEqual(expect.arrayContaining([100000, 4, 'whole_car']));
  });

  it("muvaffaqiyatli band — COMMIT'dan keyin haydovchiga xabar (bookingCreated)", async () => {
    const { service, notifier } = build();
    await service.book('pax-1', 'trip-1', dto(), NOW);
    expect(notifier.bookingCreated).toHaveBeenCalledWith({
      tripId: 'trip-1',
      orderId: 'order-1',
      seats: 2,
      bookingKind: 'seat',
    });
  });

  it("band rad etilsa xabar yuborilmaydi", async () => {
    const { service, answers, notifier } = build();
    answers.claimSeats = updated([]);
    await expect(service.book('pax-1', 'trip-1', dto(), NOW)).rejects.toBeDefined();
    expect(notifier.bookingCreated).not.toHaveBeenCalled();
  });

  it("joy qolmagan (UPDATE 0 qator) — 409 INTERCITY_SEATS_UNAVAILABLE, buyurtma yozilmaydi", async () => {
    const { service, manager, answers } = build();
    answers.claimSeats = updated([]);
    await expect(service.book('pax-1', 'trip-1', dto(), NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_SEATS_UNAVAILABLE' },
    });
    expect(sqlCalls(manager).some((call) => call.sql.includes('INSERT INTO "orders"'))).toBe(false);
  });

  it("shu qatnovda faol bandi bor — 409 INTERCITY_ALREADY_BOOKED, joy olinmaydi", async () => {
    const { service, manager, answers } = build();
    answers.existing = [{ id: 'order-0' }];
    await expect(service.book('pax-1', 'trip-1', dto(), NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_ALREADY_BOOKED' },
    });
    expect(sqlCalls(manager).some((call) => call.sql.includes('"seats_taken" = "seats_taken" +'))).toBe(false);
  });

  it("qoidaga zid so'rov — 400 INTERCITY_BOOKING_INVALID (reasons), tranzaksiya ochilmaydi", async () => {
    const { service, manager } = build();
    await expect(
      service.book('pax-1', 'trip-1', dto({ paymentMethod: PaymentMethod.CARD, seats: 9 }), NOW),
    ).rejects.toMatchObject({
      response: {
        code: 'INTERCITY_BOOKING_INVALID',
        reasons: [{ code: 'SEATS_OUT_OF_RANGE' }, { code: 'PAYMENT_METHOD_UNSUPPORTED' }],
      },
    });
    expect(manager.query).not.toHaveBeenCalled();
  });

  it("oldingi safardan qarz bor — rad (oddiy buyurtma bilan bir xil darvoza)", async () => {
    const { service, manager } = build({ debt: 12000 });
    await expect(service.book('pax-1', 'trip-1', dto(), NOW)).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it("qatnov topilmadi — 404 INTERCITY_TRIP_NOT_FOUND", async () => {
    const { service, tripRepository } = build();
    tripRepository.findOne.mockResolvedValueOnce(null as never);
    await expect(service.book('pax-1', 'trip-1', dto(), NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_TRIP_NOT_FOUND' },
    });
  });
});

describe('IntercityBookingsService.cancel', () => {
  it("bepul oynada: buyurtma bekor + joylar qaytadi, bitta tranzaksiyada, belgi yo'q", async () => {
    const { service, manager } = build();
    await service.cancel('pax-1', 'order-1', NOW);
    const calls = sqlCalls(manager);
    const cancel = calls.find((call) => call.sql.includes('UPDATE "orders"'));
    expect(cancel?.sql).toContain(`"status" = 'scheduled'`);
    expect(cancel?.params).toEqual(expect.arrayContaining(['order-1', 'pax-1', false]));
    const release = calls.find((call) => call.sql.includes('GREATEST("seats_taken"'));
    expect(release?.params).toEqual(['trip-1', 2, false, NOW]);
  });

  it("bekor qilingach haydovchiga xabar (bookingCancelled) — qaytgan joylar bilan", async () => {
    const { service, notifier } = build();
    await service.cancel('pax-1', 'order-1', NOW);
    expect(notifier.bookingCancelled).toHaveBeenCalledWith({
      tripId: 'trip-1',
      orderId: 'order-1',
      seats: 2,
      bookingKind: 'seat',
    });
  });

  it("jo'nashga 30 daqiqa qolganda — ruxsat, lekin kech bekor qilish belgisi yoziladi", async () => {
    const { service, manager } = build();
    await service.cancel('pax-1', 'order-1', new Date('2026-10-20T06:30:00.000Z'));
    const cancel = sqlCalls(manager).find((call) => call.sql.includes('UPDATE "orders"'));
    expect(cancel?.params).toEqual(expect.arrayContaining([true]));
  });

  it("butun mashina bandi — bayroq ham tozalanadi", async () => {
    const { service, manager, answers } = build();
    answers.cancelOrder = updated([{ intercity_trip_id: 'trip-1', seats: 4, booking_kind: 'whole_car', scheduled_at: DEPARTURE }]);
    await service.cancel('pax-1', 'order-1', NOW);
    const release = sqlCalls(manager).find((call) => call.sql.includes('GREATEST("seats_taken"'));
    expect(release?.params).toEqual(['trip-1', 4, true, NOW]);
  });

  it("yig'ish boshlangan (buyurtma endi SCHEDULED emas) — 409 INTERCITY_BOOKING_NOT_CANCELLABLE", async () => {
    const { service, answers, orderRepository } = build();
    answers.cancelOrder = updated([]);
    orderRepository.findOne.mockResolvedValueOnce({ id: 'order-1', status: OrderStatus.ACCEPTED } as never);
    await expect(service.cancel('pax-1', 'order-1', NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_BOOKING_NOT_CANCELLABLE' },
    });
  });

  it("begona yoki yo'q band — 404 INTERCITY_BOOKING_NOT_FOUND", async () => {
    const { service, answers, orderRepository } = build();
    answers.cancelOrder = updated([]);
    orderRepository.findOne.mockResolvedValueOnce(null as never);
    await expect(service.cancel('pax-1', 'order-1', NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_BOOKING_NOT_FOUND' },
    });
  });
});

describe('IntercityBookingsService.listMine', () => {
  it("jo'nashga 4 soat bor — haydovchi telefoni yashirin", async () => {
    const { service } = build();
    const page = await service.listMine('pax-1', {}, NOW);
    expect(page.items[0]).toMatchObject({ orderId: 'order-1', driverPhone: null });
  });

  it("jo'nashga 30 daqiqa qolgan — telefon ochiq", async () => {
    const { service } = build();
    const page = await service.listMine('pax-1', {}, new Date('2026-10-20T06:30:00.000Z'));
    expect(page.items[0].driverPhone).toBe('+998901112233');
  });
});

describe('IntercityBookingsService.listForManage', () => {
  it("qatnov bandlari yo'lovchi telefoni bilan, yaratilish tartibida", async () => {
    const { service, orderRepository } = build();
    const items = await service.listForManage('trip-1');

    expect(items).toEqual([
      expect.objectContaining({ orderId: 'order-1', passenger: { name: 'Jasur', phone: '+998901234567' }, seats: 2 }),
    ]);
    const [options] = orderRepository.find.mock.calls[0] as unknown as [
      { where: Record<string, unknown>; order: Record<string, string>; relations: Record<string, unknown> },
    ];
    expect(options.where).toMatchObject({ intercityTripId: 'trip-1' });
    expect(options.order).toEqual({ createdAt: 'ASC' });
    expect(options.relations).toMatchObject({ passenger: true });
  });

  it('qatnov topilmasa — 404 INTERCITY_TRIP_NOT_FOUND', async () => {
    const { service, tripRepository } = build();
    tripRepository.findOne.mockResolvedValueOnce(null as never);
    await expect(service.listForManage('missing')).rejects.toMatchObject({
      response: { code: 'INTERCITY_TRIP_NOT_FOUND' },
    });
  });

  it("flag o'chiq — 404", async () => {
    const { service } = build({ enabled: false });
    await expect(service.listForManage('trip-1')).rejects.toMatchObject({ response: { code: 'INTERCITY_DISABLED' } });
  });
});

describe('IntercityBookingsService.cancelForManage', () => {
  it("dispetcher: joylar qaytadi, kech bekor qilish belgisi QO'YILMAYDI, sabab yoziladi, ikkala tomonga xabar", async () => {
    const { service, manager, notifier } = build();
    await service.cancelForManage('order-1', 'Haydovchi kasal', new Date('2026-10-20T06:30:00.000Z'));

    const calls = sqlCalls(manager);
    const cancel = calls.find((call) => call.sql.includes('UPDATE "orders"'));
    // Jo'nashga 30 daqiqa qolgan bo'lsa ham — yo'lovchi aybdor emas.
    expect(cancel?.params).toEqual(expect.arrayContaining(['order-1', false]));
    expect(cancel?.params?.some((param) => String(param).includes('Haydovchi kasal'))).toBe(true);
    expect(calls.some((call) => call.sql.includes('GREATEST("seats_taken"'))).toBe(true);
    expect(notifier.bookingCancelled).toHaveBeenCalledWith(expect.objectContaining({ tripId: 'trip-1', orderId: 'order-1' }));
    expect(notifier.bookingCancelledByDispatcher).toHaveBeenCalledWith('pax-1', 'trip-1', 'order-1', 'Haydovchi kasal');
  });

  it("yig'ish boshlangan band — 409 INTERCITY_BOOKING_NOT_CANCELLABLE", async () => {
    const { service, orderRepository, notifier } = build();
    orderRepository.findOne.mockResolvedValueOnce({ id: 'order-1', status: OrderStatus.ACCEPTED, passengerId: 'pax-1' } as never);
    await expect(service.cancelForManage('order-1', 'x', NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_BOOKING_NOT_CANCELLABLE' },
    });
    expect(notifier.bookingCancelled).not.toHaveBeenCalled();
  });

  it("yo'q band — 404", async () => {
    const { service, orderRepository } = build();
    orderRepository.findOne.mockResolvedValueOnce(null as never);
    await expect(service.cancelForManage('order-x', 'x', NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_BOOKING_NOT_FOUND' },
    });
  });
});
