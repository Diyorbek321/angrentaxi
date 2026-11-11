import { IntercityRequestStatus } from '../../database/entities/intercity-request.entity';
import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { IntercityBookingKind } from '../../database/entities/order.entity';
import { agreedFareBreakdown } from '../tariffs/fare-breakdown';
import { INTERCITY_REQUEST_REASONS } from './intercity-request-policy';
import { IntercityRequestsService } from './intercity-requests.service';

const NOW = new Date('2026-10-18T06:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const angren = { id: 'p-angren', name: 'Angren', centerLat: 40.0956, centerLng: 70.9432, radiusKm: 12, isActive: true };
const rohat = {
  id: 'p-rohat',
  name: 'Rohat krugi',
  centerLat: 41.268028,
  centerLng: 69.366806,
  radiusKm: 1.5,
  isActive: true,
  extensionMaxKm: 25,
  extensionPricePerKm: 2000,
  extensionComfortPricePerKm: 2500,
};

const routeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'route-1',
  originPointId: angren.id,
  destinationPointId: rohat.id,
  originPoint: angren,
  destinationPoint: rohat,
  seatPrice: 25000,
  wholeCarPrice: 100000,
  comfortSeatPrice: 30000,
  comfortWholeCarPrice: 120000,
  seatsDefault: 4,
  isActive: true,
  ...overrides,
});

const dto = (overrides: Record<string, unknown> = {}) => ({
  routeId: 'route-1',
  kind: IntercityBookingKind.SEAT,
  seats: 2,
  pickup: { lat: 40.0956, lng: 70.9432, address: 'Angren, Navoiy 12' },
  dropoff: { lat: 41.268028, lng: 69.366806, address: 'Rohat krugi' },
  windowStart: at(60),
  windowEnd: at(180),
  ...overrides,
});

const requestRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  passengerId: 'pax-1',
  routeId: 'route-1',
  route: routeRow(),
  tripClass: IntercityTripClass.START,
  kind: IntercityBookingKind.SEAT,
  seats: 2,
  pickupLat: 40.0956,
  pickupLng: 70.9432,
  pickupAddress: 'Angren, Navoiy 12',
  dropoffLat: 41.268028,
  dropoffLng: 69.366806,
  dropoffAddress: 'Rohat krugi',
  windowStart: new Date(at(60)),
  windowEnd: new Date(at(180)),
  basePrice: 50000,
  bonus: 0,
  fareBreakdown: agreedFareBreakdown(50000, 0, 120),
  status: IntercityRequestStatus.OPEN,
  tripId: null,
  orderId: null,
  createdAt: NOW,
  ...overrides,
});

const updated = (rows: unknown[]) => [rows, rows.length];

function build(options: { enabled?: boolean; route?: Record<string, unknown> | null; open?: boolean; debt?: number; tier?: number } = {}) {
  const requestRepository = {
    findOne: jest.fn(async (args: { where: Record<string, unknown> }) => {
      if (args.where.status === IntercityRequestStatus.OPEN) return options.open ? { id: 'req-old' } : null;
      return requestRow();
    }),
    findAndCount: jest.fn(async () => [[requestRow()], 1]),
    find: jest.fn(async () => [requestRow()]),
    create: jest.fn((row: Record<string, unknown>) => row),
    save: jest.fn(async (row: Record<string, unknown>) => ({ ...row, id: 'req-1' })),
  };
  const routeRepository = { findOne: jest.fn(async () => (options.route === null ? null : routeRow(options.route))) };
  const gate = { loadPublisher: jest.fn(async () => ({ id: 'driver-1', approvedTariffTier: options.tier ?? 1 })) };
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
  const dataSource = { query: jest.fn(async (..._args: unknown[]): Promise<unknown> => updated([{ id: 'req-1' }])) };
  const settings = {
    isIntercityEnabled: jest.fn(async () => options.enabled ?? true),
    getIntercitySettings: jest.fn(async () => ({
      intercityEnabled: options.enabled ?? true,
      intercityFreeCancelMinutes: 60,
      intercityMaxSeatsPerBooking: 4,
      intercityMinLeadMinutes: 30,
      intercityMaxAheadDays: 7,
      intercityMaxDetourMinutes: 15,
    })),
  };
  const pricer = {
    charge: jest.fn(async (side: 'pickup' | 'dropoff', point: { name: string }) => ({
      side,
      pointName: point.name,
      km: 8.4,
      pricePerKm: 2000,
      fare: 17_000,
      estimated: false,
    })),
  };
  const notifier = {
    requestCreated: jest.fn(async () => undefined),
    requestUpdated: jest.fn(async () => undefined),
    requestClosed: jest.fn(async () => undefined),
    requestExpired: jest.fn(async () => undefined),
  };
  const trips = { resolveComfortTier: jest.fn(async () => 3) };
  const service = new IntercityRequestsService(
    requestRepository as never,
    routeRepository as never,
    transactionRepository as never,
    dataSource as never,
    settings as never,
    pricer as never,
    notifier as never,
    trips as never,
    gate as never,
  );
  return { service, requestRepository, dataSource, notifier, pricer, gate };
}

const reasonCodes = async (promise: Promise<unknown>): Promise<string[]> => {
  try {
    await promise;
  } catch (err) {
    const body = (err as { getResponse: () => { reasons?: { code: string }[] } }).getResponse();
    return (body.reasons ?? []).map((r) => r.code);
  }
  throw new Error('expected rejection');
};

describe('IntercityRequestsService.create', () => {
  it("narx odatdagi band kabi (2 × 25 000), muzlatiladi va haydovchilarga e'lon qilinadi", async () => {
    const { service, requestRepository, notifier } = build();
    await service.create('pax-1', dto(), NOW);
    const saved = requestRepository.save.mock.calls[0][0];
    expect(saved).toMatchObject({ basePrice: 50000, bonus: 0, seats: 2, status: IntercityRequestStatus.OPEN });
    expect((saved.fareBreakdown as { total: number }).total).toBe(50000);
    expect(notifier.requestCreated).toHaveBeenCalled();
  });

  it("uyigacha: davom km haqi asosiy narxga qo'shiladi, oshirish alohida", async () => {
    const { service, requestRepository, pricer } = build();
    await service.create('pax-1', dto({ dropoff: { lat: 41.31, lng: 69.28, address: 'Chilonzor' }, bonus: 5000 }), NOW);
    expect(pricer.charge).toHaveBeenCalledWith('dropoff', expect.anything(), IntercityTripClass.START, expect.anything());
    expect(requestRepository.save.mock.calls[0][0]).toMatchObject({ basePrice: 67000, bonus: 5000 });
  });

  it("butun mashina — yo'nalish sig'imi, butun mashina narxi", async () => {
    const { service, requestRepository } = build();
    await service.create('pax-1', dto({ kind: IntercityBookingKind.WHOLE_CAR, seats: undefined }), NOW);
    expect(requestRepository.save.mock.calls[0][0]).toMatchObject({ basePrice: 100000, seats: 4 });
  });

  it("boshi o'tib ketgan oraliq hozirga suriladi", async () => {
    const { service, requestRepository } = build();
    await service.create('pax-1', dto({ windowStart: at(-20), windowEnd: at(90) }), NOW);
    expect(requestRepository.save.mock.calls[0][0].windowStart).toEqual(NOW);
  });

  it("noto'g'ri oraliq — 400, sabablar bilan", async () => {
    const { service } = build();
    await expect(reasonCodes(service.create('pax-1', dto({ windowStart: at(60), windowEnd: at(70) }), NOW))).resolves.toEqual([
      INTERCITY_REQUEST_REASONS.windowTooShort,
    ]);
  });

  it("Comfort yo'q yo'nalish — 400", async () => {
    const { service } = build({ route: { comfortSeatPrice: null, comfortWholeCarPrice: null } });
    await expect(reasonCodes(service.create('pax-1', dto({ tripClass: IntercityTripClass.COMFORT }), NOW))).resolves.toEqual([
      INTERCITY_REQUEST_REASONS.comfortNotOffered,
    ]);
  });

  it('asosiy narxdan katta oshirish — 400', async () => {
    const { service } = build();
    await expect(reasonCodes(service.create('pax-1', dto({ bonus: 60000 }), NOW))).resolves.toEqual([
      INTERCITY_REQUEST_REASONS.bonusTooHigh,
    ]);
  });

  it("ochiq so'rov bor — 409", async () => {
    const { service, requestRepository } = build({ open: true });
    await expect(service.create('pax-1', dto(), NOW)).rejects.toMatchObject({ response: { code: 'INTERCITY_REQUEST_ALREADY_OPEN' } });
    expect(requestRepository.save).not.toHaveBeenCalled();
  });

  it('parallel ikkinchi so\'rov (unique indeks) — 409', async () => {
    const { service, requestRepository } = build();
    requestRepository.save.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(service.create('pax-1', dto(), NOW)).rejects.toMatchObject({ response: { code: 'INTERCITY_REQUEST_ALREADY_OPEN' } });
  });

  it("qarzi bor yo'lovchi — 400", async () => {
    const { service } = build({ debt: 5000 });
    await expect(service.create('pax-1', dto(), NOW)).rejects.toThrow(/unpaid balance/);
  });

  it("o'chiq — 404", async () => {
    const { service } = build({ enabled: false });
    await expect(service.create('pax-1', dto(), NOW)).rejects.toMatchObject({ response: { code: 'INTERCITY_DISABLED' } });
  });
});

describe('IntercityRequestsService — oshirish va bekor qilish', () => {
  it('oshirish: shartli UPDATE, doska yangilanadi', async () => {
    const { service, dataSource, notifier } = build();
    await service.raiseBonus('pax-1', 'req-1', 5000, NOW);
    const [sql, params] = dataSource.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain(`"status" = 'open'`);
    expect(sql).toContain('"bonus" < $3');
    expect(params).toEqual(['req-1', 'pax-1', 5000, NOW]);
    expect(notifier.requestUpdated).toHaveBeenCalled();
  });

  it('oshirish: shu lahzada qabul qilindi (0 qator) — 409, haqiqiy holat bilan', async () => {
    const { service, dataSource, requestRepository } = build();
    dataSource.query.mockResolvedValueOnce(updated([]));
    requestRepository.findOne
      .mockResolvedValueOnce(requestRow())
      .mockResolvedValueOnce(requestRow({ status: IntercityRequestStatus.EXPIRED }));
    await expect(service.raiseBonus('pax-1', 'req-1', 5000, NOW)).rejects.toMatchObject({
      response: { code: 'INTERCITY_REQUEST_CLOSED', details: { status: IntercityRequestStatus.EXPIRED } },
    });
  });

  it("oshirish: parallel kattaroq oshirish o'tib ketdi — 400 (pasaytirish emas)", async () => {
    const { service, dataSource, requestRepository } = build();
    dataSource.query.mockResolvedValueOnce(updated([]));
    requestRepository.findOne.mockResolvedValueOnce(requestRow()).mockResolvedValueOnce(requestRow({ bonus: 8000 }));
    await expect(reasonCodes(service.raiseBonus('pax-1', 'req-1', 5000, NOW))).resolves.toEqual([
      INTERCITY_REQUEST_REASONS.bonusNotHigher,
    ]);
  });

  it('pasaytirish — 400', async () => {
    const { service, requestRepository } = build();
    requestRepository.findOne.mockResolvedValueOnce(requestRow({ bonus: 5000 }));
    await expect(reasonCodes(service.raiseBonus('pax-1', 'req-1', 3000, NOW))).resolves.toEqual([
      INTERCITY_REQUEST_REASONS.bonusNotHigher,
    ]);
  });

  it('bekor: doskadan olib tashlanadi; yopilgan so\'rov — 409', async () => {
    const { service, dataSource, notifier } = build();
    await service.cancel('pax-1', 'req-1', NOW);
    expect(notifier.requestClosed).toHaveBeenCalledWith('req-1', IntercityRequestStatus.CANCELLED);
    dataSource.query.mockResolvedValueOnce(updated([]));
    await expect(service.cancel('pax-1', 'req-1', NOW)).rejects.toMatchObject({ response: { code: 'INTERCITY_REQUEST_CLOSED' } });
  });
});

describe('IntercityRequestsService.quote', () => {
  it("noto'g'ri oshirish narxda ko'rsatilmaydi — 400", async () => {
    const { service } = build();
    await expect(reasonCodes(service.quote(dto({ bonus: 2500 })))).resolves.toEqual([INTERCITY_REQUEST_REASONS.bonusStep]);
  });
});

describe('IntercityRequestsService.board', () => {
  it("doska — qabul qilish bilan bir xil darvoza (bloklangan haydovchi manzillarni ko'rmaydi)", async () => {
    const { service, gate, requestRepository } = build();
    gate.loadPublisher.mockRejectedValueOnce(Object.assign(new Error('blocked'), { status: 403 }));
    await expect(service.board('driver-user-1', {}, NOW)).rejects.toThrow('blocked');
    expect(requestRepository.find).not.toHaveBeenCalled();
  });

  const classesQueried = (find: jest.Mock): unknown =>
    (find.mock.calls[0][0] as { where: { tripClass: { value: unknown } } }).where.tripClass.value;

  it("Comfort darajasiz haydovchi faqat Start so'rovlarni ko'radi", async () => {
    const { service, requestRepository } = build({ tier: 1 });
    await service.board('driver-user-1', {}, NOW);
    expect(classesQueried(requestRepository.find)).toEqual([IntercityTripClass.START]);
  });

  it('Comfort haydovchi — ikkala klass', async () => {
    const { service, requestRepository } = build({ tier: 3 });
    await service.board('driver-user-1', {}, NOW);
    expect(classesQueried(requestRepository.find)).toEqual([IntercityTripClass.START, IntercityTripClass.COMFORT]);
  });

  it("ko'rinishda yo'lovchi ismi va telefoni yo'q", async () => {
    const { service } = build();
    const [view] = await service.board('driver-user-1', {}, NOW);
    expect(view).not.toHaveProperty('passengerPhone');
    expect(view).toMatchObject({ originName: 'Angren', destinationName: 'Rohat krugi', total: 50000, maxBonus: 50000 });
  });
});

describe('IntercityRequestsService.expireDue', () => {
  it('eskirganlarning har biri uchun yo\'lovchiga xabar', async () => {
    const { service, dataSource, notifier } = build();
    dataSource.query.mockResolvedValueOnce(
      updated([
        { id: 'req-1', passenger_id: 'pax-1' },
        { id: 'req-2', passenger_id: 'pax-2' },
      ]),
    );
    await expect(service.expireDue(NOW)).resolves.toBe(2);
    expect(notifier.requestExpired).toHaveBeenCalledWith('req-2', 'pax-2');
    expect(String((dataSource.query.mock.calls as unknown[][])[0][0])).toContain(`"window_end" <= $1`);
  });
});
