import { UnsupportedMediaTypeException } from '@nestjs/common';
import { CatalogImageService } from './catalog-image.service';
import { requireImage } from './catalog-images';
import { assertDeletableKey } from './object-storage';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const OLD = 'catalog/0b6f3a52-6f2c-5e0e-9d1a-2f1c4b7a9e10.jpg';
const file = (buffer: Buffer) => ({ buffer, mimetype: 'image/jpeg', size: buffer.length });

function setup(referenced = false) {
  const storage = {
    driver: 'local' as const,
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = { query: jest.fn().mockResolvedValue(referenced ? [{ '?column?': 1 }] : []) };
  const service = new CatalogImageService(storage, dataSource as never);
  return { service, storage, dataSource };
}

describe('CatalogImageService.replace', () => {
  it('yangi rasmni yozadi, qatorni saqlaydi, keyin eskisini o\'chiradi', async () => {
    const { service, storage } = setup();
    const order: string[] = [];
    storage.put.mockImplementation(async () => void order.push('put'));
    storage.delete.mockImplementation(async (key: string) => void order.push(`delete ${key}`));

    const saved = await service.replace(OLD, file(JPEG), async (key) => {
      order.push('persist');
      return { imageKey: key };
    });

    expect(saved.imageKey).toMatch(/^catalog\/[0-9a-f-]{36}\.jpg$/);
    expect(saved.imageKey).not.toBe(OLD);
    expect(order).toEqual(['put', 'persist', `delete ${OLD}`]);
  });

  it('qator saqlanmasa yangi fayl o\'chiriladi, eskisi qoladi', async () => {
    const { service, storage } = setup();
    await expect(
      service.replace(OLD, file(JPEG), async () => {
        throw new Error('db down');
      }),
    ).rejects.toThrow('db down');

    const newKey = storage.put.mock.calls[0][0];
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith(newKey);
  });

  it('rasm bo\'lmagan baytlarni rad etadi, hech narsa yozmaydi', async () => {
    const { service, storage } = setup();
    const persist = jest.fn();
    await expect(service.replace(OLD, file(Buffer.from('%PDF-1.4')), persist)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    expect(storage.put).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('eski rasm bo\'lmasa hech narsa o\'chirmaydi', async () => {
    const { service, storage } = setup();
    await service.replace(null, file(JPEG), async (key) => key);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe('CatalogImageService.discard', () => {
  it('boshqa qator hali ishlatayotgan faylni o\'chirmaydi', async () => {
    const { service, storage } = setup(true);
    await service.discard(OLD);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('catalog/ dan tashqari kalitga tegmaydi', async () => {
    const { service, storage, dataSource } = setup();
    await service.discard('driver-documents/x.jpg');
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('o\'chirish xatosini yutadi (sotuvchi uchun rasm baribir almashgan)', async () => {
    const { service, storage } = setup();
    storage.delete.mockRejectedValue(new Error('R2 down'));
    await expect(service.discard(OLD)).resolves.toBeUndefined();
  });
});

describe('CatalogImageService.clear', () => {
  it('avval qatorni tozalaydi, keyin faylni o\'chiradi', async () => {
    const { service, storage } = setup();
    const persist = jest.fn().mockResolvedValue('ok');
    await expect(service.clear(OLD, persist)).resolves.toBe('ok');
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(storage.delete.mock.invocationCallOrder[0]);
    expect(storage.delete).toHaveBeenCalledWith(OLD);
  });
});

describe('catalog/ prefiksi', () => {
  it('o\'chirishga ruxsat berilgan', () => {
    expect(() => assertDeletableKey(OLD)).not.toThrow();
  });
});

describe('requireImage', () => {
  it('fayl kelmasa 400', () => {
    expect(() => requireImage(undefined)).toThrow('Rasm yuborilmadi');
  });
});
