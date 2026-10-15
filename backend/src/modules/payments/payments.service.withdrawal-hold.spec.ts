import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { WithdrawalRequest } from '../../database/entities/withdrawal-request.entity';
import { WithdrawalOwnerType } from '../../database/entities/withdrawal-request.entity';
import { computeWithdrawableBalance } from './wallet-balance.util';

/**
 * Security review #3a — "to'ldir, sarfla, keyin chargeback": karta orqali
 * to'ldirilgan pul `walletTopupHoldDays` (standart 7) kun davomida
 * komissiya/smena/sotuvchiga o'tkazma uchun SARFLANADI, lekin YECHIB
 * OLINMAYDI. Yechish `availableForWithdrawal` ga qarab tekshiriladi.
 */
describe('Withdrawal hold for recent card top-ups (#3a)', () => {
  function build(opts: { balance: number; heldTopups: number; holdDays?: number }) {
    let balance = opts.balance;
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        if (sql.includes('FROM wallet_topups')) return [{ held: String(opts.heldTopups) }];
        if (sql.includes('UPDATE drivers')) return [[], 0];
        return [];
      }),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === WithdrawalRequest) {
          return { save: jest.fn(async (row: Record<string, unknown>) => ({ id: 'w-1', ...row })) };
        }
        expect(entity).toBe(Transaction);
        return {
          createQueryBuilder: () => {
            const qb = { select: () => qb, where: () => qb, getRawOne: async () => ({ balance: String(balance) }) };
            return qb;
          },
          save: jest.fn(async (row: { amount: number; type: TransactionType; status: TransactionStatus }) => {
            if (row.type === TransactionType.DEBIT && row.status === TransactionStatus.COMPLETED) balance -= row.amount;
            return row;
          }),
        };
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
      query: manager.query,
    };
    const settings = {
      getWalletTopupSettings: jest.fn(async () => ({ walletTopupHoldDays: opts.holdDays ?? 7 })),
    };
    const transactionRepository = manager.getRepository(Transaction);
    const service = new PaymentsService(
      transactionRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      settings as never,
    );
    return { service, queries, settings };
  }

  it('helper: available = balance − held (never below 0)', async () => {
    const manager = { query: jest.fn(async () => [{ held: '80000' }]) };
    await expect(computeWithdrawableBalance(manager as never, 'u1', 100000, 7, new Date('2026-10-15T00:00:00Z'))).resolves.toEqual({
      available: 20000,
      held: 80000,
    });
    await expect(computeWithdrawableBalance(manager as never, 'u1', 50000, 7)).resolves.toEqual({ available: 0, held: 80000 });
    // Hold o'chiq (0 kun) — so'rov ham yo'q.
    const silent = { query: jest.fn() };
    await expect(computeWithdrawableBalance(silent as never, 'u1', 50000, 0)).resolves.toEqual({ available: 50000, held: 0 });
    expect(silent.query).not.toHaveBeenCalled();
  });

  it('rejects a withdrawal that only fits thanks to a fresh card top-up — coded WALLET_WITHDRAWAL_ON_HOLD', async () => {
    const { service } = build({ balance: 100000, heldTopups: 80000 });
    const err = await service
      .requestWithdrawal('driver-1', { amount: 50000, payoutDestination: '8600' } as never)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'WALLET_WITHDRAWAL_ON_HOLD',
      details: { available: 20000, held: 80000, holdDays: 7 },
    });
  });

  it('allows a withdrawal within the available part', async () => {
    const { service, queries } = build({ balance: 100000, heldTopups: 80000 });
    await expect(
      service.requestWithdrawal('driver-1', { amount: 20000, payoutDestination: '8600' } as never, WithdrawalOwnerType.DRIVER),
    ).resolves.toMatchObject({ amount: 20000 });
    // Ushlab turilgan summa QULF ichida, `paid` to'ldirishlardan hisoblanadi.
    const lockIndex = queries.findIndex((q) => q.sql.includes('pg_advisory_xact_lock'));
    const heldIndex = queries.findIndex((q) => q.sql.includes('FROM wallet_topups'));
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(heldIndex).toBeGreaterThan(lockIndex);
    expect(queries[heldIndex].sql).toContain("status = 'paid'");
  });

  it('GET /payments/wallet exposes availableForWithdrawal and withdrawalHold', async () => {
    const { service } = build({ balance: 100000, heldTopups: 30000 });
    await expect(service.getWalletBalance('driver-1')).resolves.toEqual({
      userId: 'driver-1',
      balance: 100000,
      availableForWithdrawal: 70000,
      withdrawalHold: 30000,
      withdrawalHoldDays: 7,
    });
  });
});
