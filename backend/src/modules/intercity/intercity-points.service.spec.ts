import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityPointsService } from './intercity-points.service';

const existingPoint = (overrides: Partial<IntercityPoint> = {}): IntercityPoint =>
  ({
    id: 'p1',
    name: 'Rohat krugi',
    centerLat: 41.268028,
    centerLng: 69.366806,
    radiusKm: 1.5,
    extensionMaxKm: 30,
    extensionPricePerKm: 2000,
    extensionComfortPricePerKm: 2500,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as IntercityPoint;

function makeService(found: IntercityPoint | null = existingPoint()) {
  const repo = {
    find: jest.fn(),
    findOne: jest.fn().mockResolvedValue(found),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'new', ...value })),
  };
  return { service: new IntercityPointsService(repo as never), repo };
}

describe('IntercityPointsService — shahar ichiga davom', () => {
  it('create: davomsiz nuqta — standart 0/null', async () => {
    const { service, repo } = makeService();
    await service.create({ name: ' Angren ', centerLat: 40.0956, centerLng: 70.9432, radiusKm: 12 });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Angren',
        extensionMaxKm: 0,
        extensionPricePerKm: 0,
        extensionComfortPricePerKm: null,
      }),
    );
  });

  it('create: Rohat qiymatlari saqlanadi', async () => {
    const { service, repo } = makeService();
    await service.create({
      name: 'Rohat krugi',
      centerLat: 41.268028,
      centerLng: 69.366806,
      radiusKm: 1.5,
      extensionMaxKm: 30,
      extensionPricePerKm: 2000,
      extensionComfortPricePerKm: 2500,
    });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ extensionMaxKm: 30, extensionPricePerKm: 2000, extensionComfortPricePerKm: 2500 }),
    );
  });

  it('create: davom yoqilgan, km narxi yo\'q — 400 INTERCITY_POINT_INVALID, saqlanmaydi', async () => {
    const { service, repo } = makeService();
    await expect(
      service.create({ name: 'X', centerLat: 41, centerLng: 69, radiusKm: 1.5, extensionMaxKm: 30 }),
    ).rejects.toMatchObject({ response: { code: 'INTERCITY_POINT_INVALID' } });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('update: qoida birlashtirilgan natijaga — radiusni davomdan katta qilish rad etiladi', async () => {
    const { service, repo } = makeService(existingPoint({ extensionMaxKm: 5 }));
    await expect(service.update('p1', { radiusKm: 10 })).rejects.toMatchObject({
      response: { code: 'INTERCITY_POINT_INVALID' },
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('update: Comfort narxini null qilish mumkin', async () => {
    const { service, repo } = makeService();
    await service.update('p1', { extensionComfortPricePerKm: null });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ extensionComfortPricePerKm: null }));
  });
});
