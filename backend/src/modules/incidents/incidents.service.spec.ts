import { IncidentsService, INCIDENT_DAILY_LIMIT } from './incidents.service';
import { Incident, IncidentStatus } from '../../database/entities/incident.entity';

/** Shikoyat qoldirish (INCIDENT-POLICY §3). */
describe('IncidentsService — foydalanuvchi tomoni', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const taxiRow = {
    id: 'o1',
    passenger_id: 'pax',
    driver_id: 'drv',
    status: 'completed',
    completed_at: '2026-11-03T10:00:00Z',
    updated_at: '2026-11-03T10:00:00Z',
    service_type: 'taxi',
    payment_method: 'cash',
    price: 15000,
  };

  function build(opts: { orderRow?: Record<string, unknown> | null; existing?: Partial<Incident> | null; count?: number } = {}) {
    const saved: Array<Partial<Incident>> = [];
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const repo = {
      findOne: jest.fn(async () => opts.existing ?? null),
      count: jest.fn(async () => opts.count ?? 0),
      find: jest.fn(async () => []),
      create: jest.fn((x: Partial<Incident>) => x),
      save: jest.fn(async (x: Partial<Incident>) => {
        const row = { id: x.id ?? 'inc-1', outcomes: [], photoKeys: [], ...x };
        saved.push(row);
        return row;
      }),
      update: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn(() => repo),
      query: jest.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return [{ suspended_until: params[1] }];
      }),
    };
    const dataSource = {
      query: jest.fn(async () => (opts.orderRow === null ? [] : [opts.orderRow ?? taxiRow])),
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
      getRepository: jest.fn(),
    };
    const auditLog = { record: jest.fn(async (e: Record<string, unknown>) => ({ id: 'audit-1', ...e })) };
    const notifications = { notifyUserIds: jest.fn() };
    const drivers = { forceOffline: jest.fn() };
    const service = new IncidentsService(
      repo as never,
      dataSource as never,
      { save: jest.fn(async () => 'incident-photos/x.jpg'), open: jest.fn() } as never,
      auditLog as never,
      undefined,
      notifications as never,
      drivers as never,
    );
    return { service, repo, saved, queries, auditLog, notifications, drivers };
  }

  const input = { vertical: 'taxi' as const, orderId: 'o1', category: 'rude', description: "Qo'pol gapirdi" };

  it("yo'lovchi haydovchi haqida — subyekt haydovchi, holat open", async () => {
    const ctx = build();
    const result = await ctx.service.report({ id: 'pax' }, input, now);
    expect(result).toMatchObject({
      reporterUserId: 'pax',
      reporterRole: 'passenger',
      subjectUserId: 'drv',
      subjectRole: 'driver',
      category: 'rude',
      safetySuspended: false,
    });
    expect(ctx.auditLog.record).not.toHaveBeenCalled();
  });

  it('ishtirokchi emas — 403', async () => {
    await expect(build().service.report({ id: 'stranger' }, input, now)).rejects.toMatchObject({ status: 403 });
  });

  it("haydovchi yo'lovchi uchun «aylanma yo'l» tanlay olmaydi", async () => {
    await expect(build().service.report({ id: 'drv' }, { ...input, category: 'detour' }, now)).rejects.toMatchObject({
      response: { code: 'INCIDENT_NOT_ALLOWED' },
    });
  });

  it('tizim toifasi rad', async () => {
    await expect(build().service.report({ id: 'pax' }, { ...input, category: 'rating_signal' }, now)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('7 kundan keyin — INCIDENT_WINDOW_CLOSED', async () => {
    const ctx = build({ orderRow: { ...taxiRow, completed_at: '2026-10-20T00:00:00Z' } });
    await expect(ctx.service.report({ id: 'pax' }, input, now)).rejects.toMatchObject({
      response: { code: 'INCIDENT_WINDOW_CLOSED', details: { days: 7 } },
    });
  });

  it('davom etayotgan safar — faqat xavfsizlik toifasi', async () => {
    const active = { ...taxiRow, status: 'in_progress', completed_at: null };
    await expect(build({ orderRow: active }).service.report({ id: 'pax' }, input, now)).rejects.toMatchObject({
      response: { code: 'INCIDENT_WINDOW_CLOSED' },
    });
    await expect(
      build({ orderRow: active }).service.report({ id: 'pax' }, { ...input, category: 'harassment' }, now),
    ).resolves.toMatchObject({ category: 'harassment' });
  });

  it('ochiq shikoyat bor — 409', async () => {
    const ctx = build({ existing: { id: 'old', source: 'user', status: IncidentStatus.OPEN } });
    await expect(ctx.service.report({ id: 'pax' }, input, now)).rejects.toMatchObject({
      response: { code: 'INCIDENT_ALREADY_OPEN', details: { incidentId: 'old' } },
    });
  });

  it('past baho qoralamasi haqiqiy shikoyatga aylanadi (takror qator yo\'q)', async () => {
    const ctx = build({ existing: { id: 'draft', source: 'low_rating', status: IncidentStatus.OPEN, description: 'Yomon' } });
    const result = await ctx.service.report({ id: 'pax' }, input, now);
    expect(result).toMatchObject({ id: 'draft', source: 'user', category: 'rude' });
    expect(result.description).toContain('Yomon');
    expect(ctx.repo.create).not.toHaveBeenCalled();
  });

  it('sutkalik chegara — 429', async () => {
    await expect(build({ count: INCIDENT_DAILY_LIMIT }).service.report({ id: 'pax' }, input, now)).rejects.toMatchObject({
      status: 429,
    });
  });

  it("ta'qib: haydovchi DARHOL to'xtatiladi, admin'ga, audit (tizim), oflayn + push", async () => {
    const ctx = build();
    const result = await ctx.service.report({ id: 'pax' }, { ...input, category: 'harassment' }, now);
    expect(result).toMatchObject({ safetySuspended: true, escalatedToAdmin: true });
    expect(ctx.queries[0].sql).toContain('GREATEST');
    expect(ctx.queries[0].params[0]).toBe('drv');
    expect(ctx.auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: null, action: 'incident.safety_suspension', targetId: 'drv' }),
      expect.anything(),
    );
    expect(result.outcomes[0]).toMatchObject({ type: 'suspension', automatic: true, days: 3 });
    expect(ctx.drivers.forceOffline).toHaveBeenCalledWith('drv');
    expect(ctx.notifications.notifyUserIds).toHaveBeenCalledWith(['drv'], expect.any(Function), 'incident_suspended', {
      incidentId: 'inc-1',
    });
  });

  it('ovqat: sovuq ovqat — subyekt sotuvchi egasi', async () => {
    const ctx = build({
      orderRow: {
        id: 'f1',
        customer_id: 'pax',
        status: 'delivered',
        updated_at: '2026-11-04T10:00:00Z',
        delivery_order_id: 'ride1',
        owner_user_id: 'owner',
        driver_id: 'courier',
      },
    });
    await expect(
      ctx.service.report({ id: 'pax' }, { vertical: 'food', orderId: 'f1', category: 'cold_food', description: 'Sovuq' }, now),
    ).resolves.toMatchObject({ subjectUserId: 'owner', subjectRole: 'vendor' });
  });

  describe("e'tiroz", () => {
    const resolved = {
      id: 'i1',
      subjectUserId: 'drv',
      status: IncidentStatus.RESOLVED,
      resolvedAt: new Date('2026-11-02T00:00:00Z'),
      confirmedAgainstSubject: true,
      outcomes: [{ type: 'warning', auditLogId: 'a', actorUserId: 'm', at: '' }],
      appealedAt: null,
    } as unknown as Incident;

    function appealCtx(incident: Incident, affected = 1) {
      const ctx = build();
      ctx.repo.findOne.mockResolvedValue(incident as never);
      const qb: Record<string, jest.Mock> = {};
      Object.assign(qb, {
        update: jest.fn(() => qb),
        set: jest.fn(() => qb),
        where: jest.fn(() => qb),
        execute: jest.fn(async () => ({ affected })),
      });
      (ctx.repo as unknown as { createQueryBuilder: () => unknown }).createQueryBuilder = () => qb;
      return { ...ctx, qb };
    }

    it('subyekt 7 kun ichida — investigating, admin', async () => {
      const ctx = appealCtx(resolved);
      await expect(ctx.service.appeal('drv', 'i1', 'Men aybdor emasman', now)).resolves.toMatchObject({
        status: 'investigating',
      });
      expect(ctx.qb.set).toHaveBeenCalledWith(expect.objectContaining({ escalatedToAdmin: true, status: 'investigating' }));
    });

    it('subyekt emas — 404; muddat o\'tgan — 409', async () => {
      await expect(appealCtx(resolved).service.appeal('pax', 'i1', 'x x x', now)).rejects.toMatchObject({ status: 404 });
      const old = { ...resolved, resolvedAt: new Date('2026-10-01T00:00:00Z') } as Incident;
      await expect(appealCtx(old).service.appeal('drv', 'i1', 'x x x', now)).rejects.toMatchObject({
        response: { details: { reason: 'window_closed' } },
      });
    });

    it('ikkinchi marta — 409', async () => {
      const again = { ...resolved, appealedAt: new Date() } as Incident;
      await expect(appealCtx(again).service.appeal('drv', 'i1', 'x x x', now)).rejects.toMatchObject({
        response: { details: { reason: 'already_appealed' } },
      });
    });
  });
});
