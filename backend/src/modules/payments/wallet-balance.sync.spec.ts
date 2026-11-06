import { computeWalletBalances, syncDriverBalanceColumn } from './wallet-balance.util';

/**
 * `drivers.balance` — daftarning keshi (docs/LEGAL-COMPLIANCE.md §13).
 */
describe('syncDriverBalanceColumn', () => {
  it('ustunni daftar qoldig\'iga tenglaydi va UPDATE natijasining [rows, count] shaklini o\'qiydi', async () => {
    const manager = {
      query: jest.fn().mockResolvedValue([
        [{ driver_id: 'd1', balance: '-1500.00', is_online: false, was_online: true }],
        1,
      ]),
    };
    const result = await syncDriverBalanceColumn(manager, 'u1');
    expect(result).toEqual({ driverId: 'd1', balance: -1500, wentOffline: true });
    const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['u1']);
    // Daftardan: faqat tugallangan qatorlar; oflayn qoidasi ham daftar bo'yicha.
    expect(sql).toContain("status = 'completed'");
    expect(sql).toContain('SET balance = ledger.balance');
    expect(sql).toContain('WHEN ledger.balance < 0 THEN false');
  });

  it('allaqachon oflayn haydovchi uchun wentOffline=false', async () => {
    const manager = {
      query: jest.fn().mockResolvedValue([[{ driver_id: 'd1', balance: '-10', is_online: false, was_online: false }], 1]),
    };
    expect((await syncDriverBalanceColumn(manager, 'u1')).wentOffline).toBe(false);
  });

  it('haydovchi bo\'lmagan foydalanuvchi (sotuvchi) — no-op', async () => {
    const manager = { query: jest.fn().mockResolvedValue([[], 0]) };
    expect(await syncDriverBalanceColumn(manager, 'vendor-1')).toEqual({
      driverId: null,
      balance: 0,
      wentOffline: false,
    });
  });
});

describe('computeWalletBalances', () => {
  it('bitta so\'rovda; qatori yo\'q foydalanuvchi — 0', async () => {
    const manager = { query: jest.fn().mockResolvedValue([{ user_id: 'a', balance: '120000.00' }]) };
    const map = await computeWalletBalances(manager, ['a', 'b']);
    expect(map.get('a')).toBe(120000);
    expect(map.get('b')).toBe(0);
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it("bo'sh ro'yxat — so'rovsiz", async () => {
    const manager = { query: jest.fn() };
    expect((await computeWalletBalances(manager, [])).size).toBe(0);
    expect(manager.query).not.toHaveBeenCalled();
  });
});
