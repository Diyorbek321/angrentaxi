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
