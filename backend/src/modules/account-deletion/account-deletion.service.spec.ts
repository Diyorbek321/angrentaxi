import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '../../database/entities/user.entity';
import { AccountDeletionService } from './account-deletion.service';

/**
 * Hisobni o'chirish (Google Play talabi): foydalanuvchi o'zi o'chiradi,
 * lekin pul yoki faol buyurtma "osilib" qolmasligi kerak. O'chirish —
 * anonimlashtirish: safar va to'lov yozuvlari qonun bo'yicha saqlanadi,
 * shaxsni bog'laydigan maydonlar esa tozalanadi.
 */
describe('AccountDeletionService', () => {
  interface Opts {
    role?: UserRole;
    activeTaxi?: number;
    activeFood?: number;
    activeMarket?: number;
    openWithdrawals?: number;
    balance?: number;
  }

  function build(opts: Opts = {}) {
    const user = { id: 'u-1', role: opts.role ?? UserRole.PASSENGER, status: UserStatus.ACTIVE, phone: '+998901112233' };
    const count = (n: number | undefined) => jest.fn().mockResolvedValue(n ?? 0);
    const orders = { count: count(opts.activeTaxi) };
    const foodOrders = { count: count(opts.activeFood) };
    const marketOrders = { count: count(opts.activeMarket) };
    const withdrawals = { count: count(opts.openWithdrawals) };
    const transactions = {
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ balance: String(opts.balance ?? 0) }),
      })),
    };
    const refreshTokens = { update: jest.fn().mockResolvedValue({ affected: 2 }) };
    const users = { deleteOwnAccount: jest.fn().mockResolvedValue(undefined) };
    const service = new AccountDeletionService(
      orders as never,
      foodOrders as never,
      marketOrders as never,
      withdrawals as never,
      transactions as never,
      refreshTokens as never,
      users as never,
    );
    return { service, user, users, refreshTokens };
  }

  it("to'siq yo'q bo'lsa — anonimlashtiradi va barcha sessiyalarni bekor qiladi", async () => {
    const { service, user, users, refreshTokens } = build();
    await service.deleteOwnAccount(user as never);
    expect(users.deleteOwnAccount).toHaveBeenCalledWith('u-1', 'u-1');
    expect(refreshTokens.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1' }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });

  it("xodim va sotuvchi hisobini ilovadan o'chirib bo'lmaydi (403)", async () => {
    for (const role of [UserRole.ADMIN, UserRole.MANAGER, UserRole.MARKET, UserRole.RESTAURANT]) {
      const { service, user, users } = build({ role });
      await expect(service.deleteOwnAccount(user as never)).rejects.toBeInstanceOf(ForbiddenException);
      expect(users.deleteOwnAccount).not.toHaveBeenCalled();
    }
  });

  it("faol buyurtma, ochiq pul yechish yoki hamyonda pul bo'lsa — 409 va barcha sabablar", async () => {
    const { service, user, users } = build({
      role: UserRole.DRIVER,
      activeTaxi: 1,
      activeFood: 1,
      openWithdrawals: 1,
      balance: 25000,
    });
    const err = await service.deleteOwnAccount(user as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    const body = (err as ConflictException).getResponse() as { code: string; reasons: { code: string }[] };
    expect(body.code).toBe('ACCOUNT_DELETION_BLOCKED');
    expect(body.reasons.map((r) => r.code)).toEqual([
      'ACTIVE_ORDER',
      'OPEN_WITHDRAWAL',
      'WALLET_BALANCE_POSITIVE',
    ]);
    expect(users.deleteOwnAccount).not.toHaveBeenCalled();
  });

  it('haydovchining qarzi bor bo\'lsa — avval yopishi kerak', async () => {
    const { service, user } = build({ role: UserRole.DRIVER, balance: -3000 });
    const err = await service.deleteOwnAccount(user as never).catch((e: unknown) => e);
    const body = (err as ConflictException).getResponse() as { reasons: { code: string }[] };
    expect(body.reasons.map((r) => r.code)).toEqual(['WALLET_DEBT']);
  });

  it('getEligibility — ilova tugmani bosishdan oldin sababni ko\'rsatishi uchun', async () => {
    const { service, user } = build({ activeMarket: 1 });
    await expect(service.getEligibility(user as never)).resolves.toEqual({
      canDelete: false,
      reasons: [expect.objectContaining({ code: 'ACTIVE_ORDER' })],
    });
  });
});
