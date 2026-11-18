import { Readable } from 'stream';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpThrottlerGuard } from '../../common/guards/http-throttler.guard';
import { MediaController } from './media.controller';
import { OBJECT_STORAGE } from './object-storage';

const IMAGE = 'catalog/0b6f3a52-6f2c-4e0e-9d1a-2f1c4b7a9e10.jpg';

/**
 * Katalog ekrani (mobil menyu, panel jadvali) bir zumda 20–30 ta rasm so'raydi.
 * Global `short` limiti (10/s) ularni 429 bilan kesib, rasmlar chiqmay qolardi.
 */
describe('MediaController — rate limit', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // AppModule bilan bir xil nomli limitlar.
      imports: [
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 1000, limit: 10 },
          { name: 'medium', ttl: 10000, limit: 50 },
          { name: 'long', ttl: 60000, limit: 200 },
        ]),
      ],
      controllers: [MediaController],
      providers: [
        { provide: APP_GUARD, useClass: HttpThrottlerGuard },
        {
          provide: OBJECT_STORAGE,
          useValue: {
            get: async () => ({ stream: Readable.from([Buffer.from('jpeg')]), contentType: 'image/jpeg', size: 4 }),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it("bitta ekran rasmlarini (30 ta, bir zumda) 429 siz beradi", async () => {
    const statuses = await Promise.all(
      Array.from({ length: 30 }, async () => {
        const res = await fetch(`${baseUrl}/media/${IMAGE}`);
        await res.arrayBuffer();
        return res.status;
      }),
    );
    expect(statuses.filter((s) => s !== 200)).toEqual([]);
  });

  it('cheksiz emas: daqiqalik chegara baribir bor', () => {
    const handler = MediaController.prototype.catalogImage;
    expect(Reflect.getMetadata('THROTTLER:LIMITlong', handler)).toBeGreaterThan(200);
    expect(Reflect.getMetadata('THROTTLER:SKIPlong', handler)).toBeUndefined();
  });
});
