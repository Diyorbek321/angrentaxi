import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

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
      retryStrategy: (times: number) => {
        if (times > 10) {
          console.error('Redis connection failed after 10 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
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
