import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { Order, PaymentMethod } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import { WithdrawalRequest, WithdrawalStatus } from '../../database/entities/withdrawal-request.entity';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';

/**
 * Regression coverage for the requestWithdrawal() TOCTOU race: it used to
 * call getWalletBalance(driverId), check `dto.amount > balance` in
 * application code, and only *then* insert the withdrawal_requests row and
 * the hold DEBIT transaction. Two concurrent requestWithdrawal() calls from
 * the same driver could both read the same balance before either one wrote
 * its hold, both pass the "amount <= balance" check, and both succeed —
 * draining more than the driver's actual balance.
 *
 * The fix wraps the balance check + inserts in
 * `dataSource.transaction(async (manager) => {...})`, taking a
 * `pg_advisory_xact_lock(hashtext(driverId))` at the top of the transaction
 * so a second concurrent call for the same driver blocks until the first
 * commits, then recomputes the balance *inside* the lock from scratch.
 *
 * This mock reproduces that serialization without a real Postgres
 * connection: `dataSource.transaction` is backed by a promise queue that
 * only lets one callback run at a time, in call order — exactly what
 * pg_advisory_xact_lock guarantees for two sessions contending on the same
 * key — and the mocked ledger (`currentBalance`) is mutated by
 * `transactionRepository.save` the same way a real COMPLETED DEBIT row
 * would move a SUM() aggregate. This lets the test assert the behavior that
 * actually matters: only one of two overlapping requests for more than the
 * combined balance can succeed, and the loser gets a BadRequestException
 * rather than silently draining the wallet.
 */
describe('PaymentsService - requestWithdrawal race guard', () => {
  let service: PaymentsService;

  let transactionRepository: { save: jest.Mock; createQueryBuilder: jest.Mock };
  let withdrawalRepository: { save: jest.Mock };
  let queryBuilderMock: { select: jest.Mock; where: jest.Mock; getRawOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  let currentBalance: number;

  beforeEach(async () => {
    currentBalance = 100000;

    queryBuilderMock = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockImplementation(() =>
        Promise.resolve({ balance: String(currentBalance) }),
      ),
    };

    transactionRepository = {
      // Mutates the same in-memory ledger that getRawOne() above reads
      // from, mirroring how a real COMPLETED DEBIT/CREDIT row moves the
      // SUM()-based balance computed by computeBalance().
      save: jest.fn().mockImplementation((entity) => {
        if (entity.type === TransactionType.DEBIT && entity.status === TransactionStatus.COMPLETED) {
          currentBalance -= entity.amount;
        } else if (
          entity.type === TransactionType.CREDIT &&
          entity.status === TransactionStatus.COMPLETED
        ) {
          currentBalance += entity.amount;
        }
        return Promise.resolve({ id: `tx-${Math.random()}`, ...entity });
      }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    };

    withdrawalRepository = {
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({
          id: entity.id ?? `withdrawal-${Math.random()}`,
          requestedAt: new Date('2026-07-13T00:00:00Z'),
          processedAt: null,
          adminNote: null,
          ...entity,
        }),
      ),
    };

    // Promise-queue mock of dataSource.transaction: each call only runs its
    // callback once every previously-queued call has fully settled (resolved
    // or rejected) — the same guarantee pg_advisory_xact_lock gives two
    // sessions racing on the same lock key. Callers that invoke
    // requestWithdrawal() back-to-back without awaiting each other (as the
    // test below does) still get serialized here, in call order.
    let queueTail: Promise<unknown> = Promise.resolve();

    dataSource = {
      transaction: jest.fn().mockImplementation((cb: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          query: jest.fn().mockResolvedValue(undefined),
          getRepository: jest.fn().mockImplementation((entity: unknown) => {
            if (entity === Transaction) return transactionRepository;
            if (entity === WithdrawalRequest) return withdrawalRepository;
            throw new Error(`Unexpected entity passed to manager.getRepository: ${String(entity)}`);
          }),
        };

        const result = queueTail.catch(() => undefined).then(() => cb(manager));
        queueTail = result.catch(() => undefined);
        return result;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: getRepositoryToken(Order), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(WithdrawalRequest), useValue: withdrawalRepository },
        { provide: PaymeProvider, useValue: {} },
        { provide: ClickProvider, useValue: {} },
        { provide: UzcardProvider, useValue: {} },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('serializes two concurrent withdrawal requests for the same driver: only one succeeds when the combined amount exceeds balance', async () => {
    // Driver has 100,000. Two requests for 70,000 each are fired without
    // awaiting the first before starting the second — combined they exceed
    // the balance, so at most one can be allowed through.
    const first = service.requestWithdrawal('driver-1', {
      amount: 70000,
      payoutDestination: 'card-1111',
    });
    const second = service.requestWithdrawal('driver-1', {
      amount: 70000,
      payoutDestination: 'card-2222',
    });

    const results = await Promise.allSettled([first, second]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The loser must fail loudly with BadRequestException, never silently
    // succeed or throw something else.
    const rejection = rejected[0] as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(BadRequestException);

    // Only the winner's withdrawal + hold transaction were persisted.
    expect(withdrawalRepository.save).toHaveBeenCalledTimes(1);
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);

    const winner = (fulfilled[0] as PromiseFulfilledResult<WithdrawalRequest>).value;
    expect(winner.status).toBe(WithdrawalStatus.PENDING);
    expect(winner.amount).toBe(70000);

    // The lock forced the second call to recompute the balance *after* the
    // first one's hold landed — 100,000 - 70,000 = 30,000, which is less
    // than the second request's 70,000, so it correctly fails the
    // in-transaction balance check instead of draining the wallet.
    expect(currentBalance).toBe(30000);
  });

  it('allows two concurrent withdrawal requests that together stay within balance', async () => {
    // 100,000 balance, two requests of 40,000 each = 80,000 total: both fit.
    const first = service.requestWithdrawal('driver-1', {
      amount: 40000,
      payoutDestination: 'card-1111',
    });
    const second = service.requestWithdrawal('driver-1', {
      amount: 40000,
      payoutDestination: 'card-2222',
    });

    const results = await Promise.allSettled([first, second]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(withdrawalRepository.save).toHaveBeenCalledTimes(2);
    expect(transactionRepository.save).toHaveBeenCalledTimes(2);
    expect(currentBalance).toBe(20000);
  });

  it('checks each driver against their own balance when requests overlap', async () => {
    // Not a same-driver race, but guards against a sloppy fix that keys the
    // lock/balance lookup wrong and lets one driver's request be evaluated
    // against another driver's balance.
    const balanceByDriver: Record<string, number> = { 'driver-a': 100000, 'driver-b': 5000 };
    let lastQueriedUserId: string | undefined;

    queryBuilderMock.where.mockImplementation((_clause: string, params: { userId: string }) => {
      lastQueriedUserId = params.userId;
      return queryBuilderMock;
    });
    queryBuilderMock.getRawOne.mockImplementation(() =>
      Promise.resolve({ balance: String(balanceByDriver[lastQueriedUserId ?? ''] ?? 0) }),
    );

    const a = service.requestWithdrawal('driver-a', {
      amount: 50000,
      payoutDestination: 'card-a',
    });
    const b = service.requestWithdrawal('driver-b', {
      amount: 10000,
      payoutDestination: 'card-b',
    });

    const results = await Promise.allSettled([a, b]);

    // driver-a: 50,000 <= 100,000 balance -> succeeds.
    expect(results[0].status).toBe('fulfilled');
    // driver-b: 10,000 > 5,000 balance -> rejected, not silently approved
    // against driver-a's balance.
    expect(results[1].status).toBe('rejected');
    if (results[1].status === 'rejected') {
      expect(results[1].reason).toBeInstanceOf(BadRequestException);
    }
  });
});
