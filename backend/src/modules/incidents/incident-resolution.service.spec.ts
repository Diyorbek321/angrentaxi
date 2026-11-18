import { IncidentResolutionService } from './incident-resolution.service';
import { IncidentOutcomeExecutor } from './incident-outcome-executor';
import { Incident, IncidentStatus } from '../../database/entities/incident.entity';
import { Permission, UserRole } from '../../database/entities/user.entity';
import { TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';

/** Hodisani hal qilish — natijalar, audit, daftar (INCIDENT-POLICY §3). */
describe('IncidentResolutionService', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const manager = { id: 'mgr', role: UserRole.MANAGER, permissions: [Permission.SUPPORT_MANAGE, Permission.DRIVERS_FINANCE] };
  const admin = { id: 'adm', role: UserRole.ADMIN, permissions: [] };

  function baseIncident(overrides: Partial<Incident> = {}): Incident {
    return {
      id: 'inc-1',
      reporterUserId: 'pax',
      reporterRole: 'passenger',
      subjectUserId: 'drv',
      subjectRole: 'driver',
      orderVertical: 'taxi',
      orderId: 'o1',
      category: 'rude',
      description: 'x',
      photoKeys: [],
      status: IncidentStatus.INVESTIGATING,
      source: 'user',
      ratingId: null,
      assignedManagerId: 'mgr',
      resolutionNote: null,
      resolvedBy: null,
      resolvedAt: null,
      confirmedAgainstSubject: false,
      outcomes: [],
      safetySuspended: false,
      escalatedToAdmin: false,
      appealedAt: null,
      appealNote: null,
      appealDecision: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  function build(incident: Incident, opts: { strikes?: number; locked?: boolean } = {}) {
    const ledger: Array<Record<string, unknown>> = [];
    const sql: string[] = [];
    const updates: Array<Partial<Incident>> = [];
    const repo = { findOne: jest.fn(async () => incident) };
    const txManager = {
      query: jest.fn(async (q: string, params: unknown[]) => {
        sql.push(q);
        if (q.includes('FOR UPDATE')) return opts.locked === false ? [] : [{ id: incident.id }];
        if (q.includes('GREATEST')) return [{ suspended_until: params[1] }];
        if (q.includes('suspended_until = NULL')) return [{ id: params[0] }];
        return [];
      }),
      getRepository: jest.fn(() => ({
        save: jest.fn(async (row: Record<string, unknown>) => {
          ledger.push(row);
          return row;
        }),
        update: jest.fn(async (_id: string, changes: Partial<Incident>) => updates.push(changes)),
      })),
      findOne: jest.fn(async () => ({ id: 'driver-row', userId: 'drv' })),
    };
    const dataSource = {
      query: jest.fn(async (q: string) => {
        if (q.includes('COUNT(*)')) return [{ strikes: opts.strikes ?? 0 }];
        return [
          {
            id: 'o1',
            passenger_id: 'pax',
            driver_id: 'drv',
            status: 'completed',
            completed_at: '2026-11-03T00:00:00Z',
            service_type: 'taxi',
            payment_method: 'cash',
            price: 20000,
          },
        ];
      }),
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(txManager)),
    };
    let auditSeq = 0;
    const auditLog = { record: jest.fn(async (e: Record<string, unknown>) => ({ id: `audit-${++auditSeq}`, ...e })) };
    const wallet = {
      amountLimitFor: jest.fn(async (isAdmin: boolean) => (isAdmin ? 5_000_000 : 100_000)),
      applyWithin: jest.fn(async (_m: unknown, input: { amount: number }) => ({
        auditId: 'audit-wallet',
        driverId: 'driver-row',
        driverUserId: 'drv',
        newBalance: input.amount,
        wentOffline: false,
      })),
      finalize: jest.fn(),
    };
    const usersService = { runBlockListeners: jest.fn() };
    const drivers = { forceOffline: jest.fn() };
    const notifications = { notifyUserIds: jest.fn() };
    const executor = new IncidentOutcomeExecutor(
      auditLog as never,
      wallet as never,
      usersService as never,
      drivers as never,
      notifications as never,
    );
    const service = new IncidentResolutionService(
      repo as never,
      dataSource as never,
      executor,
      auditLog as never,
      wallet as never,
      undefined,
      notifications as never,
    );
    return { service, ledger, sql, updates, auditLog, wallet, usersService, drivers, notifications };
  }

  it("ogohlantirish + hamyonga qaytarish: audit, daftar (buyurtmaga bog'lanmagan), push", async () => {
    const ctx = build(baseIncident());
    const result = await ctx.service.resolve(
      manager,
      'inc-1',
      {
        status: 'resolved',
        note: 'Tasdiqlandi',
        confirmedAgainstSubject: true,
        outcomes: [{ type: 'warning' }, { type: 'refund', amount: 5000 }],
      },
      now,
    );
    expect(result).toMatchObject({ status: 'resolved', confirmedAgainstSubject: true, resolvedBy: 'mgr' });
    expect(result.outcomes.map((o) => o.type)).toEqual(['warning', 'refund']);
    expect(ctx.ledger).toContainEqual(
      expect.objectContaining({
        userId: 'pax',
        orderId: null,
        amount: 5000,
        type: TransactionType.CREDIT,
        status: TransactionStatus.COMPLETED,
        externalId: expect.stringMatching(/^incident_refund_audit-/),
      }),
    );
    const actions = ctx.auditLog.record.mock.calls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toEqual(['incident.warning', 'incident.refund', 'incident.resolve']);
    const events = ctx.notifications.notifyUserIds.mock.calls.map((c) => c[2]);
    expect(events).toEqual(expect.arrayContaining(['incident_warning', 'incident_refund', 'incident_resolved']));
  });

  it("to'xtatish: standart 3 kun, GREATEST, haydovchi oflayn", async () => {
    const ctx = build(baseIncident());
    const result = await ctx.service.resolve(manager, 'inc-1', { status: 'resolved', note: 'Takror', outcomes: [{ type: 'suspension' }] }, now);
    expect(result.outcomes[0]).toMatchObject({ type: 'suspension', days: 3, targetUserId: 'drv' });
    expect(ctx.sql.some((q) => q.includes('GREATEST'))).toBe(true);
    expect(ctx.drivers.forceOffline).toHaveBeenCalledWith('drv');
  });

  it('kompensatsiya va haydovchi jarimasi — hamyon tuzatish servisi orqali, chegarali', async () => {
    const ctx = build(baseIncident({ subjectRole: 'driver' }));
    await ctx.service.resolve(
      manager,
      'inc-1',
      { status: 'resolved', note: 'Jarima', outcomes: [{ type: 'penalty', amount: 10000 }] },
      now,
    );
    expect(ctx.wallet.applyWithin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: -10000, ledgerPrefix: 'incident_penalty_', action: 'incident.penalty' }),
    );
    expect(ctx.wallet.finalize).toHaveBeenCalled();
    await expect(
      build(baseIncident()).service.resolve(manager, 'inc-1', { status: 'resolved', note: 'x x x', outcomes: [{ type: 'compensation', amount: 200_000 }] }, now),
    ).rejects.toMatchObject({ response: { code: 'INCIDENT_OUTCOME_INVALID' } });
  });

  it("yo'lovchi jarimasi — PENDING hamyon DEBIT (qarz)", async () => {
    const ctx = build(baseIncident({ subjectUserId: 'pax', subjectRole: 'passenger', reporterUserId: 'drv', reporterRole: 'driver' }));
    await ctx.service.resolve(manager, 'inc-1', { status: 'resolved', note: 'Mast', outcomes: [{ type: 'penalty', amount: 20000 }] }, now);
    expect(ctx.ledger).toContainEqual(
      expect.objectContaining({
        userId: 'pax',
        orderId: null,
        type: TransactionType.DEBIT,
        status: TransactionStatus.PENDING,
        paymentMethod: 'wallet',
        externalId: expect.stringMatching(/^incident_penalty_/),
      }),
    );
  });

  it('menejer bloklay olmaydi; admin — blok + oqibatlar commit\'dan keyin', async () => {
    await expect(
      build(baseIncident()).service.resolve(manager, 'inc-1', { status: 'resolved', note: 'x x x', outcomes: [{ type: 'block' }] }, now),
    ).rejects.toMatchObject({ response: { code: 'INCIDENT_OUTCOME_INVALID' } });
    const ctx = build(baseIncident());
    await ctx.service.resolve(admin, 'inc-1', { status: 'resolved', note: 'Bezorilik', outcomes: [{ type: 'block' }] }, now);
    expect(ctx.sql.some((q) => q.includes("status = 'blocked'"))).toBe(true);
    expect(ctx.usersService.runBlockListeners).toHaveBeenCalledWith('drv');
    expect(ctx.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.block', note: 'Bezorilik' }), expect.anything());
  });

  it('admin\'ga yuborilgan hodisa — menejer hal qila olmaydi', async () => {
    await expect(
      build(baseIncident({ escalatedToAdmin: true })).service.resolve(manager, 'inc-1', { status: 'rejected', note: 'yo\'q' }, now),
    ).rejects.toMatchObject({ response: { code: 'INCIDENT_ADMIN_REQUIRED' } });
  });

  it('xavfsizlik: admin rad etsa avtomatik to\'xtatish olib tashlanadi', async () => {
    const auto = { type: 'suspension' as const, days: 3, until: '2026-11-07T00:00:00.000Z', automatic: true, targetUserId: 'drv', auditLogId: 'a', actorUserId: null, at: '' };
    const ctx = build(baseIncident({ escalatedToAdmin: true, safetySuspended: true, outcomes: [auto] }));
    const result = await ctx.service.resolve(admin, 'inc-1', { status: 'rejected', note: 'Tasdiqlanmadi' }, now);
    expect(result.outcomes[0].liftedAt).toBe(now.toISOString());
    expect(ctx.sql.some((q) => q.includes('suspended_until = NULL'))).toBe(true);
    expect(result.confirmedAgainstSubject).toBe(false);
  });

  it('blok pog\'onasi: 5-tasdiqlangan — admin ko\'rib chiqishiga belgi', async () => {
    const ctx = build(baseIncident(), { strikes: 4 });
    const result = await ctx.service.resolve(manager, 'inc-1', { status: 'resolved', note: 'x x x', confirmedAgainstSubject: true, outcomes: [{ type: 'warning' }] }, now);
    expect(result.escalatedToAdmin).toBe(true);
  });

  it("e'tiroz: qaror majburiy; bekor qilinsa to'xtatish olib tashlanadi, strike o'chadi", async () => {
    const susp = { type: 'suspension' as const, days: 3, until: '2026-11-06T00:00:00.000Z', targetUserId: 'drv', auditLogId: 'a', actorUserId: 'mgr', at: '' };
    const appealed = baseIncident({
      appealedAt: now,
      escalatedToAdmin: true,
      confirmedAgainstSubject: true,
      outcomes: [susp],
    });
    await expect(build(appealed).service.resolve(admin, 'inc-1', { status: 'resolved', note: 'x x x' }, now)).rejects.toMatchObject({
      response: { code: 'INCIDENT_OUTCOME_INVALID' },
    });
    const ctx = build(appealed);
    const result = await ctx.service.resolve(admin, 'inc-1', { status: 'resolved', note: 'Asossiz', appealDecision: 'overturned' }, now);
    expect(result).toMatchObject({ appealDecision: 'overturned', confirmedAgainstSubject: false });
    expect(result.outcomes[0].liftedAt).toBeDefined();
    expect(ctx.notifications.notifyUserIds).toHaveBeenCalledWith(['drv'], expect.any(Function), 'incident_appeal_decided', expect.anything());
  });

  it('parallel hal qilish — 409', async () => {
    await expect(
      build(baseIncident(), { locked: false }).service.resolve(manager, 'inc-1', { status: 'rejected', note: 'x x x' }, now),
    ).rejects.toMatchObject({ response: { code: 'INCIDENT_STATE_CONFLICT' } });
  });
});
