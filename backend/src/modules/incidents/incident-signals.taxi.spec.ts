import { IncidentStatus } from '../../database/entities/incident.entity';
import { IncidentSignalsService } from './incident-signals.service';

/** Haydovchi bekor qilish signali va uzilgan safar hodisasi (INCIDENT-POLICY §5). */
describe('IncidentSignalsService — taksi signallari', () => {
  function build(opts: { cancelsToday?: number; today?: unknown; existingInterrupt?: number; threshold?: number } = {}) {
    const repo = {
      count: jest.fn(async () => opts.existingInterrupt ?? 0),
      findOne: jest.fn(async () => opts.today ?? null),
      create: jest.fn((x: Record<string, unknown>) => x),
      save: jest.fn(async (x: Record<string, unknown>) => x),
      update: jest.fn(),
    };
    const dataSource = { query: jest.fn(async () => [{ cnt: opts.cancelsToday ?? 0 }]) };
    const settings = {
      getSafetyPolicySettings: jest.fn(async () => ({ driverCancelSignalCount: opts.threshold ?? 3 })),
    };
    return { service: new IncidentSignalsService(repo as never, dataSource as never, settings as never), repo, dataSource };
  }

  it("chegaradan kam — hech narsa", async () => {
    const ctx = build({ cancelsToday: 2 });
    await ctx.service.onDriverCancelled('drv');
    expect(ctx.repo.save).not.toHaveBeenCalled();
  });

  it("bugun 3-bekor qilish — tizim hodisasi (subyekt haydovchi), kelmaslik sanalmaydi", async () => {
    const ctx = build({ cancelsToday: 3 });
    await ctx.service.onDriverCancelled('drv', new Date('2026-11-04T15:00:00'));
    expect(ctx.repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterRole: 'system',
        subjectUserId: 'drv',
        subjectRole: 'driver',
        category: 'driver_cancels',
        source: 'driver_cancel_signal',
      }),
    );
    const [sql, params] = ctx.dataSource.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("cancel_reason IS DISTINCT FROM 'no_show'");
    expect((params[1] as Date).getHours()).toBe(0);
  });

  it("bugungi signal bor — yangisi yo'q, ochiq bo'lsa matni yangilanadi", async () => {
    const ctx = build({ cancelsToday: 4, today: { id: 'i1', status: IncidentStatus.OPEN } });
    await ctx.service.onDriverCancelled('drv');
    expect(ctx.repo.save).not.toHaveBeenCalled();
    expect(ctx.repo.update).toHaveBeenCalledWith('i1', { description: expect.stringContaining('4') });
  });

  it("avariya — xavfsizlik hodisasi buyurtmaga bog'langan, bir marta", async () => {
    const ctx = build();
    await ctx.service.onTripInterrupted({ orderId: 'o1', driverUserId: 'drv', passengerId: 'p', note: 'urildi', byRole: 'driver' });
    expect(ctx.repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'safety', source: 'trip_interrupted', orderVertical: 'taxi', orderId: 'o1' }),
    );
    const again = build({ existingInterrupt: 1 });
    await again.service.onTripInterrupted({ orderId: 'o1', driverUserId: 'drv', passengerId: 'p', note: null, byRole: 'manager' });
    expect(again.repo.save).not.toHaveBeenCalled();
  });
});
