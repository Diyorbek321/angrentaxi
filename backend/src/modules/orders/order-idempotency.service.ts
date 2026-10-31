import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.config';
import { Order } from '../../database/entities/order.entity';

/** Kalit ilova tomonida UUID; boshqa formatlar e'tiborsiz qoldiriladi. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const PENDING = 'pending';
/** Birinchi so'rov shuncha vaqtda tugamasa, kalit o'z-o'zidan bo'shaydi. */
const PENDING_TTL_S = 120;
const DONE_TTL_S = 24 * 60 * 60;

export interface IdempotentResult {
  order: Order;
  /** `true` — so'rov takror, buyurtma avvalroq yaratilgan. */
  replayed: boolean;
}

/**
 * `POST /orders` uchun `Idempotency-Key`.
 *
 * Zaif tarmoqda ilova 15 s kutib "vaqt tugadi" deydi, server esa buyurtmani
 * allaqachon yaratgan bo'ladi. Yo'lovchi yana bosganda ikkinchi buyurtma
 * ochilar va ikkala buyurtmaga haydovchi qidirilardi — birinchisi "yetim"
 * qolib, haydovchi uni ko'rmagan yo'lovchiga borardi. Ilova har urinish
 * uchun bitta kalit yuboradi; takror so'rov birinchi buyurtmani qaytaradi.
 */
@Injectable()
export class OrderIdempotencyService {
  private readonly logger = new Logger(OrderIdempotencyService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async run(
    userId: string,
    key: string | undefined,
    create: () => Promise<Order>,
    load: (orderId: string) => Promise<Order>,
  ): Promise<IdempotentResult> {
    if (!key || !KEY_PATTERN.test(key)) {
      return { order: await create(), replayed: false };
    }

    const redisKey = `idem:order:${userId}:${key}`;
    let acquired: boolean;
    try {
      acquired = Boolean(
        await this.redis.set(redisKey, PENDING, 'EX', PENDING_TTL_S, 'NX'),
      );
    } catch (err) {
      // Redis yo'q — buyurtma berishni to'xtatish takrordan yomonroq.
      this.logger.warn(`Idempotency o'chiq (Redis): ${(err as Error).message}`);
      return { order: await create(), replayed: false };
    }

    if (!acquired) {
      const existing = await this.redis.get(redisKey);
      if (existing && existing !== PENDING) {
        return { order: await load(existing), replayed: true };
      }
      throw new ConflictException({
        code: 'ORDER_IN_PROGRESS',
        message: 'Buyurtma qayta ishlanmoqda',
      });
    }

    try {
      const order = await create();
      await this.redis
        .set(redisKey, order.id, 'EX', DONE_TTL_S)
        .catch((err: Error) => this.logger.warn(`Idempotency yozilmadi: ${err.message}`));
      return { order, replayed: false };
    } catch (err) {
      await this.redis.del(redisKey).catch(() => undefined);
      throw err;
    }
  }
}
