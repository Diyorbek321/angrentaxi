import * as path from 'path';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDiskStorage } from './local-disk.storage';
import { OBJECT_STORAGE, ObjectStorage } from './object-storage';
import { S3Storage } from './s3.storage';

/** Root for the local driver. `uploads/` is what docker-compose mounts. */
export const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), 'uploads');

export function createObjectStorage(config: ConfigService, logger = new Logger('Storage')): ObjectStorage {
  const driver = (config.get<string>('STORAGE_DRIVER') || 'local').toLowerCase();

  if (driver === 's3') {
    const bucket = config.get<string>('S3_BUCKET');
    const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!bucket || !accessKeyId || !secretAccessKey) {
      // Fail the boot rather than silently writing to a disk that a redeploy
      // will wipe: someone asked for S3 and would believe files are safe.
      throw new Error(
        'STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY',
      );
    }
    const endpoint = config.get<string>('S3_ENDPOINT') || undefined;
    logger.log(`Uploads → S3 bucket "${bucket}"${endpoint ? ` at ${endpoint}` : ''}`);
    return new S3Storage({
      bucket,
      accessKeyId,
      secretAccessKey,
      endpoint,
      region: config.get<string>('S3_REGION') || 'auto',
      forcePathStyle: String(config.get('S3_FORCE_PATH_STYLE')) === 'true',
    });
  }

  if (driver !== 'local') {
    throw new Error(`Unknown STORAGE_DRIVER "${driver}" (expected "local" or "s3")`);
  }

  if (config.get<string>('NODE_ENV') === 'production') {
    logger.warn(
      `Uploads → local disk (${LOCAL_STORAGE_ROOT}). Without a persistent volume ` +
        'mounted there, every redeploy deletes driver documents. Set STORAGE_DRIVER=s3.',
    );
  }
  return new LocalDiskStorage(LOCAL_STORAGE_ROOT);
}

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createObjectStorage(config),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
