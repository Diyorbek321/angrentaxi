import { ConflictException, NotFoundException } from '@nestjs/common';
import { IntercityZoneSide } from '../../database/entities/intercity-trip-zone.entity';
import { IntercityZonesService } from './intercity-zones.service';

function build() {
  const zones = new Map<string, Record<string, unknown>>();
  const zoneRepository = {
    find: jest.fn(async () => [...zones.values()]),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => zones.get(where.id) ?? null),
    create: jest.fn((value: Record<string, unknown>) => value),
    save: jest.fn(async (value: Record<string, unknown>) => {
      const saved = { id: value.id ?? `z${zones.size + 1}`, ...value };
      zones.set(saved.id as string, saved);
      return saved;
    }),
  };
  const pointRepository = {
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => (where.id === 'p1' ? { id: 'p1' } : null)),
  };
  const tripZoneRepository = {
    find: jest.fn(async () => [] as unknown[]),
  };
  const service = new IntercityZonesService(zoneRepository as never, pointRepository as never, tripZoneRepository as never);
  return { service, zones, zoneRepository, tripZoneRepository };
}

describe('IntercityZonesService', () => {
  it("tuman yaratadi — nom tozalanadi, standartlar qo'yiladi", async () => {
    const { service } = build();
    await expect(
      service.create('p1', { name: '  Yunusobod ', centerLat: 41.365, centerLng: 69.288, radiusKm: 4 }),
    ).resolves.toMatchObject({ pointId: 'p1', name: 'Yunusobod', isActive: true, sortOrder: 0 });
  });

  it("nuqta yo'q — 404", async () => {
    const { service } = build();
    await expect(
      service.create('nope', { name: 'X', centerLat: 41, centerLng: 69, radiusKm: 4 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("bo'sh nom — kodlangan 400", async () => {
    const { service } = build();
    await expect(service.create('p1', { name: '   ', centerLat: 41, centerLng: 69, radiusKm: 4 })).rejects.toMatchObject({
      response: { code: 'INTERCITY_POINT_INVALID' },
    });
  });

  it('takroriy nom (23505) — 409', async () => {
    const { service, zoneRepository } = build();
    zoneRepository.save.mockRejectedValueOnce({ code: '23505' });
    await expect(
      service.create('p1', { name: 'Chilonzor', centerLat: 41.275, centerLng: 69.204, radiusKm: 4 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('yangilash birlashtirilgan natijani tekshiradi', async () => {
    const { service } = build();
    const created = await service.create('p1', { name: 'Sergeli', centerLat: 41.227, centerLng: 69.219, radiusKm: 4 });
    await expect(service.update(created.id, { radiusKm: 5, isActive: false })).resolves.toMatchObject({
      name: 'Sergeli',
      radiusKm: 5,
      isActive: false,
    });
    await expect(service.update(created.id, { name: '' })).rejects.toMatchObject({
      response: { code: 'INTERCITY_POINT_INVALID' },
    });
    await expect(service.update('missing', { radiusKm: 3 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("qatnov tumanlari tomon bo'yicha guruhlanadi", async () => {
    const { service, tripZoneRepository } = build();
    const zone = (id: string, name: string) => ({ id, name, centerLat: 41, centerLng: 69, radiusKm: 4 });
    tripZoneRepository.find.mockResolvedValueOnce([
      { tripId: 't1', side: IntercityZoneSide.DESTINATION, zone: zone('z1', 'Yunusobod') },
      { tripId: 't1', side: IntercityZoneSide.ORIGIN, zone: zone('z2', 'Chilonzor') },
      { tripId: 't2', side: IntercityZoneSide.DESTINATION, zone: zone('z3', 'Sergeli') },
    ]);
    const byTrip = await service.zonesOfTrips(['t1', 't2', 't3']);
    expect(byTrip.get('t1')).toEqual({
      origin: [zone('z2', 'Chilonzor')],
      destination: [zone('z1', 'Yunusobod')],
    });
    expect(byTrip.get('t2')?.origin).toEqual([]);
    expect(byTrip.get('t3')).toEqual({ origin: [], destination: [] });
  });

  it("bo'sh ro'yxat — bazaga so'rov yo'q", async () => {
    const { service, tripZoneRepository } = build();
    await expect(service.zonesOfTrips([])).resolves.toEqual(new Map());
    expect(tripZoneRepository.find).not.toHaveBeenCalled();
  });
});
