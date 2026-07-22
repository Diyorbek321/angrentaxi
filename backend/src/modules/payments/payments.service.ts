import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import {
  WithdrawalOwnerType,
  WithdrawalRequest,
  WithdrawalStatus,
} from '../../database/entities/withdrawal-request.entity';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';
import { PaymentInitiateResult } from './payment.interface';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { ProcessWithdrawalDto } from './dto/process-withdrawal.dto';

export interface WalletBalance {
  userId: string;
  balance: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepository: Repository<WithdrawalRequest>,
    private readonly paymeProvider: PaymeProvider,
    private readonly clickProvider: ClickProvider,
    private readonly uzcardProvider: UzcardProvider,
    private readonly dataSource: DataSource,
  ) {}

  async initiatePayment(
    orderId: string,
    method: 'payme' | 'click' | 'uzcard',
    userId: string,
  ): Promise<PaymentInitiateResult> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.passengerId !== userId) {
      throw new BadRequestException('Order does not belong to you');
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('Order must be completed before payment');
    }

    const amount = order.finalPrice ?? order.estimatedPrice;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    const phone = user?.phone ?? '';

    let result: PaymentInitiateResult;

    if (method === 'payme') {
      result = await this.paymeProvider.initiate(amount, orderId, phone);
    } else if (method === 'uzcard') {
      result = await this.uzcardProvider.initiate(amount, orderId, phone);
    } else {
      result = await this.clickProvider.initiate(amount, orderId, phone);
    }

    // Create pending transaction record
    await this.transactionRepository.save({
      userId,
      orderId,
      amount,
      type: TransactionType.DEBIT,
      paymentMethod: PaymentMethod.CARD,
      status: TransactionStatus.PENDING,
      externalId: result.id,
    });

    return result;
  }

  async handlePaymeCallback(
    body: Record<string, unknown>,
    authHeader: string,
  ): Promise<{ allow: boolean }> {
    const isValid = this.paymeProvider.verifyCallbackSignature(body, authHeader);

    if (!isValid) {
      this.logger.warn('Invalid Payme callback signature');
      return { allow: false };
    }

    const method = body['method'] as string;
    const params = body['params'] as Record<string, unknown>;

    this.logger.log(`Payme callback received: method=${method}`);

    if (method === 'PerformTransaction') {
      const externalId = params['id'] as string;
      const accountOrderId = (params['account'] as Record<string, string>)?.['order_id'];

      if (accountOrderId) {
        await this.transactionRepository.update(
          { externalId, orderId: accountOrderId },
          { status: TransactionStatus.COMPLETED },
        );

        this.logger.log(`Payme payment completed for order ${accountOrderId}`);
      }
    } else if (method === 'CancelTransaction') {
      const externalId = params['id'] as string;
      await this.transactionRepository.update(
        { externalId },
        { status: TransactionStatus.REFUNDED },
      );
    }

    return { allow: true };
  }

  async handleClickCallback(
    body: Record<string, unknown>,
  ): Promise<{ error: number; error_note: string }> {
    const isValid = this.clickProvider.verifyCallbackSignature(body);

    if (!isValid) {
      this.logger.warn('Invalid Click callback signature');
      return { error: -1, error_note: 'SIGNATURE_FAILED' };
    }

    const action = body['action'] as number;
    const merchantTransId = body['merchant_trans_id'] as string;
    const clickTransId = body['click_trans_id'] as string;

    // Action 1 = prepare, Action 2 = complete
    if (action === 2) {
      await this.transactionRepository.update(
        { externalId: `click_${merchantTransId}_${clickTransId}` },
        { status: TransactionStatus.COMPLETED },
      );

      this.logger.log(`Click payment completed for order ${merchantTransId}`);
    }

    return { error: 0, error_note: 'Success' };
  }

  async handleUzcardCallback(
    body: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const isValid = this.uzcardProvider.verifyCallback(body);

    if (!isValid) {
      this.logger.warn('Invalid Uzcard callback signature');
      return { success: false, message: 'SIGNATURE_FAILED' };
    }

    const status = body['status'] as string | undefined;
    const orderId = body['order_id'] as string | undefined;
    const transactionId = body['transaction_id'] as string | undefined;

    this.logger.log(
      `Uzcard callback received: status=${status}, orderId=${orderId}`,
    );

    if (status === 'PAID' && orderId) {
      await this.transactionRepository.update(
        { externalId: transactionId ?? `uzcard_dev_${orderId}`, orderId },
        { status: TransactionStatus.COMPLETED },
      );
      this.logger.log(`Uzcard payment completed for order ${orderId}`);
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      await this.transactionRepository.update(
        { externalId: transactionId ?? `uzcard_dev_${orderId}`, orderId },
        { status: TransactionStatus.REFUNDED },
      );
    }

    return { success: true, message: 'OK' };
  }

  async getWalletBalance(userId: string): Promise<WalletBalance> {
    const balance = await this.computeBalance(this.transactionRepository, userId);
    return { userId, balance };
  }

  // Shared by getWalletBalance (outside any transaction, using the
  // injected repository) and requestWithdrawal (inside a locked
  // transaction, using an EntityManager-scoped repository bound to that
  // transaction's connection) so both compute the balance the exact same
  // way from the exact same query.
  private async computeBalance(
    transactionRepo: Repository<Transaction>,
    userId: string,
  ): Promise<number> {
    const result = await transactionRepo
      .createQueryBuilder('t')
      .select(
        `SUM(CASE WHEN t.type = 'credit' AND t.status = 'completed' THEN t.amount ELSE 0 END) -
         SUM(CASE WHEN t.type = 'debit' AND t.status = 'completed' THEN t.amount ELSE 0 END)`,
        'balance',
      )
      .where('t.userId = :userId', { userId })
      .getRawOne<{ balance: string }>();

    const balance = parseFloat(result?.balance ?? '0');

    return Math.max(0, balance);
  }

  async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ transactions: Transaction[]; total: number; page: number; limit: number }> {
    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { transactions, total, page, limit };
  }

  // --- Withdrawal requests ---
  //
  // Design choice (documented per code review request): the existing
  // CREDIT/DEBIT pattern in this file (see initiatePayment) creates a
  // transaction row *immediately* when the driver-initiated action starts,
  // then flips its status via a callback. getWalletBalance(), however, only
  // sums transactions with status = COMPLETED — a PENDING row does not move
  // the balance. If a withdrawal hold were left PENDING until admin
  // approval, a driver could file several withdrawal requests back-to-back,
  // each individually passing the "amount <= balance" check, and drain the
  // wallet many times over before an admin looks at any of them.
  //
  // To avoid that, we create the hold DEBIT transaction as COMPLETED right
  // away, at request time — the funds leave the driver's available balance
  // the moment the request is filed, exactly like a bank placing a hold.
  // Approval later performs no ledger change (the hold already stands).
  // Rejection reverses the hold with an equal-and-opposite COMPLETED CREDIT
  // transaction, restoring the balance. "Paid" is a terminal, no-ledger-effect
  // status: it just records that an admin manually sent the money
  // out-of-band (see PaymentsController for the MVP/no-automation note).

  // Race-condition guard (documented per code review request): the balance
  // check followed by the withdrawal-request + hold-transaction insert below
  // is a classic check-then-act sequence. Without a guard, two concurrent
  // requestWithdrawal() calls from the same driver can both call
  // getWalletBalance() before either one has written its hold transaction,
  // both observe the same (stale) balance, both pass the
  // `dto.amount <= balance` check, and both succeed — draining more than the
  // driver's actual balance.
  //
  // A `SELECT ... FOR UPDATE` row lock doesn't fit cleanly here: the thing
  // we need to serialize on isn't a single pre-existing row — a driver with
  // no prior transactions has none to lock, and "balance" is a computed
  // aggregate over a variable number of transaction rows, not one row we
  // could pessimistically lock. Instead we take a Postgres advisory lock
  // scoped to this driver (`pg_advisory_xact_lock(hashtext(driverId))`) for
  // the lifetime of the DB transaction. hashtext() maps the driver's UUID
  // string to the bigint key pg_advisory_xact_lock expects. A second
  // concurrent call for the same driver blocks on that same lock key until
  // the first transaction commits (or rolls back), then re-enters and
  // re-reads the now-reduced balance. Different drivers hash to different
  // keys and never contend with each other. Because it's the `_xact_lock`
  // variant, Postgres releases it automatically at commit/rollback — there
  // is no separate unlock call and no risk of a leaked lock.
  async requestWithdrawal(
    driverId: string,
    dto: RequestWithdrawalDto,
    ownerType: WithdrawalOwnerType = WithdrawalOwnerType.DRIVER,
  ): Promise<WithdrawalRequest> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [driverId]);

      const transactionRepo = manager.getRepository(Transaction);
      const withdrawalRepo = manager.getRepository(WithdrawalRequest);

      // Recompute the balance *inside* the lock. Never reuse a value read
      // before entering the transaction — it may already be stale by the
      // time the lock is acquired.
      const balance = await this.computeBalance(transactionRepo, driverId);

      if (dto.amount > balance) {
        throw new BadRequestException(
          `Requested amount (${dto.amount}) exceeds available wallet balance (${balance})`,
        );
      }

      const withdrawal = await withdrawalRepo.save({
        driverId,
        ownerType,
        amount: dto.amount,
        payoutDestination: dto.payoutDestination,
        status: WithdrawalStatus.PENDING,
        processedAt: null,
        adminNote: null,
      });

      // Immediate hold — see design-choice comment above.
      await transactionRepo.save({
        userId: driverId,
        orderId: null,
        amount: dto.amount,
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.WALLET,
        status: TransactionStatus.COMPLETED,
        externalId: `withdrawal_${withdrawal.id}`,
      });

      this.logger.log(
        `Withdrawal request ${withdrawal.id} created for driver ${driverId}, amount=${dto.amount}`,
      );

      return withdrawal;
    });
  }

  async getMyWithdrawals(driverId: string): Promise<WithdrawalRequest[]> {
    return this.withdrawalRepository.find({
      where: { driverId },
      order: { requestedAt: 'DESC' },
    });
  }

  // Admin/manager payout queue — across all owners (driver, Market vendor,
  // Eats restaurant), since requestWithdrawal now accepts all three (see
  // ownerType). `relations: ['driver']` loads the requesting User row
  // (phone/name) regardless of which ownerType actually filed it — the
  // relation is named after its original driver-only past, not its current
  // scope (see the entity's field comment).
  async getAllWithdrawals(
    status: WithdrawalStatus | undefined,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ withdrawals: WithdrawalRequest[]; total: number; page: number; limit: number }> {
    const [withdrawals, total] = await this.withdrawalRepository.findAndCount({
      where: status ? { status } : {},
      relations: ['driver'],
      order: { requestedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { withdrawals, total, page, limit };
  }

  async findWithdrawalOrThrow(id: string): Promise<WithdrawalRequest> {
    const withdrawal = await this.withdrawalRepository.findOne({ where: { id } });
    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal request with id ${id} not found`);
    }
    return withdrawal;
  }

  async processWithdrawal(
    id: string,
    dto: ProcessWithdrawalDto,
  ): Promise<WithdrawalRequest> {
    const withdrawal = await this.findWithdrawalOrThrow(id);

    if (dto.status === WithdrawalStatus.PENDING) {
      throw new BadRequestException('Cannot set a withdrawal request back to pending');
    }

    if (
      (dto.status === WithdrawalStatus.APPROVED || dto.status === WithdrawalStatus.REJECTED) &&
      withdrawal.status !== WithdrawalStatus.PENDING
    ) {
      throw new BadRequestException(
        `Only pending withdrawal requests can be ${dto.status}, current status is ${withdrawal.status}`,
      );
    }

    if (dto.status === WithdrawalStatus.PAID && withdrawal.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException(
        `Only approved withdrawal requests can be marked as paid, current status is ${withdrawal.status}`,
      );
    }

    if (dto.status === WithdrawalStatus.REJECTED) {
      // Reverse the hold placed at request time.
      await this.transactionRepository.save({
        userId: withdrawal.driverId,
        orderId: null,
        amount: withdrawal.amount,
        type: TransactionType.CREDIT,
        paymentMethod: PaymentMethod.WALLET,
        status: TransactionStatus.COMPLETED,
        externalId: `withdrawal_refund_${withdrawal.id}`,
      });
    }

    return this.withdrawalRepository.save({
      ...withdrawal,
      status: dto.status,
      adminNote: dto.adminNote ?? withdrawal.adminNote,
      processedAt: new Date(),
    });
  }
}
