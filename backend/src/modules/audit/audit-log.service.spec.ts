import { AuditLogService } from './audit-log.service';

describe('AuditLogService.list — aktyor (actor)', () => {
  const rows = [
    { id: 'a-1', actorUserId: 'staff-1', action: 'wallet.manual_adjustment', targetType: 'driver', targetId: 'd-1' },
    { id: 'a-2', actorUserId: 'staff-1', action: 'shift_pass.cancel', targetType: 'shift_pass', targetId: 's-1' },
    { id: 'a-3', actorUserId: null, action: 'payment.refund_clawback', targetType: 'order', targetId: 'o-1' },
    { id: 'a-4', actorUserId: 'gone-user', action: 'vendor.tin_update', targetType: 'restaurant', targetId: 'r-1' },
  ];

  function build() {
    const managerFind = jest.fn(async () => [
      { id: 'staff-1', firstName: 'Ali', lastName: 'Valiyev', phone: '+998901112233', role: 'manager' },
    ]);
    const repository = {
      findAndCount: jest.fn(async () => [rows, 4]),
      manager: { find: managerFind },
    };
    return { service: new AuditLogService(repository as never), repository, managerFind };
  }

  it("aktyorlar BITTA so'rovda (N+1 emas), har yozuvga actor qo'shiladi", async () => {
    const { service, managerFind } = build();
    const page = await service.list({ page: 1, limit: 20 });

    expect(managerFind).toHaveBeenCalledTimes(1);
    expect(page.total).toBe(4);
    expect(page.items[0]).toEqual(
      expect.objectContaining({
        id: 'a-1',
        actorUserId: 'staff-1',
        actor: { id: 'staff-1', name: 'Ali Valiyev', phone: '+998901112233', role: 'manager' },
      }),
    );
    // Tizim amali va o'chirilgan foydalanuvchi — null.
    expect(page.items[2].actor).toBeNull();
    expect(page.items[3].actor).toBeNull();
  });

  it("aktyorsiz sahifa — foydalanuvchi so'rovi yo'q", async () => {
    const { service, repository, managerFind } = build();
    repository.findAndCount.mockResolvedValueOnce([[rows[2]], 1] as never);
    const page = await service.list({ page: 1, limit: 20 });
    expect(managerFind).not.toHaveBeenCalled();
    expect(page.items[0].actor).toBeNull();
  });
});

describe('AuditLogService.list — filtrlar', () => {
  function build() {
    const repository = {
      findAndCount: jest.fn(async () => [[], 0]),
      manager: { find: jest.fn() },
    };
    return { service: new AuditLogService(repository as never), repository };
  }

  it("aktyor va sana oralig'i bo'yicha filtrlaydi", async () => {
    const { service, repository } = build();
    const from = new Date('2026-10-01T00:00:00Z');
    const to = new Date('2026-10-31T23:59:59Z');
    await service.list({ actorUserId: 'staff-1', from, to, page: 1, limit: 20 });

    const where = (repository.findAndCount.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where.actorUserId).toBe('staff-1');
    expect(where.createdAt).toEqual(expect.objectContaining({ _type: 'between', _value: [from, to] }));
  });

  it("faqat 'from' berilsa — undan keyingilar", async () => {
    const { service, repository } = build();
    const from = new Date('2026-10-01T00:00:00Z');
    await service.list({ from, page: 1, limit: 20 });

    const where = (repository.findAndCount.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where.createdAt).toEqual(expect.objectContaining({ _type: 'moreThanOrEqual', _value: from }));
    expect(where).not.toHaveProperty('actorUserId');
  });
});

describe('AuditLogService.list — ADMIN bo\'lmagan xodim', () => {
  function build() {
    const repository = { findAndCount: jest.fn(async () => [[], 0]), manager: { find: jest.fn() } };
    return { service: new AuditLogService(repository as never), repository };
  }
  const whereOf = (repo: { findAndCount: jest.Mock }) =>
    (repo.findAndCount.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;

  it("ruxsat va bloklash yozuvlarini ko'rmaydi", async () => {
    const { service, repository } = build();
    await service.list({ restricted: true, page: 1, limit: 20 });
    expect(whereOf(repository).action).toEqual(
      expect.objectContaining({ _type: 'not', _value: expect.objectContaining({ _type: 'in' }) }),
    );
  });

  it("admin-only amalni so'rasa — bo'sh, bazaga so'rov yo'q", async () => {
    const { service, repository } = build();
    const page = await service.list({ restricted: true, action: 'staff.permissions_update', page: 1, limit: 20 });
    expect(page.total).toBe(0);
    expect(repository.findAndCount).not.toHaveBeenCalled();
  });

  it("xodim bo'yicha filtr e'tiborsiz qoldiriladi", async () => {
    const { service, repository } = build();
    await service.list({ restricted: true, actorUserId: 'staff-1', page: 1, limit: 20 });
    expect(whereOf(repository)).not.toHaveProperty('actorUserId');
  });
});
