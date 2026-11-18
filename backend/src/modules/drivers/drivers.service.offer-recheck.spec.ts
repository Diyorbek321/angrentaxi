import { DriversService } from './drivers.service';

/**
 * `isStillOfferable` — partiyadagi 2-/3-haydovchiga taklif yuborishdan oldin
 * u hali ham bo'shligini tekshiradi (partiya ~30 s oldin tuzilgan bo'ladi).
 */
describe('DriversService.isStillOfferable', () => {
  function build(opts: { inGeo?: boolean; present?: boolean; busy?: boolean; redisFails?: boolean }) {
    const redis = {
      zscore: opts.redisFails
        ? jest.fn().mockRejectedValue(new Error('redis down'))
        : jest.fn().mockResolvedValue(opts.inGeo === false ? null : '123'),
      mget: jest.fn().mockResolvedValue([opts.present === false ? null : '1']),
      zrem: jest.fn().mockResolvedValue(1),
    };
    const driverRepository = {
      query: jest.fn().mockResolvedValue(opts.busy ? [{ driver_id: 'user-1' }] : []),
    };
    const service = new DriversService(
      driverRepository as never,
      {} as never,
      redis as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, redis, driverRepository };
  }

  it('onlayn, tirik va bo‘sh — true', async () => {
    await expect(build({}).service.isStillOfferable('row-1', 'user-1')).resolves.toBe(true);
  });

  it('geo-to‘plamdan chiqqan (oflayn bo‘lgan) — false, DB so‘rovisiz', async () => {
    const { service, driverRepository } = build({ inGeo: false });

    await expect(service.isStillOfferable('row-1', 'user-1')).resolves.toBe(false);
    expect(driverRepository.query).not.toHaveBeenCalled();
  });

  it('mavjudligi tugagan (telefoni o‘chgan) — false', async () => {
    await expect(build({ present: false }).service.isStillOfferable('row-1', 'user-1')).resolves.toBe(false);
  });

  it('shu orada boshqa safar olgan — false', async () => {
    await expect(build({ busy: true }).service.isStillOfferable('row-1', 'user-1')).resolves.toBe(false);
  });

  it('Redis xatosi — true (dispetcherlik to‘xtamaydi, qabul tekshiruvi himoya qiladi)', async () => {
    await expect(build({ redisFails: true }).service.isStillOfferable('row-1', 'user-1')).resolves.toBe(true);
  });
});
