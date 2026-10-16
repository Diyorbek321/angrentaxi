import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  IntercityTripClass,
  IntercityTripStatus,
} from '../../database/entities/intercity-trip.entity';
import { IntercityTripsService } from './intercity-trips.service';

const NOW = new Date('2026-10-17T06:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DEPARTURE = new Date(NOW.getTime() + 3 * HOUR);

const SETTINGS = {
  intercityEnabled: true,
  intercityFreeCancelMinutes: 60,
  intercityMaxSeatsPerBooking: 4,
  intercityMinLeadMinutes: 30,
  intercityMaxAheadDays: 7,
};

const ROUTE = {
  id: 'route-1',
  originPointId: 'p-angren',
  destinationPointId: 'p-rohat',
  originPoint: { id: 'p-angren', name: 'Angren', isActive: true },
  destinationPoint: { id: 'p-rohat', name: 'Rohat krugi (Toshkent)', isActive: true },
  seatPrice: 25000,
  wholeCarPrice: 100000,
  comfortSeatPrice: 30000,
  comfortWholeCarPrice: 120000,
  seatsDefault: 4,
  isActive: true,
};

const DRIVER = {
  id: 'driver-1',
  userId: 'user-1',
  approvedTariffTier: 1,
  rating: 4.9,
  carModel: 'Cobalt',
  licensePlate: '10A123BC',
  carNumber: null,
  user: { id: 'user-1', firstName: 'Ali', phone: '+998901112233' },
};

const trip = (overrides: Record<string, unknown> = {}) => ({
  id: 'trip-1',
  routeId: 'route-1',
  route: ROUTE,
  driverId: 'driver-1',
  driver: DRIVER,
  tripClass: IntercityTripClass.START,
  departureAt: DEPARTURE,
  seatsTotal: 4,
  seatsTaken: 0,
  wholeCarBooked: false,
  status: IntercityTripStatus.OPEN,
  seatPrice: 25000,
  wholeCarPrice: 100000,
  cancelReason: null,
  ...overrides,
});

function build(options: { enabled?: boolean; existing?: Array<{ departureAt: Date }>; comfortTier?: number | null } = {}) {
  const tripRepository = {
    find: jest.fn(async () => options.existing ?? []),
    findOne: jest.fn(async () => trip()),
    findAndCount: jest.fn(async () => [[trip()], 1]),
    create: jest.fn((value: Record<string, unknown>) => value),
    save: jest.fn(async (value: Record<string, unknown>) => ({ id: 'trip-1', ...value })),
  };
  const routeRepository = { findOne: jest.fn(async () => ROUTE) };
  const driverRepository = { findOne: jest.fn(async () => DRIVER) };
  const tariffRepository = {
    findOne: jest.fn(async () =>
      options.comfortTier === null ? null : { tier: options.comfortTier ?? 3 },
    ),
  };
  // Haqiqiy TypeORM shakli: UPDATE ... RETURNING → `[rows, affected]`.
  const manager = { query: jest.fn(async () => [[{ id: 'trip-1' }], 1] as unknown) };
  const dataSource = { transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  const settings = {
    isIntercityEnabled: jest.fn(async () => options.enabled ?? true),
    getIntercitySettings: jest.fn(async () => SETTINGS),
  };
  const gate = { loadPublisher: jest.fn(async () => DRIVER) };
  const notifier = { tripCancelled: jest.fn(async () => undefined) };
  const service = new IntercityTripsService(
    tripRepository as never,
    routeRepository as never,
    driverRepository as never,
    tariffRepository as never,
    dataSource as never,
    settings as never,
    gate as never,
    notifier as never,
  );
  return { service, tripRepository, routeRepository, manager, gate, tariffRepository, notifier };
}

const publishDto = (overrides: Record<string, unknown> = {}) => ({
  routeId: 'route-1',
  departureAt: DEPARTURE.toISOString(),
  tripClass: IntercityTripClass.START,
  ...overrides,
});

describe('IntercityTripsService', () => {
  describe('flag', () => {
    it("o'chiq bo'lsa hamma amal 404 INTERCITY_DISABLED", async () => {
      const { service } = build({ enabled: false });
      const disabled = { response: { code: 'INTERCITY_DISABLED' } };
      await expect(service.publish('user-1', publishDto() as never, NOW)).rejects.toMatchObject(disabled);
      await expect(service.search('route-1', '2026-10-17', NOW)).rejects.toMatchObject(disabled);
      await expect(service.getPublic('trip-1', NOW)).rejects.toMatchObject(disabled);
      await expect(service.listMine('user-1', {})).rejects.toMatchObject(disabled);
      await expect(service.cancelByDriver('user-1', 'trip-1', 'x', NOW)).rejects.toMatchObject(disabled);
      await expect(service.listForManage({})).rejects.toMatchObject(disabled);
    });
  });

  describe('publish', () => {
    it("narx yo'nalishdan nusxalanadi, darvoza tekshiradi", async () => {
      const { service, tripRepository, gate } = build();
      const view = await service.publish('user-1', publishDto() as never, NOW);

      expect(gate.loadPublisher).toHaveBeenCalledWith('user-1', NOW);
      expect(tripRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: 'route-1',
          driverId: 'driver-1',
          tripClass: IntercityTripClass.START,
          seatsTotal: 4,
          seatPrice: 25000,
          wholeCarPrice: 100000,
          status: IntercityTripStatus.OPEN,
        }),
      );
      expect(view).toMatchObject({
        seatsLeft: 4,
        wholeCarAvailable: true,
        route: { origin: { name: 'Angren' }, destination: { name: 'Rohat krugi (Toshkent)' } },
        driver: { firstName: 'Ali', plate: '10A123BC' },
      });
      // Telefon ro'yxatga chiqmaydi.
      expect(JSON.stringify(view)).not.toContain('+998');
    });

    it("Comfort: darajasi yetarli haydovchi comfort narxini oladi", async () => {
      const { service, tripRepository, gate } = build();
      gate.loadPublisher.mockResolvedValueOnce({ ...DRIVER, approvedTariffTier: 3 });
      await service.publish('user-1', publishDto({ tripClass: IntercityTripClass.COMFORT }) as never, NOW);
      expect(tripRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ seatPrice: 30000, wholeCarPrice: 120000 }),
      );
    });

    it('Comfort darajasi taksi "Komfort" tarifidan olinadi (yo‘q bo‘lsa 3)', async () => {
      const { service, gate } = build({ comfortTier: null });
      gate.loadPublisher.mockResolvedValueOnce({ ...DRIVER, approvedTariffTier: 2 });
      await expect(
        service.publish('user-1', publishDto({ tripClass: IntercityTripClass.COMFORT }) as never, NOW),
      ).rejects.toMatchObject({ response: { code: 'INTERCITY_TRIP_INVALID' } });
    });

    it('qoidaga zid — 400 INTERCITY_TRIP_INVALID, sabablar bilan', async () => {
      const { service, tripRepository } = build();
      await expect(
        service.publish(
          'user-1',
          publishDto({ departureAt: new Date(NOW.getTime() + 10 * 60_000).toISOString(), seatsTotal: 9 }) as never,
          NOW,
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'INTERCITY_TRIP_INVALID',
          reasons: [{ code: 'DEPARTURE_TOO_SOON' }, { code: 'SEATS_OUT_OF_RANGE' }],
        },
      });
      expect(tripRepository.save).not.toHaveBeenCalled();
    });

    it("±3 soat ichida boshqa qatnov — 409 INTERCITY_TRIP_OVERLAP", async () => {
      const { service, tripRepository } = build({
        existing: [{ departureAt: new Date(DEPARTURE.getTime() + 2 * HOUR) }],
      });
      await expect(service.publish('user-1', publishDto() as never, NOW)).rejects.toMatchObject({
        response: { code: 'INTERCITY_TRIP_OVERLAP' },
      });
      expect(tripRepository.save).not.toHaveBeenCalled();
    });

    it("faol bo'lmagan yo'nalish — 404", async () => {
      const { service, routeRepository } = build();
      routeRepository.findOne.mockResolvedValueOnce(null as never);
      await expect(service.publish('user-1', publishDto() as never, NOW)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("nuqtasi faolsizlantirilgan yo'nalish — 404", async () => {
      const { service, routeRepository } = build();
      routeRepository.findOne.mockResolvedValueOnce({
        ...ROUTE,
        destinationPoint: { ...ROUTE.destinationPoint, isActive: false },
      } as never);
      await expect(service.publish('user-1', publishDto() as never, NOW)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it("Toshkent kuni bo'yicha, faqat ochiq va 5 daqiqadan keyingilar", async () => {
      const { service, tripRepository } = build();
      tripRepository.find.mockResolvedValueOnce([trip()] as never);
      const result = await service.search('route-1', '2026-10-17', NOW);

      expect(result).toHaveLength(1);
      const [{ where, order }] = tripRepository.find.mock.calls[0] as unknown as [
        { where: Record<string, unknown>; order: Record<string, string> },
      ];
      expect(where).toMatchObject({ routeId: 'route-1', status: IntercityTripStatus.OPEN });
      expect(order).toEqual({ departureAt: 'ASC' });
    });

    it("kun oralig'i yarim ochiq [boshi, oxiri): ertasi 00:00 dagi qatnov ikki kunda chiqmaydi", async () => {
      const { service, tripRepository } = build();
      tripRepository.find.mockResolvedValueOnce([] as never);
      await service.search('route-1', '2026-10-17', NOW);

      const [{ where }] = tripRepository.find.mock.calls[0] as unknown as [
        { where: { departureAt: { type: string; value: Array<{ type: string; value: Date }> } } },
      ];
      expect(where.departureAt.type).toBe('and');
      expect(where.departureAt.value.map((op) => op.type)).toEqual(['moreThanOrEqual', 'lessThan']);
      // Oxiri — ertasi Toshkent kunining 00:00 i (UTC 19:00), u KIRMAYDI.
      expect(where.departureAt.value[1].value).toEqual(new Date('2026-10-17T19:00:00.000Z'));
    });

    it("noto'g'ri sana — 400", async () => {
      const { service } = build();
      await expect(service.search('route-1', '2026-02-30', NOW)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('cancelByDriver', () => {
    it("o'z qatnovi bekor qilinadi va unga bog'langan bandlar ham — bitta tranzaksiyada", async () => {
      const { service, manager } = build();
      await service.cancelByDriver('user-1', 'trip-1', 'Mashina buzildi', NOW);

      const sqls = (manager.query.mock.calls as unknown[][]).map((call) => String(call[0]));
      expect(sqls[0]).toContain('UPDATE "intercity_trips"');
      expect(sqls[0]).toContain(`"status" IN ('open', 'full', 'boarding')`);
      expect(sqls[1]).toContain('UPDATE "orders"');
      expect(sqls[1]).toContain('"intercity_trip_id"');
      expect((manager.query.mock.calls[0] as unknown[])[1]).toEqual(
        expect.arrayContaining(['trip-1', 'driver-1', 'Mashina buzildi']),
      );
    });

    it("COMMIT'dan keyin bandi yopilgan yo'lovchilarga xabar (haydovchi sababi bilan)", async () => {
      const { service, manager, notifier } = build();
      manager.query
        .mockResolvedValueOnce([[{ id: 'trip-1' }], 1] as never)
        .mockResolvedValueOnce([[{ passenger_id: 'p1' }, { passenger_id: 'p2' }], 2] as never);
      await service.cancelByDriver('user-1', 'trip-1', 'Mashina buzildi', NOW);

      const ordersSql = String((manager.query.mock.calls[1] as unknown[])[0]);
      expect(ordersSql).toContain('RETURNING "passenger_id"');
      expect(notifier.tripCancelled).toHaveBeenCalledWith('trip-1', 'Mashina buzildi', ['p1', 'p2'], 'driver');
    });

    it("bekor qilib bo'lmasa xabar ham yo'q", async () => {
      const { service, manager, tripRepository, notifier } = build();
      manager.query.mockResolvedValueOnce([[], 0] as never);
      tripRepository.findOne.mockResolvedValueOnce(trip({ status: IntercityTripStatus.IN_PROGRESS }) as never);
      await expect(service.cancelByDriver('user-1', 'trip-1', 'x', NOW)).rejects.toBeDefined();
      expect(notifier.tripCancelled).not.toHaveBeenCalled();
    });

    it("yo'lga chiqqan qatnov — 409 INTERCITY_TRIP_NOT_CANCELLABLE", async () => {
      const { service, manager, tripRepository } = build();
      manager.query.mockResolvedValueOnce([[], 0] as never);
      tripRepository.findOne.mockResolvedValueOnce(trip({ status: IntercityTripStatus.IN_PROGRESS }) as never);
      await expect(service.cancelByDriver('user-1', 'trip-1', 'x', NOW)).rejects.toMatchObject({
        response: { code: 'INTERCITY_TRIP_NOT_CANCELLABLE' },
      });
    });

    it('begona yoki mavjud bo‘lmagan qatnov — 404', async () => {
      const { service, manager, tripRepository } = build();
      manager.query.mockResolvedValueOnce([[], 0] as never);
      tripRepository.findOne.mockResolvedValueOnce(null as never);
      await expect(service.cancelByDriver('user-1', 'trip-1', 'x', NOW)).rejects.toMatchObject({
        response: { code: 'INTERCITY_TRIP_NOT_FOUND' },
      });
    });
  });

  describe('listMine / listForManage', () => {
    it('sahifalangan', async () => {
      const { service } = build();
      await expect(service.listMine('user-1', { page: 2, limit: 10 })).resolves.toMatchObject({
        total: 1,
        page: 2,
        limit: 10,
        items: [{ id: 'trip-1' }],
      });
      await expect(service.listForManage({ status: IntercityTripStatus.OPEN })).resolves.toMatchObject({
        total: 1,
        page: 1,
      });
    });

    it("menejer ro'yxatida haydovchi telefoni va wholeCarBooked bor, haydovchining o'z ro'yxatida telefon yo'q", async () => {
      const { service } = build();
      const manage = await service.listForManage({});
      expect(manage.items[0]).toMatchObject({ wholeCarBooked: false, driver: { phone: '+998901112233' } });

      const mine = await service.listMine('user-1', {});
      expect(JSON.stringify(mine)).not.toContain('+998901112233');
    });

    it("menejer kun filtri ham yarim ochiq oraliq", async () => {
      const { service, tripRepository } = build();
      await service.listForManage({ date: '2026-10-17' });
      const [{ where }] = tripRepository.findAndCount.mock.calls[0] as unknown as [
        { where: { departureAt: { type: string; value: Array<{ type: string }> } } },
      ];
      expect(where.departureAt.value.map((op) => op.type)).toEqual(['moreThanOrEqual', 'lessThan']);
    });
  });
});
