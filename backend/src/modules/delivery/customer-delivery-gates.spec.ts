import { BadRequestException } from '@nestjs/common';
import { assertCustomerMayCheckout } from './customer-delivery-gates';

const settings = { refusalCashBlockCount: 2, refusalWindowDays: 30 };

function deps(debt: number, refusals: number) {
  const qb = {
    select: () => qb,
    where: () => qb,
    andWhere: () => qb,
    getRawOne: async () => ({ debt: String(debt) }),
  };
  const query = jest.fn(async () => [{ refusals }]);
  return { query, transactions: { createQueryBuilder: () => qb } as never };
}

describe('assertCustomerMayCheckout', () => {
  it("qarz bor — buyurtma yo'q (karta ham)", async () => {
    await expect(
      assertCustomerMayCheckout(deps(10500, 0), { customerId: 'c', isCash: false, settings }),
    ).rejects.toThrow(/unpaid balance of 10500/);
  });

  it('chegaraga yetgan rad — naqd yopiq, karta ochiq', async () => {
    await expect(
      assertCustomerMayCheckout(deps(0, 2), { customerId: 'c', isCash: true, settings }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      assertCustomerMayCheckout(deps(0, 2), { customerId: 'c', isCash: false, settings }),
    ).resolves.toBeUndefined();
  });

  it('chegaradan past — naqd mumkin; oyna sozlamadan', async () => {
    const d = deps(0, 1);
    const now = new Date('2026-11-03T00:00:00Z');
    await expect(assertCustomerMayCheckout(d, { customerId: 'c', isCash: true, settings, now })).resolves.toBeUndefined();
    const since = (d.query.mock.calls[0] as unknown as [string, unknown[]])[1][1] as Date;
    expect(now.getTime() - since.getTime()).toBe(30 * 86_400_000);
  });

  it("to'xtatilgan mijoz — ACCOUNT_SUSPENDED (karta ham)", async () => {
    const now = new Date('2026-11-03T00:00:00Z');
    const d = deps(0, 0);
    d.query.mockImplementation((async (sql: string) =>
      sql.includes('suspended_until')
        ? [{ suspendedUntil: new Date('2026-11-05T00:00:00Z'), suspensionReason: 'Mast' }]
        : [{ refusals: 0 }]) as never);
    await expect(
      assertCustomerMayCheckout(d, { customerId: 'c', isCash: false, settings, now }),
    ).rejects.toMatchObject({ response: { code: 'ACCOUNT_SUSPENDED' } });
  });
});
