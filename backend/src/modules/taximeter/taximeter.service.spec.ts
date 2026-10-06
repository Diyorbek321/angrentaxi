import { TaximeterService } from './taximeter.service';

const T0 = new Date('2026-10-06T10:00:00Z').getTime();
const row = (sec: number, dLat: number) => ({
  id: String(sec),
  orderId: 'order-1',
  lat: 41.0 + dLat,
  lng: 70.14,
  recordedAt: new Date(T0 + sec * 1000),
});

function build(rows: ReturnType<typeof row>[], matched: { distanceMeters: number } | null) {
  const trackRepository = { find: jest.fn(async () => rows), query: jest.fn(), insert: jest.fn() };
  const osrm = { matchTrace: jest.fn(async () => matched && { ...matched, durationSeconds: 0, geometry: [] }) };
  const service = new TaximeterService(trackRepository as never, osrm as never);
  return { service, trackRepository, osrm };
}

// Three points ~111 m apart: raw track ≈ 0.222 km.
const DRIVE = [row(0, 0), row(20, 0.001), row(40, 0.002)];

describe('TaximeterService.finalDistance', () => {
  it('prefers the road-matched distance and reports where the ride ended', async () => {
    const { service, osrm } = build(DRIVE, { distanceMeters: 260 });
    const result = await service.finalDistance('order-1');

    expect(result).toEqual({ distanceKm: 0.26, matched: true, endPoint: { lat: 41.002, lng: 70.14 } });
    // OSRM takes [lng, lat].
    expect((osrm.matchTrace.mock.calls[0] as unknown[][])[0][0]).toEqual([70.14, 41.0]);
  });

  it('falls back to the raw GPS track when matching fails', async () => {
    const { service } = build(DRIVE, null);
    const result = await service.finalDistance('order-1');
    expect(result.matched).toBe(false);
    expect(result.distanceKm).toBeCloseTo(0.222, 2);
  });

  it('a ride with no movement costs no distance and skips OSRM', async () => {
    const { service, osrm } = build([row(0, 0)], { distanceMeters: 999 });
    const result = await service.finalDistance('order-1');
    expect(result.distanceKm).toBe(0);
    expect(osrm.matchTrace).not.toHaveBeenCalled();
  });
});

describe('TaximeterService.recordForDriver', () => {
  it('writes only into the driver\'s in-progress metered order', async () => {
    const { service, trackRepository } = build([], null);
    await service.recordForDriver('driver-user-1', 41.01, 70.15);
    const [sql, params] = trackRepository.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("status = 'in_progress'");
    expect(sql).toContain('is_metered = true');
    expect(params).toEqual(['driver-user-1', 41.01, 70.15]);
  });
});
