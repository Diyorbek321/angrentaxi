import { IntercityRequestStatus } from '../../database/entities/intercity-request.entity';
import { IntercityTripClass, IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { IntercityBookingKind } from '../../database/entities/order.entity';
import { agreedFareBreakdown } from '../tariffs/fare-breakdown';
import { IntercityRequestAcceptService } from './intercity-request-accept.service';

const NOW = new Date('2026-10-18T06:00:00.000Z');
const at = (minutes: number): Date => new Date(NOW.getTime() + minutes * 60_000);

const angren = { id: 'p-angren', name: 'Angren', centerLat: 40.0956, centerLng: 70.9432, radiusKm: 12, isActive: true };
const rohat = { id: 'p-rohat', name: 'Rohat krugi', centerLat: 41.268028, centerLng: 69.366806, radiusKm: 1.5, isActive: true };
const route = {
  id: 'route-1',
  originPoint: angren,
  destinationPoint: rohat,
  seatPrice: 25000,
  wholeCarPrice: 100000,
  comfortSeatPrice: 30000,
  comfortWholeCarPrice: 120000,
  seatsDefault: 4,
};

const requestRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  passengerId: 'pax-1',
  routeId: 'route-1',
  route,
  tripClass: IntercityTripClass.START,
  kind: IntercityBookingKind.SEAT,
  seats: 2,
  pickupLat: 40.0956,
  pickupLng: 70.9432,
  pickupAddress: 'Angren, Navoiy 12',
  dropoffLat: 41.268028,
  dropoffLng: 69.366806,
  dropoffAddress: 'Rohat krugi',
  windowStart: at(60),
  windowEnd: at(180),
  basePrice: 50000,
  bonus: 5000,
  fareBreakdown: agreedFareBreakdown(50000, 0, 120),
  status: IntercityRequestStatus.OPEN,
  ...overrides,
});

const tripRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'trip-1',
  routeId: 'route-1',
  driverId: 'driver-1',
  tripClass: IntercityTripClass.START,
  departureAt: at(90),
  status: IntercityTripStatus.OPEN,
  ...overrides,
});

const updated = (rows: unknown[]) => [rows, rows.length];

function build(
  options: {
    request?: Record<string, unknown>;
    trips?: Record<string, unknown>[];
    tier?: number;
    lockedBonus?: number | null;
    claim?: boolean;
    zoneOk?: boolean;
    lockedTrips?: { departure_at: Date }[];
  } = {},
) {
  const requestRepository = { findOne: jest.fn(async () => requestRow(options.request)) };
  const tripRepository = { find: jest.fn(async () => options.trips ?? []) };
  const tariffRepository = { findOne: jest.fn(async () => ({ id: 'tariff-intercity' })) };
  const manager = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM "intercity_requests"') && sql.includes('FOR UPDATE')) {
        return options.lockedBonus === null ? [] : [{ id: 'req-1', bonus: String(options.lockedBonus ?? 5000) }];
      }
      if (sql.includes('SELECT 1 FROM "intercity_trips"')) return [];
      if (sql.includes('pg_advisory_xact_lock')) return [];
      if (sql.includes('SELECT "departure_at" FROM "intercity_trips"')) return options.lockedTrips ?? [];
      if (sql.includes('SELECT "id" FROM "orders"')) return [];
      if (sql.includes('"seats_taken" = "seats_taken" +') || sql.includes('"whole_car_booked" = true')) {
        return options.claim === false ? updated([]) : updated([{ id: params?.[0], seats_taken: 2, seats_total: 4, status: 'open' }]);
      }
      if (sql.includes('INSERT INTO "orders"')) return [{ id: 'order-1' }];
      if (sql.includes('UPDATE "intercity_requests"')) return updated([{ id: 'req-1' }]);
      throw new Error(`unexpected SQL: ${sql}`);
    }),
    create: jest.fn((_entity: unknown, row: Record<string, unknown>) => row),
    save: jest.fn(async (_entity: unknown, row: Record<string, unknown>) => ({ ...row, id: 'trip-new' })),
  };
  const dataSource = { transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  const settings = {
    getIntercitySettings: jest.fn(async () => ({
      intercityEnabled: true,
      intercityMaxSeatsPerBooking: 4,
      intercityMinLeadMinutes: 30,
      intercityMaxAheadDays: 7,
      intercityMaxDetourMinutes: 15,
    })),
  };
  const gate = {
    loadPublisher: jest.fn(async () => ({ id: 'driver-1', userId: 'driver-user-1', approvedTariffTier: options.tier ?? 1 })),
  };
  const okFit = { zoneOk: true, outOfZone: null, detourChecked: true, detourMinutes: 0, detourTooLong: false };
  const fit = {
    check: jest.fn(async () =>
      options.zoneOk === false
        ? { ...okFit, zoneOk: false, outOfZone: { side: 'destination', zoneNames: ['Yunusobod'] } }
        : okFit,
    ),
  };
  const zones = { zonesOfTrip: jest.fn(async () => ({ origin: [], destination: [] })) };
  const notifier = {
    tripUpdated: jest.fn(async () => undefined),
    requestAccepted: jest.fn(async () => undefined),
  };
  const requests = { getView: jest.fn(async () => ({ id: 'req-1', status: IntercityRequestStatus.ACCEPTED })) };
  const trips = { resolveComfortTier: jest.fn(async () => 3) };
  const service = new IntercityRequestAcceptService(
    requestRepository as never,
    tripRepository as never,
    tariffRepository as never,
    dataSource as never,
    settings as never,
    gate as never,
    fit as never,
    zones as never,
    notifier as never,
    requests as never,
    trips as never,
  );
  return { service, manager, notifier, fit };
}

const sqlCalls = (manager: { query: jest.Mock }, fragment: string): unknown[][] =>
  (manager.query.mock.calls as unknown[][]).filter((call) => String(call[0]).includes(fragment));

const insertedFare = (manager: { query: jest.Mock }): { total: number; intercityBonus?: number } => {
  const [call] = sqlCalls(manager, 'INSERT INTO "orders"');
  return JSON.parse((call[1] as unknown[])[13] as string);
};

describe('IntercityRequestAcceptService.accept', () => {
  it("oraliqdagi mos qatnovga band tushadi — narx oshirish bilan, so'rov accepted", async () => {
    const { service, manager, notifier } = build({ trips: [tripRow()] });
    const result = await service.accept('driver-user-1', 'req-1', {}, NOW);
    expect(result).toMatchObject({ tripId: 'trip-1', orderId: 'order-1', tripCreated: false });
    expect(manager.save).not.toHaveBeenCalled();
    expect(insertedFare(manager)).toMatchObject({ total: 55000, intercityBonus: 5000 });
    const [accepted] = sqlCalls(manager, 'UPDATE "intercity_requests"');
    expect(accepted[1]).toEqual(['req-1', 'trip-1', 'order-1', NOW]);
    expect(notifier.requestAccepted).toHaveBeenCalledWith('req-1', 'pax-1', 'trip-1', 'order-1', at(90));
  });

  it('mos qatnov yo\'q — departureAt bilan yangi qatnov yaratiladi (yo\'nalish narxlari)', async () => {
    const { service, manager } = build();
    const result = await service.accept('driver-user-1', 'req-1', { departureAt: at(120).toISOString() }, NOW);
    expect(result).toMatchObject({ tripId: 'trip-new', tripCreated: true });
    expect(manager.save.mock.calls[0][1]).toMatchObject({
      routeId: 'route-1',
      driverId: 'driver-1',
      departureAt: at(120),
      seatsTotal: 4,
      seatPrice: 25000,
      wholeCarPrice: 100000,
      status: IntercityTripStatus.OPEN,
    });
  });

  it("boshqa yo'nalish/klass qatnovi mos emas — yangi qatnov kerak", async () => {
    const { service } = build({ trips: [tripRow({ routeId: 'route-2', departureAt: at(600) })] });
    await expect(service.accept('driver-user-1', 'req-1', {}, NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_REQUEST_INVALID' },
    });
  });

  it("jo'nash vaqti oraliqdan tashqarida — 400", async () => {
    const { service } = build();
    await expect(
      service.accept('driver-user-1', 'req-1', { departureAt: at(240).toISOString() }, NOW),
    ).rejects.toMatchObject({ response: { code: 'INTERCITY_REQUEST_INVALID' } });
  });

  it("±3 soat ichida boshqa (mos bo'lmagan) qatnov — 409 overlap", async () => {
    const { service } = build({ trips: [tripRow({ routeId: 'route-2', departureAt: at(100) })] });
    await expect(
      service.accept('driver-user-1', 'req-1', { departureAt: at(120).toISOString() }, NOW),
    ).rejects.toMatchObject({ response: { code: 'INTERCITY_TRIP_OVERLAP' } });
  });

  it("tanlangan qatnov so'rovga mos emas — 409", async () => {
    const { service } = build({ trips: [tripRow({ departureAt: at(300) })] });
    await expect(service.accept('driver-user-1', 'req-1', { tripId: 'trip-1' }, NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_TRIP_ACTION_NOT_ALLOWED' },
    });
  });

  it("boshqa haydovchi birinchi oldi (qulfdan keyin ochiq emas) — 409, band yozilmaydi", async () => {
    const { service, manager } = build({ trips: [tripRow()], lockedBonus: null });
    await expect(service.accept('driver-user-1', 'req-1', {}, NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_REQUEST_CLOSED' },
    });
    expect(sqlCalls(manager, 'INSERT INTO "orders"')).toHaveLength(0);
  });

  it("yo'lovchi qulfdan oldin narxni oshirgan — yangi summa bilan yoziladi", async () => {
    const { service, manager } = build({ trips: [tripRow()], lockedBonus: 8000 });
    await service.accept('driver-user-1', 'req-1', {}, NOW);
    expect(insertedFare(manager)).toMatchObject({ total: 58000, intercityBonus: 8000 });
  });

  it("qatnovda joy yo'q — 409", async () => {
    const { service } = build({ trips: [tripRow()], claim: false });
    await expect(service.accept('driver-user-1', 'req-1', {}, NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_SEATS_UNAVAILABLE' },
    });
  });

  it("manzil qatnov tumanlariga kirmaydi — 409", async () => {
    const { service } = build({ trips: [tripRow()], zoneOk: false });
    await expect(service.accept('driver-user-1', 'req-1', {}, NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_OUT_OF_ZONE' },
    });
  });

  it("Comfort so'rov, haydovchi darajasi past — 403", async () => {
    const { service } = build({ request: { tripClass: IntercityTripClass.COMFORT }, tier: 1 });
    await expect(
      service.accept('driver-user-1', 'req-1', { departureAt: at(120).toISOString() }, NOW),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("qulf ostida: parallel qabul ±3 soatlik qatnov yaratib ulgurgan — 409, qatnov yaratilmaydi", async () => {
    const { service, manager } = build({ lockedTrips: [{ departure_at: at(150) }] });
    await expect(
      service.accept('driver-user-1', 'req-1', { departureAt: at(120).toISOString() }, NOW),
    ).rejects.toMatchObject({ response: { code: 'INTERCITY_TRIP_OVERLAP' } });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it("haydovchi va yo'lovchi+qatnov qulflari olinadi (book bilan bir xil kalit)", async () => {
    const { service, manager } = build({ trips: [tripRow()] });
    await service.accept('driver-user-1', 'req-1', {}, NOW);
    const keys = sqlCalls(manager, 'pg_advisory_xact_lock').map((call) => (call[1] as unknown[])[0]);
    expect(keys).toEqual(['intercity-driver:driver-1', 'intercity-book:trip-1:pax-1']);
  });

  it("eskirgan so'rov — 409", async () => {
    const { service } = build({ request: { windowEnd: at(-1) } });
    await expect(service.accept('driver-user-1', 'req-1', {}, NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_REQUEST_CLOSED' },
    });
  });
});
