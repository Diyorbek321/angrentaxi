import { Readable } from 'stream';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { catalogImageKey, catalogImageMimeType } from './catalog-images';
import { MediaController } from './media.controller';
import type { ObjectStorage } from './object-storage';

const KEY = 'catalog/0b6f3a52-6f2c-5e0e-9d1a-2f1c4b7a9e10.jpg';

describe('catalogImageMimeType', () => {
  it.each([
    [KEY, 'image/jpeg'],
    ['catalog/0b6f3a52-6f2c-5e0e-9d1a-2f1c4b7a9e10.png', 'image/png'],
    ['catalog/0b6f3a52-6f2c-5e0e-9d1a-2f1c4b7a9e10.webp', 'image/webp'],
  ])('%s → %s', (key, mime) => {
    expect(catalogImageMimeType(key)).toBe(mime);
  });

  it.each([
    'ads/0b6f3a52-6f2c-5e0e-9d1a-2f1c4b7a9e10.jpg',
    'driver-documents/0b6f3a52-6f2c-5e0e-9d1a-2f1c4b7a9e10.jpg',
    'catalog/../driver-documents/x.jpg',
    'catalog/0b6f3a52-6f2c-5e0e-9d1a-2f1c4b7a9e10.pdf',
    'catalog/not-a-uuid.jpg',
  ])('rad etadi: %s', (key) => {
    expect(catalogImageMimeType(key)).toBeNull();
  });
});

describe('catalogImageKey', () => {
  it("bir xil urug'dan bir xil kalit — seed qayta ishga tushsa takrorlanmaydi", () => {
    expect(catalogImageKey('d-lagmon', '.jpg')).toBe(catalogImageKey('d-lagmon', '.jpg'));
    expect(catalogImageKey('d-lagmon', '.jpg')).not.toBe(catalogImageKey('d-manti', '.jpg'));
    expect(catalogImageMimeType(catalogImageKey('d-lagmon', '.jpg'))).toBe('image/jpeg');
  });
});

describe('MediaController', () => {
  function fakeRes() {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    } as unknown as Response;
    return { res, headers };
  }

  function storageWith(object: Buffer | null): ObjectStorage & { get: jest.Mock } {
    return {
      driver: 'local',
      put: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(async () =>
        object ? { stream: Readable.from(object), contentType: null, size: object.length } : null,
      ),
    };
  }

  it('katalog rasmini uzoq kesh bilan oqim qilib beradi', async () => {
    const storage = storageWith(Buffer.from('jpeg'));
    const controller = new MediaController(storage);
    const { res, headers } = fakeRes();
    const pipe = jest.fn();
    jest.spyOn(Readable.prototype, 'pipe').mockImplementation(pipe as never);

    await controller.catalogImage(KEY.slice('catalog/'.length), res);

    expect(storage.get).toHaveBeenCalledWith(KEY);
    expect(headers['Content-Type']).toBe('image/jpeg');
    expect(headers['Cache-Control']).toContain('immutable');
    expect(pipe).toHaveBeenCalledWith(res);
    jest.restoreAllMocks();
  });

  it("kalit shakli noto'g'ri bo'lsa omborga umuman murojaat qilmaydi", async () => {
    const storage = storageWith(Buffer.from('x'));
    const controller = new MediaController(storage);
    await expect(controller.catalogImage('..%2Fdriver-documents%2Fa.jpg', fakeRes().res)).rejects.toThrow(
      NotFoundException,
    );
    expect(storage.get).not.toHaveBeenCalled();
  });

  it("omborda fayl yo'q bo'lsa 404", async () => {
    const controller = new MediaController(storageWith(null));
    await expect(
      controller.catalogImage(KEY.slice('catalog/'.length), fakeRes().res),
    ).rejects.toThrow(NotFoundException);
  });
});
