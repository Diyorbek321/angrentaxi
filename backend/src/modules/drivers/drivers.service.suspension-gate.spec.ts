import { UserStatus } from '../../database/entities/user.entity';
import { DriversService } from './drivers.service';
import { SuspensionGate } from '../incidents/suspension-gate.service';

/** To'xtatilgan haydovchi onlayn chiqmaydi — kodli 403, sabab va muddat bilan (INCIDENT-POLICY §3). */
describe("DriversService — vaqtincha to'xtatish darvozasi", () => {
  function build(suspendedUntil: Date | null) {
    const driver = { id: 'd1', userId: 'u1', isOnline: false, user: { status: UserStatus.ACTIVE } };
    const driverRepository = {
      findOne: jest.fn(async () => driver),
      update: jest.fn(async () => ({ affected: 1 })),
      query: jest.fn(async () => []),
    };
    const transactions = {
      createQueryBuilder: () => {
        const qb = { select: () => qb, where: () => qb, getRawOne: async () => ({ balance: '0' }) };
        return qb;
      },
    };
    const gate = new SuspensionGate({
      findOne: jest.fn(async () => ({ id: 'u1', suspendedUntil, suspensionReason: "Qo'pollik" })),
    } as never);
    const verification = { assertCanGoOnline: jest.fn() };
    const service = new DriversService(
      driverRepository as never,
      transactions as never,
      { geoadd: jest.fn(), set: jest.fn(), zrem: jest.fn(), del: jest.fn() } as never,
      { onUserBlocked: jest.fn() } as never,
      {} as never,
      verification as never,
      undefined,
      undefined,
      undefined,
      gate,
    );
    return { service, driverRepository };
  }

  it('muddat ichida — ACCOUNT_SUSPENDED, holat yozilmaydi', async () => {
    const ctx = build(new Date(Date.now() + 86_400_000));
    await expect(ctx.service.setOnlineStatus('u1', true)).rejects.toMatchObject({
      status: 403,
      response: { code: 'ACCOUNT_SUSPENDED', details: { reason: "Qo'pollik" } },
    });
    expect(ctx.driverRepository.update).not.toHaveBeenCalled();
  });

  it('oflayn bo\'lish hech qachon to\'silmaydi; muddat o\'tgach onlayn mumkin', async () => {
    await expect(build(new Date(Date.now() + 86_400_000)).service.setOnlineStatus('u1', false)).resolves.toBeDefined();
    await expect(build(new Date(Date.now() - 1000)).service.setOnlineStatus('u1', true)).resolves.toMatchObject({ isOnline: true });
  });
});
