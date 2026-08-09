import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { Order, PaymentMethod } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import {
  WithdrawalRequest,
  WithdrawalStatus,
} from '../../database/entities/withdrawal-request.entity';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';
import { DriversService } from '../drivers/drivers.service';

/**
 * Coverage for the driver withdrawal-request flow added to PaymentsService:
 * requesting a withdrawal (bounded by wallet balance), and the admin
 * approve/reject/paid transitions. Driver-vs-driver isolation is enforced
 * structurally (getMyWithdrawals is always scoped to the caller's own id,
 * with no id parameter a driver could override — see
 * payments.controller.spec.ts for the route-level guard assertions), and is
 * also exercised here at the repository-query level.
 */
describe('PaymentsService - withdrawals', () => {
  let service: PaymentsService;

  let transactionRepository: {
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let withdrawalRepository: {
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let queryBuilderMock: { select: jest.Mock; where: jest.Mock; getRawOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const mockBalance = (balance: number): void => {
    queryBuilderMock.getRawOne.mockResolvedValue({ balance: String(balance) });
  };

  beforeEach(async () => {
    queryBuilderMock = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };

    transactionRepository = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'tx-1', ...entity })),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    };

    withdrawalRepository = {
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({
          id: entity.id ?? 'withdrawal-1',
          requestedAt: entity.requestedAt ?? new Date('2026-07-13T00:00:00Z'),
          processedAt: entity.processedAt ?? null,
          adminNote: entity.adminNote ?? null,
          ...entity,
        }),
      ),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    // requestWithdrawal wraps its balance-check-then-insert in
    // dataSource.transaction(async (manager) => {...}) so it can hold a
    // Postgres advisory lock (see payments.service.ts comment) for the
    // duration of the check + writes. This mock runs the callback
    // immediately (single-threaded unit test, no real concurrency) against
    // a fake EntityManager whose getRepository(Entity) resolves to the same
    // transactionRepository / withdrawalRepository mocks used everywhere
    // else in this file, so every existing assertion on those mocks keeps
    // working unchanged.
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          query: jest.fn().mockResolvedValue(undefined),
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Transaction) return transactionRepository;
            if (entity === WithdrawalRequest) return withdrawalRepository;
            throw new Error(`Unexpected entity passed to manager.getRepository: ${entity}`);
          }),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: getRepositoryToken(Order), useValue: {} },
        { provide: getRepositoryToken(MarketOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(FoodOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(WithdrawalRequest), useValue: withdrawalRepository },
        { provide: PaymeProvider, useValue: {} },
        { provide: ClickProvider, useValue: {} },
        { provide: UzcardProvider, useValue: {} },
        // settleOrderPayout credits drivers.balance once a card payment lands.
        {
          provide: DriversService,
          useValue: { adjustBalanceWithin: jest.fn().mockResolvedValue({
            driverId: 'driver-profile-1',
            newBalance: 0,
            wentOffline: false,
          }) },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('requestWithdrawal', () => {
    it('creates a pending withdrawal request and an immediate hold-DEBIT transaction when the amount is within balance', async () => {
      mockBalance(100000);

      const result = await service.requestWithdrawal('driver-1', {
        amount: 60000,
        payoutDestination: '+998901234567',
      });

      expect(result.status).toBe(WithdrawalStatus.PENDING);
      expect(withdrawalRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: 'driver-1',
          amount: 60000,
          payoutDestination: '+998901234567',
          status: WithdrawalStatus.PENDING,
        }),
      );

      // The hold must be booked immediately as a COMPLETED debit so the
      // wallet balance reflects it right away (see design-choice comment
      // in payments.service.ts).
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'driver-1',
          amount: 60000,
          type: TransactionType.DEBIT,
          paymentMethod: PaymentMethod.WALLET,
          status: TransactionStatus.COMPLETED,
        }),
      );
    });

    it('rejects a withdrawal request exceeding the current wallet balance without creating any records', async () => {
      mockBalance(50000);

      await expect(
        service.requestWithdrawal('driver-1', {
          amount: 50001,
          payoutDestination: '+998901234567',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(withdrawalRepository.save).not.toHaveBeenCalled();
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('allows a withdrawal request exactly equal to the wallet balance', async () => {
      mockBalance(25000);

      await expect(
        service.requestWithdrawal('driver-1', {
          amount: 25000,
          payoutDestination: 'card-1234',
        }),
      ).resolves.toMatchObject({ status: WithdrawalStatus.PENDING });
    });
  });

  describe('processWithdrawal', () => {
    const pendingRequest = (overrides: Partial<WithdrawalRequest> = {}): WithdrawalRequest =>
      ({
        id: 'withdrawal-1',
        driverId: 'driver-1',
        amount: 40000,
        status: WithdrawalStatus.PENDING,
        payoutDestination: '+998901234567',
        requestedAt: new Date('2026-07-13T00:00:00Z'),
        processedAt: null,
        adminNote: null,
        ...overrides,
      }) as WithdrawalRequest;

    it('approves a pending withdrawal request without touching the ledger', async () => {
      withdrawalRepository.findOne.mockResolvedValue(pendingRequest());

      const result = await service.processWithdrawal('withdrawal-1', {
        status: WithdrawalStatus.APPROVED,
      });

      expect(result.status).toBe(WithdrawalStatus.APPROVED);
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a pending withdrawal request and refunds the held amount via a CREDIT transaction', async () => {
      withdrawalRepository.findOne.mockResolvedValue(pendingRequest());

      const result = await service.processWithdrawal('withdrawal-1', {
        status: WithdrawalStatus.REJECTED,
        adminNote: 'Suspicious payout destination',
      });

      expect(result.status).toBe(WithdrawalStatus.REJECTED);
      expect(result.adminNote).toBe('Suspicious payout destination');
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'driver-1',
          amount: 40000,
          type: TransactionType.CREDIT,
          paymentMethod: PaymentMethod.WALLET,
          status: TransactionStatus.COMPLETED,
        }),
      );
    });

    it('marks an approved withdrawal request as paid', async () => {
      withdrawalRepository.findOne.mockResolvedValue(
        pendingRequest({ status: WithdrawalStatus.APPROVED }),
      );

      const result = await service.processWithdrawal('withdrawal-1', {
        status: WithdrawalStatus.PAID,
        adminNote: 'Sent via bank transfer',
      });

      expect(result.status).toBe(WithdrawalStatus.PAID);
      expect(transactionRepository.save).not.toHaveBeenCalled();
    });

    it('rejects approving a request that is not pending', async () => {
      withdrawalRepository.findOne.mockResolvedValue(
        pendingRequest({ status: WithdrawalStatus.PAID }),
      );

      await expect(
        service.processWithdrawal('withdrawal-1', { status: WithdrawalStatus.APPROVED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects marking a request paid unless it was approved first', async () => {
      withdrawalRepository.findOne.mockResolvedValue(pendingRequest());

      await expect(
        service.processWithdrawal('withdrawal-1', { status: WithdrawalStatus.PAID }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for an unknown withdrawal request id', async () => {
      withdrawalRepository.findOne.mockResolvedValue(null);

      await expect(
        service.processWithdrawal('missing-id', { status: WithdrawalStatus.APPROVED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyWithdrawals (driver isolation)', () => {
    it('queries only the requesting driver\'s own withdrawal requests', async () => {
      withdrawalRepository.find.mockResolvedValue([
        { id: 'withdrawal-1', driverId: 'driver-1' },
      ]);

      const result = await service.getMyWithdrawals('driver-1');

      expect(withdrawalRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { driverId: 'driver-1' } }),
      );
      expect(result).toEqual([{ id: 'withdrawal-1', driverId: 'driver-1' }]);
    });

    it('does not leak another driver\'s requests when queried with a different driverId', async () => {
      withdrawalRepository.find.mockImplementation(({ where }) =>
        Promise.resolve(
          [
            { id: 'withdrawal-1', driverId: 'driver-1' },
            { id: 'withdrawal-2', driverId: 'driver-2' },
          ].filter((w) => w.driverId === where.driverId),
        ),
      );

      const driver1Results = await service.getMyWithdrawals('driver-1');
      const driver2Results = await service.getMyWithdrawals('driver-2');

      expect(driver1Results).toEqual([{ id: 'withdrawal-1', driverId: 'driver-1' }]);
      expect(driver2Results).toEqual([{ id: 'withdrawal-2', driverId: 'driver-2' }]);
    });
  });
});
