import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { ObjectStorage, StoredObject, assertDeletableKey, assertSafeKey } from './object-storage';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  /** Set for any S3-compatible host (Cloudflare R2, Railway Buckets, MinIO). */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO and some self-hosted setups need path-style URLs. */
  forcePathStyle?: boolean;
}

/**
 * Any S3-compatible bucket. The bucket must be PRIVATE: these are passport and
 * licence scans, and the backend streams them only after its own access
 * check. Nothing here ever produces a public or presigned URL, and only
 * ad images can be deleted (`assertDeletableKey`).
 */
export class S3Storage implements ObjectStorage {
  readonly driver = 's3' as const;

  constructor(
    private readonly config: S3StorageConfig,
    private readonly client: Pick<S3Client, 'send'> = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  ) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    assertSafeKey(key);
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return {
        stream: result.Body as Readable,
        contentType: result.ContentType ?? null,
        size: result.ContentLength ?? null,
      };
    } catch (err) {
      if (err instanceof NoSuchKey || (err as { name?: string }).name === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  }

  /** S3 DeleteObject is already idempotent: a missing key succeeds. */
  async delete(key: string): Promise<void> {
    assertDeletableKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}
