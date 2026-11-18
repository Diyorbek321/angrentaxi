import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const REDIS_RETRY_STEP_MS = 200;
const REDIS_RETRY_MAX_MS = 5000;

/**
 * Qayta ulanish kechikishi — HECH QACHON taslim bo'lmaydi.
 *
 * ⚠️ Ilgari 10 urinishdan keyin (~5 s) `null` qaytarilardi: ioredis butunlay
 * to'xtar, Redis qaytib yonsa ham backend unga ulanmasdi va qayta ishga
 * tushirilmaguncha birorta haydovchi topilmasdi. Liveness healthcheck esa
 * Redis'ni tekshirmaydi — konteyner "sog'lom" turaverardi.
 */
export function redisRetryDelay(times: number): number {
  return Math.min(times * REDIS_RETRY_STEP_MS, REDIS_RETRY_MAX_MS);
}

export const redisProvider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService): Redis => {
    const host = configService.get<string>('REDIS_HOST', 'localhost');
    const port = configService.get<number>('REDIS_PORT', 6379);
    // Optional — managed Redis (e.g. Railway) requires auth; local/docker Redis leaves it unset.
    const password = configService.get<string>('REDIS_PASSWORD') || undefined;

    const client = new Redis({
      host,
      port,
      password,
      retryStrategy: redisRetryDelay,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });

    client.on('connect', () => {
      console.log(`Redis connected at ${host}:${port}`);
    });

    client.on('error', (err: Error) => {
      console.error('Redis error:', err.message);
    });

    return client;
  },
  inject: [ConfigService],
};
