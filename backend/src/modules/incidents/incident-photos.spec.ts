import { IncidentPhotosStore, isIncidentPhotoKey } from './incident-photos';

describe('IncidentPhotosStore', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

  it('rasmni tarkib turidan saqlaydi, kalit tasodifiy uuid', async () => {
    const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn(), driver: 'local' };
    const key = await new IncidentPhotosStore(storage as never).save({ buffer: png, mimetype: 'image/jpeg', size: 10 });
    expect(key).toMatch(/^incident-photos\/[0-9a-f-]{36}\.png$/);
    expect(storage.put).toHaveBeenCalledWith(key, png, 'image/png');
  });

  it('PDF va noma\'lum tarkib rad etiladi', async () => {
    const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn(), driver: 'local' };
    const store = new IncidentPhotosStore(storage as never);
    await expect(store.save({ buffer: Buffer.from('%PDF-1.4'), mimetype: 'image/png', size: 8 })).rejects.toThrow();
    await expect(store.save({ buffer: Buffer.from('<html>'), mimetype: 'image/png', size: 6 })).rejects.toThrow();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('begona kalit ochilmaydi', async () => {
    const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn(), driver: 'local' };
    const store = new IncidentPhotosStore(storage as never);
    expect(isIncidentPhotoKey('driver-documents/a.jpg')).toBe(false);
    expect(isIncidentPhotoKey('incident-photos/../x.jpg')).toBe(false);
    await expect(store.open('driver-documents/x.jpg')).resolves.toBeNull();
    expect(storage.get).not.toHaveBeenCalled();
  });
});
