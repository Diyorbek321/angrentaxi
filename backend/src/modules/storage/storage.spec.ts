import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand } from '@aws-sdk/client-s3';
import { LocalDiskStorage } from './local-disk.storage';
import { S3Storage } from './s3.storage';
import { assertDeletableKey, assertSafeKey } from './object-storage';
import { createObjectStorage } from './storage.module';

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString();
}

describe('assertSafeKey', () => {
  it.each(['driver-documents/a.jpg', 'driver-documents/sub/b-1_2.pdf'])('accepts %s', (key) => {
    expect(() => assertSafeKey(key)).not.toThrow();
  });

  it.each(['../etc/passwd', 'driver-documents/../x', '/abs/path', 'a', 'driver-documents/', 'x/./y'])(
    'refuses %s',
    (key) => {
      expect(() => assertSafeKey(key)).toThrow();
    },
  );
});

describe('assertDeletableKey', () => {
  it('reklama rasmini o\'chirishga ruxsat beradi', () => {
    expect(() => assertDeletableKey('ads/a.jpg')).not.toThrow();
  });

  it('KYC hujjatlarini O\'CHIRTIRMAYDI — saqlash muddati siyosat qarori', () => {
    expect(() => assertDeletableKey('driver-documents/a.jpg')).toThrow();
    expect(() => assertDeletableKey('driver-verification/a.jpg')).toThrow();
  });
});

describe('LocalDiskStorage', () => {
  let root: string;
  let storage: LocalDiskStorage;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'angren-storage-'));
    storage = new LocalDiskStorage(root);
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('round-trips a file, creating the prefix directory', async () => {
    await storage.put('driver-documents/a.jpg', Buffer.from('hello'), 'image/jpeg');

    const object = await storage.get('driver-documents/a.jpg');
    expect(object?.size).toBe(5);
    expect(await readAll(object!.stream)).toBe('hello');
  });

  it('returns null for a missing file', async () => {
    await expect(storage.get('driver-documents/missing.jpg')).resolves.toBeNull();
  });

  it('deletes an ad image; a missing file is not an error', async () => {
    await storage.put('ads/a.jpg', Buffer.from('x'), 'image/jpeg');
    await storage.delete('ads/a.jpg');
    await expect(storage.get('ads/a.jpg')).resolves.toBeNull();
    await expect(storage.delete('ads/a.jpg')).resolves.toBeUndefined();
  });

  it('refuses to delete a KYC document', async () => {
    await storage.put('driver-documents/a.jpg', Buffer.from('x'), 'image/jpeg');
    await expect(storage.delete('driver-documents/a.jpg')).rejects.toThrow();
    const kept = await storage.get('driver-documents/a.jpg');
    // Oxirigacha o'qiladi: ochiq qolgan stream papka o'chirilgach xato beradi.
    expect(await readAll(kept!.stream)).toBe('x');
  });

  it('refuses keys that would climb out of root', async () => {
    await expect(storage.put('../outside.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow();
  });
});

describe('S3Storage', () => {
  const send = jest.fn();
  const storage = new S3Storage(
    { bucket: 'kyc', region: 'auto', accessKeyId: 'k', secretAccessKey: 's' },
    { send } as never,
  );

  beforeEach(() => send.mockReset());

  it('puts with bucket, key and content type', async () => {
    send.mockResolvedValueOnce({});
    await storage.put('driver-documents/a.jpg', Buffer.from('x'), 'image/jpeg');

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'kyc',
      Key: 'driver-documents/a.jpg',
      ContentType: 'image/jpeg',
    });
  });

  it('gets the object stream and metadata', async () => {
    const { Readable } = await import('stream');
    send.mockResolvedValueOnce({
      Body: Readable.from(Buffer.from('scan')),
      ContentType: 'image/jpeg',
      ContentLength: 4,
    });

    const object = await storage.get('driver-documents/a.jpg');
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(object?.contentType).toBe('image/jpeg');
    expect(await readAll(object!.stream)).toBe('scan');
  });

  it('maps NoSuchKey to null but lets other failures through', async () => {
    send.mockRejectedValueOnce(new NoSuchKey({ message: 'gone', $metadata: {} }));
    await expect(storage.get('driver-documents/a.jpg')).resolves.toBeNull();

    send.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(storage.get('driver-documents/a.jpg')).rejects.toThrow('AccessDenied');
  });

  it('deletes with bucket and key', async () => {
    send.mockResolvedValueOnce({});
    await storage.delete('ads/a.jpg');
    const command = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'kyc', Key: 'ads/a.jpg' });
  });

  it('never sends a delete for a KYC key', async () => {
    await expect(storage.delete('driver-documents/a.jpg')).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('createObjectStorage', () => {
  const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as never;
  const logger = { log: jest.fn(), warn: jest.fn() } as never;

  it('defaults to local disk', () => {
    expect(createObjectStorage(config({}), logger).driver).toBe('local');
  });

  it('builds S3 storage when fully configured', () => {
    const storage = createObjectStorage(
      config({
        STORAGE_DRIVER: 's3',
        S3_BUCKET: 'kyc',
        S3_ACCESS_KEY_ID: 'k',
        S3_SECRET_ACCESS_KEY: 's',
        S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
      }),
      logger,
    );
    expect(storage.driver).toBe('s3');
  });

  it('refuses to boot with S3 selected but credentials missing', () => {
    expect(() => createObjectStorage(config({ STORAGE_DRIVER: 's3', S3_BUCKET: 'kyc' }), logger)).toThrow(
      /S3_ACCESS_KEY_ID/,
    );
  });

  it('refuses an unknown driver', () => {
    expect(() => createObjectStorage(config({ STORAGE_DRIVER: 'ftp' }), logger)).toThrow(/ftp/);
  });

});
