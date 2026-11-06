import { redisRetryDelay } from './redis.config';

/**
 * Redis qisqa o'chib yonsa (konteyner qayta ishga tushdi, xotira to'ldi),
 * backend O'ZI qayta ulanishi shart. Ilgari 10 urinishdan keyin (~5 s)
 * `null` qaytarilardi — ioredis butunlay taslim bo'lardi va backend
 * qayta ishga tushirilmaguncha haydovchi topilmasdi.
 */
describe('redisRetryDelay', () => {
  it('hech qachon taslim bo\'lmaydi (null qaytarmaydi)', () => {
    for (const times of [1, 10, 11, 100, 10_000]) {
      expect(redisRetryDelay(times)).toEqual(expect.any(Number));
    }
  });

  it('kechikish asta oshadi va 5 s bilan cheklanadi', () => {
    expect(redisRetryDelay(1)).toBe(200);
    expect(redisRetryDelay(5)).toBe(1000);
    expect(redisRetryDelay(1000)).toBe(5000);
  });
});
