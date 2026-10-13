import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.config';

export const HEALTH_CHECK_TIMEOUT_MS = 'HEALTH_CHECK_TIMEOUT_MS';
const DEFAULT_TIMEOUT_MS = 2000;

export interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
}

export interface LivenessResult {
  status: 'ok';
  uptimeSec: number;
  timestamp: string;
}

export interface ReadinessResult {
  status: 'ok' | 'error';
  timestamp: string;
  checks: { database: DependencyCheck; redis: DependencyCheck };
}

/**
 * Liveness — jarayon tirikmi (bog'liqliklarga tegmaydi, Railway healthcheck
 * va uptime monitor uchun arzon). Readiness — Postgres va Redis javob
 * beryaptimi. Xato matni javobga chiqmaydi (ichki host/parol oshkor bo'lmasin),
 * faqat logga yoziladi.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly timeoutMs: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() @Inject(HEALTH_CHECK_TIMEOUT_MS) timeoutMs?: number,
  ) {
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  liveness(): LivenessResult {
    return {
      status: 'ok',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessResult> {
    const [database, redis] = await Promise.all([
      this.check('database', () => this.dataSource.query('SELECT 1')),
      this.check('redis', async () => {
        const reply = await this.redis.ping();
        if (reply !== 'PONG') throw new Error(`unexpected ping reply: ${reply}`);
      }),
    ]);
    const allUp = database.status === 'up' && redis.status === 'up';
    return {
      status: allUp ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  private async check(name: string, probe: () => Promise<unknown>): Promise<DependencyCheck> {
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        probe(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timeout after ${this.timeoutMs}ms`)), this.timeoutMs);
        }),
      ]);
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (err) {
      this.logger.warn(`${name} health check failed: ${(err as Error).message}`);
      return { status: 'down', latencyMs: Date.now() - started };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
