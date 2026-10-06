import { BadRequestException, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdLinkType } from '../../database/entities/ad-banner.entity';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const AD_ID = '22222222-2222-4222-8222-222222222222';

function build(existing: Record<string, unknown> | null = null) {
  const adRepository = {
    find: jest.fn(async (_options?: unknown) => []),
    findOne: jest.fn(async () => existing),
    create: jest.fn((row: Record<string, unknown>) => row),
    save: jest.fn(async (row: Record<string, unknown>) => ({ id: AD_ID, ...row })),
    delete: jest.fn(async () => ({ affected: existing ? 1 : 0 })),
    increment: jest.fn(async () => ({ affected: existing ? 1 : 0 })),
  };
  const restaurantRepository = { exists: jest.fn(async () => true) };
  const storeRepository = { exists: jest.fn(async () => true) };
  const storage = { driver: 'local', put: jest.fn(), get: jest.fn() };
  const service = new AdsService(
    adRepository as never,
    restaurantRepository as never,
    storeRepository as never,
    storage as never,
  );
  return { service, adRepository, restaurantRepository, storeRepository, storage };
}

const file = (buffer = PNG) => ({ buffer, mimetype: 'image/png', size: buffer.length });

describe('AdsService.create', () => {
  it('stores the image under ads/ with the sniffed type and saves the banner', async () => {
    const { service, storage, adRepository } = build();
    await service.create({ title: 'Lavash', linkType: AdLinkType.NONE }, file());

    expect(storage.put).toHaveBeenCalledWith(
      expect.stringMatching(/^ads\/[0-9a-f-]{36}\.png$/),
      PNG,
      'image/png',
    );
    const saved = adRepository.save.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.imageKey).toBe((storage.put.mock.calls[0] as unknown[])[0]);
    expect(saved.linkTarget).toBeNull();
  });

  it('refuses a file whose bytes are not an image, even if declared image/png', async () => {
    const { service, storage } = build();
    await expect(
      service.create({ title: 'X' }, file(Buffer.from('%PDF-1.7 fake'))),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('only accepts https links', async () => {
    const { service } = build();
    await expect(
      service.create({ title: 'X', linkType: AdLinkType.URL, linkTarget: 'http://evil.uz' }, file()),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ title: 'X', linkType: AdLinkType.URL, linkTarget: 'javascript:alert(1)' }, file()),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ title: 'X', linkType: AdLinkType.URL, linkTarget: 'https://lavash.uz/menu' }, file()),
    ).resolves.toBeDefined();
  });

  it('requires an existing restaurant for a restaurant link', async () => {
    const { service, restaurantRepository } = build();
    await expect(
      service.create({ title: 'X', linkType: AdLinkType.RESTAURANT, linkTarget: 'not-a-uuid' }, file()),
    ).rejects.toBeInstanceOf(BadRequestException);

    restaurantRepository.exists.mockResolvedValueOnce(false);
    await expect(
      service.create({ title: 'X', linkType: AdLinkType.RESTAURANT, linkTarget: RESTAURANT_ID }, file()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('drops a stray target when the banner links nowhere', async () => {
    const { service, adRepository } = build();
    await service.create({ title: 'X', linkType: AdLinkType.NONE, linkTarget: 'https://x.uz' }, file());
    expect((adRepository.save.mock.calls[0][0] as Record<string, unknown>).linkTarget).toBeNull();
  });

  it('refuses an end date that is not after the start', async () => {
    const { service, storage } = build();
    await expect(
      service.create(
        { title: 'X', startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-10-01T00:00:00Z' },
        file(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });
});

describe('AdsService.update', () => {
  const current = {
    id: AD_ID,
    title: 'Old',
    linkType: AdLinkType.NONE,
    linkTarget: null,
    startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: null,
    isActive: true,
    sortOrder: 0,
  };

  it('validates the link against the merged values', async () => {
    const { service } = build({ ...current });
    await expect(service.update(AD_ID, { linkType: AdLinkType.URL })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('checks the end date against the stored start date', async () => {
    const { service } = build({ ...current });
    await expect(
      service.update(AD_ID, { endsAt: '2026-09-01T00:00:00Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('null clears the window', async () => {
    const { service, adRepository } = build({ ...current });
    await service.update(AD_ID, { startsAt: null });
    expect((adRepository.save.mock.calls[0][0] as Record<string, unknown>).startsAt).toBeNull();
  });

  it('404s for an unknown banner', async () => {
    const { service } = build(null);
    await expect(service.update(AD_ID, { title: 'New' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdsService counters', () => {
  it('counts an impression only for an active banner', async () => {
    const { service, adRepository } = build({ id: AD_ID });
    await service.recordImpression(AD_ID);
    expect(adRepository.increment).toHaveBeenCalledWith(
      { id: AD_ID, isActive: true },
      'impressions',
      1,
    );
  });

  it('404s a click on an unknown or switched-off banner', async () => {
    const { service } = build(null);
    await expect(service.recordClick(AD_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdsService.listActive', () => {
  it('asks only for active banners inside their window, in display order', async () => {
    const { service, adRepository } = build();
    const now = new Date('2026-10-06T12:00:00Z');
    await service.listActive(now);
    const options = adRepository.find.mock.calls[0][0] as unknown as {
      where: Array<Record<string, unknown>>;
      order: Record<string, string>;
      take: number;
    };
    // (startsAt null | <= now) × (endsAt null | > now) = 4 OR-branches, all active
    expect(options.where).toHaveLength(4);
    for (const branch of options.where) expect(branch.isActive).toBe(true);
    expect(options.order).toEqual({ sortOrder: 'ASC', createdAt: 'DESC' });
    expect(options.take).toBeGreaterThan(0);
  });
});

describe('AdsService.openImage', () => {
  it('returns null when the banner has no stored object', async () => {
    const { service, storage } = build({ id: AD_ID, imageKey: 'ads/33333333-3333-4333-8333-333333333333.png' });
    storage.get.mockResolvedValueOnce(null);
    await expect(service.openImage(AD_ID)).resolves.toBeNull();
  });

  it('never reads a key that is not ours', async () => {
    const { service, storage } = build({ id: AD_ID, imageKey: 'driver-documents/x.pdf' });
    await expect(service.openImage(AD_ID)).resolves.toBeNull();
    expect(storage.get).not.toHaveBeenCalled();
  });
});
