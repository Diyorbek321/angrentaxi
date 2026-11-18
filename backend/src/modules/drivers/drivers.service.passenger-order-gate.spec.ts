import { ConflictException } from '@nestjs/common';
import { UserStatus } from '../../database/entities/user.entity';
import { DriversService } from './drivers.service';
import { PASSENGER_ORDER_ACTIVE_MESSAGE } from '../orders/driver-as-passenger';

/**
 * Bitta raqam bilan ikkala ilova: o'zi taksi kutayotgan yoki ketayotgan
 * haydovchi liniyaga chiqmaydi — aks holda o'z buyurtmasini olishga urinardi.
 */
describe("DriversService — yo'lovchi sifatida faol buyurtma darvozasi", () => {
  function build(hasLive: boolean) {
    const driver = { id: 'd1', userId: 'u1', isOnline: false, user: { status: UserStatus.ACTIVE } };
    const driverRepository = {
      findOne: jest.fn(async () => driver),
      update: jest.fn(async () => ({ affected: 1 })),
      query: jest.fn(async (sql: string) => (sql.includes('passenger_id') ? [{ hasLive }] : [])),
    };
    const transactions = {
      createQueryBuilder: () => {
        const qb = { select: () => qb, where: () => qb, getRawOne: async () => ({ balance: '0' }) };
        return qb;
      },
    };
    const service = new DriversService(
      driverRepository as never,
      transactions as never,
      { geoadd: jest.fn(), set: jest.fn(), zrem: jest.fn(), del: jest.fn() } as never,
      { onUserBlocked: jest.fn() } as never,
      {} as never,
      { assertCanGoOnline: jest.fn() } as never,
    );
    return { service, driverRepository };
  }

  it("faol yo'lovchi buyurtmasi bor — liniyaga chiqish 409, holat yozilmaydi", async () => {
    const ctx = build(true);
    await expect(ctx.service.setOnlineStatus('u1', true)).rejects.toThrow(
      new ConflictException(PASSENGER_ORDER_ACTIVE_MESSAGE),
    );
    expect(ctx.driverRepository.update).not.toHaveBeenCalled();
  });

  it("buyurtma yo'q — liniyaga chiqadi", async () => {
    await expect(build(false).service.setOnlineStatus('u1', true)).resolves.toMatchObject({ isOnline: true });
  });

  it("liniyadan chiqish hech qachon to'silmaydi", async () => {
    await expect(build(true).service.setOnlineStatus('u1', false)).resolves.toBeDefined();
  });
});
