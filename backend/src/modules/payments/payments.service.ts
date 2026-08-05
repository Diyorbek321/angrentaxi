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

  // --- Payment provider callbacks ---
  //
  // Every callback handler below follows the same three checks, in order,
  // before it is willing to move money:
  //
  //   1. Signature — delegated to the provider (all three fail closed when
  //      their keys are unconfigured, so a half-provisioned deployment can
  //      never be talked into completing a payment).
  //   2. Amount — the sum the provider says was charged must match the
  //      amount recorded when the payment was initiated. Without this check
  //      a caller who can produce a valid signature could settle a 500 000
  //      UZS order by paying 100 UZS.
  //   3. Idempotency — providers retry callbacks until they get a success
  //      response, and a retry (or a replayed capture) must not rewrite a
  //      transaction that already reached a terminal state.
  //
  // Transactions are located by orderId rather than by externalId: at
  // initiate() time we only know our own locally generated id, while the
  // callback carries the provider's id. Matching on both (as the previous
  // implementation did) could never succeed. The provider's id is stored on
  // the row when the payment completes, so it is available afterwards.

  /**
   * Looks up the card payment transaction created by initiatePayment() for
   * an order. Withdrawal-hold transactions have a null orderId, so they can
   * never be matched here.
   */
  private async findPaymentTransaction(
    orderId: string,
  ): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { orderId, type: TransactionType.DEBIT },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Compares a callback amount (already normalised to UZS) with the amount
   * stored on the transaction. Uses a sub-tiyin tolerance because the DB
   * column is decimal(10,2) and providers round to whole tiyin.
   */
  private amountsMatch(callbackAmount: number, recordedAmount: number): boolean {
    if (!Number.isFinite(callbackAmount)) {
      return false;
    }

    return Math.abs(callbackAmount - recordedAmount) < 0.01;
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
    const params = (body['params'] as Record<string, unknown>) ?? {};

    this.logger.log(`Payme callback received: method=${method}`);

    if (method === 'PerformTransaction') {
      const externalId = params['id'] as string;
      const accountOrderId = (params['account'] as Record<string, string>)?.[
        'order_id'
      ];

      if (!accountOrderId) {
        this.logger.warn('Payme PerformTransaction without account.order_id');
        return { allow: false };
      }

      const transaction = await this.findPaymentTransaction(accountOrderId);

      if (!transaction) {
        this.logger.warn(
          `Payme PerformTransaction for unknown order ${accountOrderId}`,
        );
        return { allow: false };
      }

      // Payme quotes amounts in tiyin (1 UZS = 100 tiyin) — the same unit
      // PaymeProvider.initiate() sends.
      const callbackAmount = Number(params['amount']) / 100;

      if (!this.amountsMatch(callbackAmount, transaction.amount)) {
        this.logger.warn(
          `Payme amount mismatch for order ${accountOrderId}: callback=${callbackAmount} UZS, expected=${transaction.amount} UZS`,
        );
        return { allow: false };
      }

      if (transaction.status === TransactionStatus.COMPLETED) {
        // Replay of an already-settled payment. Acknowledge it so Payme
        // stops retrying, but leave the ledger untouched.
        this.logger.log(
          `Payme PerformTransaction replay ignored for order ${accountOrderId}`,
        );
        return { allow: true };
      }

      if (transaction.status !== TransactionStatus.PENDING) {
        this.logger.warn(
          `Payme PerformTransaction for order ${accountOrderId} in terminal status ${transaction.status}`,
        );
        return { allow: false };
      }

      await this.transactionRepository.update(
        { id: transaction.id },
        { status: TransactionStatus.COMPLETED, externalId },
      );

      this.logger.log(`Payme payment completed for order ${accountOrderId}`);
    } else if (method === 'CancelTransaction') {
      // CancelTransaction carries only Payme's own transaction id, which we
      // persist on the row when PerformTransaction settles it.
      const externalId = params['id'] as string;
      const accountOrderId = (params['account'] as Record<string, string>)?.[
        'order_id'
      ];

      const transaction = accountOrderId
        ? await this.findPaymentTransaction(accountOrderId)
        : await this.transactionRepository.findOne({ where: { externalId } });

      if (!transaction) {
        this.logger.warn(`Payme CancelTransaction for unknown id ${externalId}`);
        return { allow: true };
      }

      // State machine for cancellation, deliberately different from the
      // completion path: COMPLETED is *not* terminal here. Payme genuinely
      // supports reversing an already-performed transaction (a refund), and
      // the ledger models that correctly — computeBalance() only counts
      // COMPLETED rows, so flipping to REFUNDED withdraws the credit. What
      // must not happen is re-cancelling an already-REFUNDED row (a retried
      // callback) or "cancelling" a FAILED one; both are no-ops that still
      // return success so Payme stops retrying.
      if (
        transaction.status !== TransactionStatus.PENDING &&
        transaction.status !== TransactionStatus.COMPLETED
      ) {
        this.logger.log(
          `Payme CancelTransaction ignored — transaction already ${transaction.status}`,
        );
        return { allow: true };
      }

      await this.transactionRepository.update(
        { id: transaction.id },
        { status: TransactionStatus.REFUNDED },
      );

      this.logger.log(`Payme transaction ${transaction.id} cancelled/refunded`);
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

    const action = Number(body['action']);
    const merchantTransId = body['merchant_trans_id'] as string;
    const clickTransId = body['click_trans_id'] as string;

    // Action 1 = prepare, Action 2 = complete
    if (action === 2) {
      if (!merchantTransId) {
        return { error: -5, error_note: 'TRANSACTION_NOT_FOUND' };
      }

      const transaction = await this.findPaymentTransaction(merchantTransId);

      if (!transaction) {
        this.logger.warn(`Click complete for unknown order ${merchantTransId}`);
        return { error: -5, error_note: 'TRANSACTION_NOT_FOUND' };
      }

      // Click quotes amounts in whole soum — the same unit
      // ClickProvider.initiate() sends.
      const callbackAmount = Number(body['amount']);

      if (!this.amountsMatch(callbackAmount, transaction.amount)) {
        this.logger.warn(
          `Click amount mismatch for order ${merchantTransId}: callback=${callbackAmount} UZS, expected=${transaction.amount} UZS`,
        );
        return { error: -2, error_note: 'INCORRECT_AMOUNT' };
      }

      if (transaction.status === TransactionStatus.COMPLETED) {
        // Retry of a callback we already settled. Answer success so Click
        // stops retrying; the ledger stays as it is.
        this.logger.log(`Click complete replay ignored for order ${merchantTransId}`);
        return { error: 0, error_note: 'Success' };
      }

      if (transaction.status !== TransactionStatus.PENDING) {
        this.logger.warn(
          `Click complete for order ${merchantTransId} in terminal status ${transaction.status}`,
        );
        return { error: -9, error_note: 'TRANSACTION_CANCELLED' };
      }

      await this.transactionRepository.update(
        { id: transaction.id },
        {
          status: TransactionStatus.COMPLETED,
          externalId: `click_${merchantTransId}_${clickTransId}`,
        },
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

    if (!orderId) {
      this.logger.warn('Uzcard callback without order_id');
      return { success: false, message: 'ORDER_NOT_FOUND' };
    }

    const transaction = await this.findPaymentTransaction(orderId);

    if (!transaction) {
      this.logger.warn(`Uzcard callback for unknown order ${orderId}`);
      return { success: false, message: 'ORDER_NOT_FOUND' };
    }

    if (status === 'PAID') {
      // UZPS quotes amounts in tiyin — the same unit
      // UzcardProvider.initiate() sends.
      const callbackAmount = Number(body['amount']) / 100;

      if (!this.amountsMatch(callbackAmount, transaction.amount)) {
        this.logger.warn(
          `Uzcard amount mismatch for order ${orderId}: callback=${callbackAmount} UZS, expected=${transaction.amount} UZS`,
        );
        return { success: false, message: 'AMOUNT_MISMATCH' };
      }

      if (transaction.status === TransactionStatus.COMPLETED) {
        // Retry of an already-settled payment: acknowledge, change nothing.
        this.logger.log(`Uzcard PAID replay ignored for order ${orderId}`);
        return { success: true, message: 'OK' };
      }

      if (transaction.status !== TransactionStatus.PENDING) {
        this.logger.warn(
          `Uzcard PAID for order ${orderId} in terminal status ${transaction.status}`,
        );
        return { success: false, message: 'INVALID_STATE' };
      }

      await this.transactionRepository.update(
        { id: transaction.id },
        {
          status: TransactionStatus.COMPLETED,
          externalId: transactionId ?? transaction.externalId,
        },
      );
      this.logger.log(`Uzcard payment completed for order ${orderId}`);
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      // Same reasoning as the Payme cancel path: reversing a settled
      // payment is legitimate, re-reversing an already-REFUNDED one is a
      // retry and must be a no-op.
      if (
        transaction.status !== TransactionStatus.PENDING &&
        transaction.status !== TransactionStatus.COMPLETED
      ) {
        this.logger.log(
          `Uzcard ${status} ignored — transaction already ${transaction.status}`,
        );
        return { success: true, message: 'OK' };
      }

      await this.transactionRepository.update(
        { id: transaction.id },
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
