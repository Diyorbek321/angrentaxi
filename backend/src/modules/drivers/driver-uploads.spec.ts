import { UnsupportedMediaTypeException } from '@nestjs/common';
import {
  DriverUploadsStore,
  driverUploadKey,
  sniffDriverUploadMime,
} from './driver-uploads';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
const PDF = Buffer.from('%PDF-1.7\n');

describe('sniffDriverUploadMime', () => {
  it.each([
    [JPEG, 'image/jpeg'],
    [PNG, 'image/png'],
    [WEBP, 'image/webp'],
    [PDF, 'application/pdf'],
  ])('detects %#', (buffer, mime) => {
    expect(sniffDriverUploadMime(buffer)).toBe(mime);
  });

  it('rejects HTML dressed up as an image', () => {
    expect(sniffDriverUploadMime(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffDriverUploadMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('driverUploadKey', () => {
  it('maps a stored fileUrl to its bucket key', () => {
    expect(driverUploadKey('/uploads/driver-documents/abc-123.jpg')).toBe(
      'driver-documents/abc-123.jpg',
    );
  });

  it.each([null, undefined, '', '/etc/passwd', '../../.env', 'a/b/..', 'x/evil name.jpg'])(
    'refuses %p',
    (fileUrl) => {
      expect(driverUploadKey(fileUrl as string)).toBeNull();
    },
  );
});

describe('DriverUploadsStore.save', () => {
  const storage = { driver: 'local' as const, put: jest.fn(), get: jest.fn(), delete: jest.fn() };
  const store = new DriverUploadsStore(storage);

  beforeEach(() => jest.clearAllMocks());

  it('stores under a random name whose extension comes from the content', async () => {
    // Client claims PNG, bytes are JPEG — the bytes win.
    const fileUrl = await store.save({ buffer: JPEG, mimetype: 'image/png', size: JPEG.length });

    expect(fileUrl).toMatch(/^\/uploads\/driver-documents\/[0-9a-f-]{36}\.jpg$/);
    const [key, body, contentType] = storage.put.mock.calls[0];
    expect(key).toBe(`driver-documents/${fileUrl.split('/').pop()}`);
    expect(body).toBe(JPEG);
    expect(contentType).toBe('image/jpeg');
  });

  it('refuses content that is not an allowed type and writes nothing', async () => {
    await expect(
      store.save({ buffer: Buffer.from('<svg onload=alert(1)>'), mimetype: 'image/png', size: 20 }),
    ).rejects.toThrow(UnsupportedMediaTypeException);
    expect(storage.put).not.toHaveBeenCalled();
  });
});
