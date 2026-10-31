import { NotFoundException } from '@nestjs/common';
import { DriversService } from './drivers.service';

/**
 * Yagona haqiqat manbai — daftar (docs/LEGAL-COMPLIANCE.md §13).
 * `adjustBalanceWithin` endi `balance + delta` emas, ustunni daftardan
 * qayta yozadi va oflayn qilishni ham daftar bo'yicha hal qiladi.
 */
describe('DriversService.adjustBalanceWithin — daftardan sinxronlash', () => {
  function build() {
    const service = new DriversService(
      {} as never,
      {} as never,
      { zrem: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return service;
  }

  it('ustun daftarga tenglanadi (delta qanday bo\'lishidan qat\'i nazar)', async () => {
    const manager = {
      findOne: jest.fn(async () => ({ id: 'd1', userId: 'u1', isOnline: true })),
      query: jest.fn(async () => [[{ driver_id: 'd1', balance: '-500', is_online: false, was_online: true }], 1]),
    };
    const result = await build().adjustBalanceWithin(manager as never, 'u1', -1000);
    expect(result).toEqual({ driverId: 'd1', newBalance: -500, wentOffline: true });
    const sql = (manager.query.mock.calls[0] as unknown as [string])[0];
    expect(sql).toContain('SET balance = ledger.balance');
    expect(sql).not.toContain('balance + $1');
  });

  it("haydovchi topilmasa — NotFound (avvalgidek)", async () => {
    const manager = { findOne: jest.fn(async () => null), query: jest.fn() };
    await expect(build().adjustBalanceWithin(manager as never, 'u1', 10)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.query).not.toHaveBeenCalled();
  });
});
