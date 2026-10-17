import { IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { IntercityRoutePlanService } from './intercity-route-plan.service';

const angren = { id: 'p-angren', name: 'Angren', centerLat: 40.0956, centerLng: 70.9432, radiusKm: 12 };
const rohat = { id: 'p-rohat', name: 'Rohat krugi', centerLat: 41.268028, centerLng: 69.366806, radiusKm: 1.5 };

function build(status: IntercityTripStatus, options: { enabled?: boolean; rows?: unknown[]; own?: boolean } = {}) {
  const settings = { isIntercityEnabled: jest.fn(async () => options.enabled ?? true) };
  const driverRepository = { findOne: jest.fn(async () => ({ id: 'driver-1', userId: 'user-1' })) };
  const tripRepository = {
    findOne: jest.fn(async () =>
      options.own === false
        ? null
        : { id: 'trip-1', driverId: 'driver-1', status, route: { originPoint: angren, destinationPoint: rohat } },
    ),
  };
  const dataSource = {
    query: jest.fn(async () =>
      options.rows ?? [
        { id: 'o1', address: 'Toshkent, Yunusobod 4', lat: '41.36', lng: '69.29' },
        { id: 'o2', address: 'Toshkent, Mirzo Ulug‘bek', lat: '41.33', lng: '69.33' },
      ],
    ),
  };
  const detour = {
    plan: jest.fn(async (_side: string, _point: unknown, stops: Array<{ id: string }>) => ({
      stops: [...stops].reverse().map((stop, i) => ({ id: stop.id, etaMinutesFromPrev: i === 0 ? 9 : 6 })),
      terminalEtaMinutes: _side === 'pickup' ? 12 : null,
      totalMinutes: 15,
      optimized: true,
    })),
  };
  const service = new IntercityRoutePlanService(
    settings as never,
    driverRepository as never,
    tripRepository as never,
    dataSource as never,
    detour as never,
  );
  return { service, detour, dataSource };
}

describe('IntercityRoutePlanService', () => {
  it("yo'lda: manzil nuqtasidan tushirish tartibi, raqamlangan", async () => {
    const { service, detour, dataSource } = build(IntercityTripStatus.IN_PROGRESS);
    const plan = await service.planForDriver('user-1', 'trip-1');

    expect(detour.plan).toHaveBeenCalledWith(
      'dropoff',
      { lat: rohat.centerLat, lng: rohat.centerLng },
      [
        { id: 'o1', lat: 41.36, lng: 69.29 },
        { id: 'o2', lat: 41.33, lng: 69.33 },
      ],
      undefined,
    );
    expect(String((dataSource.query.mock.calls as unknown[][])[0][0])).toContain('dropoff_location');
    expect(plan).toEqual({
      phase: 'dropoff',
      point: { name: 'Rohat krugi', lat: rohat.centerLat, lng: rohat.centerLng },
      stops: [
        { sequence: 1, orderId: 'o2', kind: 'dropoff', address: 'Toshkent, Mirzo Ulug‘bek', lat: 41.33, lng: 69.33, etaMinutesFromPrev: 9 },
        { sequence: 2, orderId: 'o1', kind: 'dropoff', address: 'Toshkent, Yunusobod 4', lat: 41.36, lng: 69.29, etaMinutesFromPrev: 6 },
      ],
      terminalEtaMinutes: null,
      totalMinutes: 15,
      optimized: true,
    });
  });

  it("yig'ish: olish tartibi boshlanish nuqtasida tugaydi, haydovchi joyidan", async () => {
    const { service, detour } = build(IntercityTripStatus.BOARDING);
    const plan = await service.planForDriver('user-1', 'trip-1', { lat: 40.11, lng: 70.96 });
    expect(detour.plan).toHaveBeenCalledWith('pickup', { lat: angren.centerLat, lng: angren.centerLng }, expect.any(Array), {
      lat: 40.11,
      lng: 70.96,
    });
    expect(plan.phase).toBe('pickup');
    expect(plan.point.name).toBe('Angren');
    expect(plan.stops[0].kind).toBe('pickup');
    expect(plan.terminalEtaMinutes).toBe(12);
  });

  it("yakunlangan qatnov — bo'sh reja, hisob yo'q", async () => {
    const { service, detour } = build(IntercityTripStatus.COMPLETED);
    await expect(service.planForDriver('user-1', 'trip-1')).resolves.toMatchObject({ phase: 'done', stops: [] });
    expect(detour.plan).not.toHaveBeenCalled();
  });

  it("begona qatnov — 404, o'chiq — 404 INTERCITY_DISABLED", async () => {
    await expect(build(IntercityTripStatus.OPEN, { own: false }).service.planForDriver('user-1', 'trip-1')).rejects.toMatchObject({
      response: { code: 'INTERCITY_TRIP_NOT_FOUND' },
    });
    await expect(build(IntercityTripStatus.OPEN, { enabled: false }).service.planForDriver('user-1', 'trip-1')).rejects.toMatchObject({
      response: { code: 'INTERCITY_DISABLED' },
    });
  });
});

describe('IntercityRoutePlanService — SQL', () => {
  it("holat ustuni enum — text massiviga solishtirishdan oldin ::text (aks holda Postgres xatosi)", async () => {
    const settings = { isIntercityEnabled: jest.fn(async () => true) };
    const dataSource = { query: jest.fn(async () => []) };
    const service = new IntercityRoutePlanService(
      settings as never,
      { findOne: jest.fn(async () => ({ id: 'driver-1' })) } as never,
      {
        findOne: jest.fn(async () => ({
          id: 'trip-1',
          status: IntercityTripStatus.OPEN,
          route: { originPoint: angren, destinationPoint: rohat },
        })),
      } as never,
      dataSource as never,
      { plan: jest.fn(async () => ({ stops: [], terminalEtaMinutes: null, totalMinutes: 0, optimized: true })) } as never,
    );
    await service.planForDriver('user-1', 'trip-1');
    const [sql, params] = (dataSource.query.mock.calls as unknown[][])[0] as [string, unknown[]];
    expect(sql).toContain('o."status"::text = ANY($2::text[])');
    expect(params).toEqual(['trip-1', ['scheduled', 'accepted']]);
  });
});
