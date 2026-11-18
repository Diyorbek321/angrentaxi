import { Permission, UserRole, UserStatus } from '../../database/entities/user.entity';
import { AUDIT_ACTIONS } from '../audit/audit-log.service';
import { UsersService } from './users.service';

/**
 * Xodim amallari (bloklash, blokdan chiqarish, ruxsatlarni o'zgartirish)
 * audit jurnaliga kim qilgani bilan yoziladi — "kim nima qildi" savoliga
 * javob shu yerdan keladi.
 */
describe('UsersService — audit jurnali', () => {
  function build(user: Record<string, unknown>) {
    const repo = {
      findOne: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (u) => u),
    };
    const auditLog = { record: jest.fn().mockResolvedValue({}) };
    return { service: new UsersService(repo as never, auditLog as never), repo, auditLog };
  }

  it('bloklash sabab va aktyor bilan yoziladi', async () => {
    const { service, auditLog } = build({ id: 'u-1', role: UserRole.DRIVER, status: UserStatus.ACTIVE });
    await service.blockUser('u-1', '  firibgarlik ', 'admin-1');
    expect(auditLog.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: AUDIT_ACTIONS.userBlock,
      targetType: 'user',
      targetId: 'u-1',
      note: 'firibgarlik',
      metadata: { role: UserRole.DRIVER },
    });
  });

  it('blokdan chiqarish yoziladi', async () => {
    const { service, auditLog } = build({ id: 'u-1', role: UserRole.PASSENGER, status: UserStatus.BLOCKED });
    await service.unblockUser('u-1', 'admin-1');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'admin-1', action: AUDIT_ACTIONS.userUnblock, targetId: 'u-1' }),
    );
  });

  it("ruxsatlar o'zgarishi oldin → keyin bilan yoziladi", async () => {
    const before = [Permission.DISPATCH, Permission.WITHDRAWALS_VIEW];
    const after = [Permission.WITHDRAWALS_VIEW, Permission.WITHDRAWALS_APPROVE];
    const { service, auditLog } = build({ id: 'm-1', role: UserRole.MANAGER, permissions: before });
    await service.updatePermissions('m-1', after, 'admin-1');
    expect(auditLog.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: AUDIT_ACTIONS.staffPermissionsUpdate,
      targetType: 'user',
      targetId: 'm-1',
      metadata: {
        before,
        after,
        added: [Permission.WITHDRAWALS_APPROVE],
        removed: [Permission.DISPATCH],
      },
    });
  });

  it("ruxsatlar o'zgarmagan bo'lsa jurnalga yozilmaydi", async () => {
    const same = [Permission.DISPATCH];
    const { service, auditLog } = build({ id: 'm-1', role: UserRole.MANAGER, permissions: same });
    await service.updatePermissions('m-1', [...same], 'admin-1');
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it("jurnal yiqilsa ham amal bekor qilinmaydi (status allaqachon yozilgan)", async () => {
    const { service, auditLog, repo } = build({ id: 'u-1', role: UserRole.DRIVER, status: UserStatus.ACTIVE });
    auditLog.record.mockRejectedValueOnce(new Error('db down'));
    const result = await service.blockUser('u-1', 'x', 'admin-1');
    expect(repo.update).toHaveBeenCalled();
    expect(result.status).toBe(UserStatus.BLOCKED);
  });

  it("yangi menejer pul to'lashni tasdiqlash ruxsatisiz yaratiladi", async () => {
    const { service, repo } = build({});
    repo.findOne.mockResolvedValue(null);
    const created = await service.createWithRole('+998901234567', UserRole.MANAGER);
    expect(created.permissions).toContain(Permission.WITHDRAWALS_VIEW);
    expect(created.permissions).not.toContain(Permission.WITHDRAWALS_APPROVE);
  });
});

describe("UsersService.deleteOwnAccount — anonimlashtirish", () => {
  function build() {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'u-1', role: UserRole.DRIVER, status: UserStatus.ACTIVE }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const auditLog = { record: jest.fn().mockResolvedValue({}) };
    return { service: new UsersService(repo as never, auditLog as never), repo, auditLog };
  }

  it("shaxsiy maydonlar tozalanadi, telefon bo'shaydi, hisob qayta ishlamaydi", async () => {
    const { service, repo } = build();
    await service.deleteOwnAccount('u-1');
    expect(repo.update).toHaveBeenCalledWith('u-1', {
      phone: 'deleted:u-1',
      firstName: null,
      lastName: null,
      fcmToken: null,
      status: UserStatus.BLOCKED,
      blockReason: 'account_deleted',
      permissions: [],
    });
  });

  it('bloklash tinglovchilari (oflayn, socket) chaqiriladi va o\'zi-o\'chirish jurnalga yoziladi', async () => {
    const { service, auditLog } = build();
    const listener = jest.fn().mockResolvedValue(undefined);
    service.onUserBlocked(listener);
    await service.deleteOwnAccount('u-1');
    expect(listener).toHaveBeenCalledWith('u-1');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'u-1', action: 'user.self_delete', targetId: 'u-1' }),
    );
  });

  it("o'chirilgan hisobni admin blokdan chiqara olmaydi", async () => {
    const { service, repo } = build();
    repo.findOne.mockResolvedValue({ id: 'u-1', status: UserStatus.BLOCKED, blockReason: 'account_deleted' });
    await expect(service.unblockUser('u-1', 'admin-1')).rejects.toThrow('cannot be restored');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
