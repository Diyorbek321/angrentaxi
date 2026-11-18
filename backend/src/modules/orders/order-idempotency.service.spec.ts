import { ConflictException } from '@nestjs/common';
import { OrderIdempotencyService } from './order-idempotency.service';
import { Order } from '../../database/entities/order.entity';

/**
 * Yo'lovchi ilovasi buyurtmani yuboradi, javob 15 s ichida kelmaydi
 * (zaif 3G), ilova "vaqt tugadi" deydi va yo'lovchi yana bosadi. Server
 * birinchi so'rovni allaqachon bajargan bo'lsa — ikkinchi buyurtma
 * OCHILMASLIGI kerak: o'sha `Idempotency-Key` bilan birinchisi qaytadi.
 */
describe('OrderIdempotencyService', () => {
  let store: Map<string, string>;
  let redis: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
  };
  let service: OrderIdempotencyService;
  const order = (id: string) => ({ id }) as Order;

  beforeEach(() => {
    store = new Map();
    redis = {
      set: jest.fn((k: string, v: string, ...flags: unknown[]) => {
        if (flags.includes('NX') && store.has(k)) return Promise.resolve(null);
        store.set(k, v);
        return Promise.resolve('OK');
      }),
      get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      del: jest.fn((k: string) => {
        store.delete(k);
        return Promise.resolve(1);
      }),
    };
    service = new OrderIdempotencyService(redis as never);
  });

  it('kalitsiz so\'rov — har safar yangi buyurtma', async () => {
    const create = jest.fn().mockResolvedValue(order('o-1'));
    const load = jest.fn();

    const result = await service.run('u-1', undefined, create, load);

    expect(result).toEqual({ order: order('o-1'), replayed: false });
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('bir xil kalit bilan takror — birinchi buyurtma qaytadi, yangisi yaratilmaydi', async () => {
    const create = jest.fn().mockResolvedValue(order('o-1'));
    const load = jest.fn().mockResolvedValue(order('o-1'));
    const key = 'k-123456789';

    const first = await service.run('u-1', key, create, load);
    const second = await service.run('u-1', key, create, load);

    expect(create).toHaveBeenCalledTimes(1);
    expect(first.replayed).toBe(false);
    expect(second).toEqual({ order: order('o-1'), replayed: true });
    expect(load).toHaveBeenCalledWith('o-1');
  });

  it('birinchi so\'rov hali bajarilayotgan bo\'lsa — 409', async () => {
    const key = 'k-123456789';
    let release!: (o: Order) => void;
    const slow = new Promise<Order>((r) => (release = r));
    const first = service.run('u-1', key, () => slow, jest.fn());

    await expect(
      service.run('u-1', key, jest.fn(), jest.fn()),
    ).rejects.toBeInstanceOf(ConflictException);

    release(order('o-1'));
    await first;
  });

  it('yaratish xato bersa — kalit bo\'shatiladi, qayta urinish mumkin', async () => {
    const key = 'k-123456789';
    const failing = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(service.run('u-1', key, failing, jest.fn())).rejects.toThrow('boom');

    const create = jest.fn().mockResolvedValue(order('o-2'));
    const result = await service.run('u-1', key, create, jest.fn());
    expect(result.order.id).toBe('o-2');
  });

  it('kalit foydalanuvchiga bog\'langan — boshqa yo\'lovchi o\'zganing buyurtmasini ololmaydi', async () => {
    const key = 'k-123456789';
    await service.run('u-1', key, jest.fn().mockResolvedValue(order('o-1')), jest.fn());

    const create = jest.fn().mockResolvedValue(order('o-2'));
    const result = await service.run('u-2', key, create, jest.fn());

    expect(result.order.id).toBe('o-2');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('noto\'g\'ri formatdagi kalit e\'tiborsiz — oddiy yaratish', async () => {
    const create = jest.fn().mockResolvedValue(order('o-1'));
    await service.run('u-1', 'bad key with spaces', create, jest.fn());
    expect(redis.set).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('Redis ishlamasa — buyurtma baribir yaratiladi (fail-open)', async () => {
    redis.set.mockRejectedValue(new Error('redis down'));
    const create = jest.fn().mockResolvedValue(order('o-1'));

    const result = await service.run('u-1', 'k-123456789', create, jest.fn());

    expect(result.order.id).toBe('o-1');
  });
});
