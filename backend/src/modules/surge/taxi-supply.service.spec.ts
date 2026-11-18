import { TaxiSupplyService } from './taxi-supply.service';

/**
 * Surge taklifi — faqat HOZIR taksi buyurtmasini ola oladigan haydovchilar.
 * Ilgari `drivers:online` geo-to'plamidagi har bir a'zo sanalardi: kuryerlar,
 * yuk furgonlari, bloklangan va telefoni o'chgan (mavjudligi tugagan)
 * haydovchilar ham taksi taklifi bo'lib ko'rinardi.
 */
describe('TaxiSupplyService', () => {
  const hit = (id: string, lat = 40.14, lng = 69.12) => [id, [String(lng), String(lat)]];

  function build(opts: {
    hits: unknown[];
    presence: Array<string | null>;
    rows: Array<{ id: string; service_types: string[] | null }>;
  }) {
    const redis = {
      georadius: jest.fn().mockResolvedValue(opts.hits),
      mget: jest.fn().mockResolvedValue(opts.presence),
    };
    const driverRepository = { query: jest.fn().mockResolvedValue(opts.rows) };
    const service = new TaxiSupplyService(redis as never, driverRepository as never);
    return { service, redis, driverRepository };
  }

  it('returns positions of present, active, online taxi drivers only', async () => {
    const { service, redis, driverRepository } = build({
      hits: [hit('taxi'), hit('courier'), hit('stale'), hit('blocked'), hit('legacy', 40.15, 69.13)],
      presence: ['1', '1', null, '1', '1'],
      // `blocked` — SQL (u.status = 'active') uni qaytarmaydi.
      rows: [
        { id: 'taxi', service_types: ['taxi', 'cargo'] },
        { id: 'courier', service_types: ['food', 'market'] },
        // Bo'sh ro'yxat = taksi (migratsiya xavfsizligi, `resolveDriverServiceTypes`).
        { id: 'legacy', service_types: [] },
      ],
    });

    const positions = await service.positionsNear(40.14, 69.12, 2);

    expect(positions).toEqual([
      { lat: 40.14, lng: 69.12 },
      { lat: 40.15, lng: 69.13 },
    ]);
    expect(redis.georadius).toHaveBeenCalledWith('drivers:online', 69.12, 40.14, 2, 'km', 'WITHCOORD');
    expect(redis.mget).toHaveBeenCalledWith(
      'driver:presence:taxi',
      'driver:presence:courier',
      'driver:presence:stale',
      'driver:presence:blocked',
      'driver:presence:legacy',
    );
    const [sql, params] = driverRepository.query.mock.calls[0];
    expect(sql).toContain('is_online = true');
    expect(sql).toContain("u.status = 'active'");
    // Mavjudligi tugagan haydovchi DB'ga umuman so'ralmaydi.
    expect(params).toEqual([['taxi', 'courier', 'blocked', 'legacy']]);
  });

  it('skips the presence and DB reads when nobody is around', async () => {
    const { service, redis, driverRepository } = build({ hits: [], presence: [], rows: [] });

    await expect(service.positionsNear(40.14, 69.12, 2)).resolves.toEqual([]);
    expect(redis.mget).not.toHaveBeenCalled();
    expect(driverRepository.query).not.toHaveBeenCalled();
  });

  it('propagates a Redis failure (the caller reads it as "no data", not as an empty city)', async () => {
    const { service, redis } = build({ hits: [], presence: [], rows: [] });
    redis.georadius.mockRejectedValue(new Error('redis down'));

    await expect(service.positionsNear(40.14, 69.12, 2)).rejects.toThrow('redis down');
  });
});
