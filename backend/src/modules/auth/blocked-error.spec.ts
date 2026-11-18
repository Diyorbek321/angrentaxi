import { accountBlockedError } from './blocked-error';

describe('accountBlockedError', () => {
  it('401, xabar o\'zgarmagan, kod va sabab', () => {
    const e = accountBlockedError({ blockReason: 'Firibgarlik' });
    expect(e.getStatus()).toBe(401);
    expect(e.getResponse()).toEqual({ message: 'Account is blocked', code: 'ACCOUNT_BLOCKED', details: { reason: 'Firibgarlik' } });
  });

  it("o'chirilgan hisob sababi ko'rsatilmaydi", () => {
    expect(accountBlockedError({ blockReason: 'account_deleted' }).getResponse()).toMatchObject({ details: { reason: null } });
  });
});
