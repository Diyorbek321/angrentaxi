import { RatingsService } from './ratings.service';
import { OrderStatus } from '../../database/entities/order.entity';

/**
 * Bug: haydovchi yo'lovchiga baho berganda haydovchining O'Z o'rtachasi
 * qayta hisoblanardi, yo'lovchi bahosi hech qayerga yozilmasdi (INCIDENT-POLICY §3).
 */
describe('RatingsService — kimning o\'rtachasi yangilanadi', () => {
  function build() {
    const order = { id: 'o1', passengerId: 'pax', driverId: 'drv', status: OrderStatus.COMPLETED };
    const ratingRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((x: Record<string, unknown>) => x),
      save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'r1', ...x })),
    };
    const orderRepo = { findOne: jest.fn(async () => order) };
    const dataSource = { query: jest.fn(async () => []) };
    const signals = { onRatingSubmitted: jest.fn(async () => undefined) };
    const service = new RatingsService(ratingRepo as never, orderRepo as never, dataSource as never, signals as never);
    return { service, dataSource, signals };
  }

  it("yo'lovchi baho beradi → drivers.rating (faqat yo'lovchi baholari)", async () => {
    const ctx = build();
    await ctx.service.submitRating('pax', { orderId: 'o1', score: 2, comment: 'Qo\'pol' }, 'passenger');
    const [sql, params] = ctx.dataSource.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('UPDATE drivers');
    expect(sql).toContain("from_role = 'passenger'");
    expect(params).toEqual(['drv']);
    expect(ctx.signals.onRatingSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ fromRole: 'passenger', toUserId: 'drv', score: 2, comment: "Qo'pol" }),
    );
  });

  it("haydovchi baho beradi → users.passenger_rating, drivers emas", async () => {
    const ctx = build();
    await ctx.service.submitRating('drv', { orderId: 'o1', score: 4 }, 'driver');
    const sqls = ctx.dataSource.query.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(sqls.some((q) => q.includes('passenger_rating'))).toBe(true);
    expect(sqls.some((q) => q.includes('UPDATE drivers'))).toBe(false);
  });

  it('signal xatosi bahoni yiqitmaydi', async () => {
    const ctx = build();
    ctx.signals.onRatingSubmitted.mockRejectedValueOnce(new Error('db'));
    await expect(ctx.service.submitRating('pax', { orderId: 'o1', score: 5 }, 'passenger')).resolves.toMatchObject({ id: 'r1' });
  });
});
