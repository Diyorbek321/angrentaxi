import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Raw, Repository } from 'typeorm';
import { TAX_WITHHOLDING_LEDGER_TAG } from '../tax/tax-withholding';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import {
  MarketOrder,
  MarketOrderStatus,
} from '../../database/entities/market-order.entity';
import {
  FoodOrder,
  FoodOrderStatus,
} from '../../database/entities/food-order.entity';
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
import { computeWalletBalance, computeWithdrawableBalance, lockWalletForUpdate } from './wallet-balance.util';
import { SettingsService, DEFAULT_WALLET_TOPUP_HOLD_DAYS } from '../settings/settings.service';
import { ERROR_CODES, codedBadRequest } from '../../common/errors/coded-error';
import { formatSom } from '../delivery/vendor-wallet-settlement';
import { MoneyContext } from './money-context';
import { sameSomAmount, strictTiyin } from './tiyin';
import { IPayoutProvider, PAYOUT_PROVIDER, PayoutResult } from './payout.interface';
import { DriversService } from '../drivers/drivers.service';
import {
  UzcardTopupResponse,
  WalletTopupCallbacksService,
} from './wallet-topup-callbacks.service';
import { WalletTopupsService } from './wallet-topups.service';
import { syncDriverBalanceColumn } from './wallet-balance.util';
import { OrderRefundClawbackService } from './order-refund-clawback.service';

/** Buyurtma karta to'lovining joriy holati (merchant protokollari uchun). */
export interface OrderPaymentState {
  amount: number;
  status: TransactionStatus;
  externalId: string | null;
}

export type OrderPaymentOutcome = 'paid' | 'already_paid' | 'amount_mismatch' | 'not_payable' | 'not_found';

export interface WalletBalance {
  userId: string;
  balance: number;
  /** Yechib olish mumkin (karta to'ldirishlari ushlab turilgan, #3a). */
  availableForWithdrawal: number;
  /** Hozir ushlab turilgan summa. */
  withdrawalHold: number;
  withdrawalHoldDays: number;
  /**
   * Sarflanmagan bonus (haydovchi/referal bonusi, bonusdan chaqim) — komissiya,
   * soliq va smenaga sarflanadi, lekin yechib olinmaydi (audit #2).
   * `availableForWithdrawal` undan allaqachon ayirilgan. Qo'shimcha maydon.
   */
  bonusBalance: number;
}

/**
 * Driver-side DEBIT tags written against an order at completion. They share
 * the order id and payment method with the passenger's card charge, so the
 * payment lookup must exclude them explicitly.
 */
const DRIVER_LEDGER_TAGS: readonly string[] = ['commission', TAX_WITHHOLDING_LEDGER_TAG];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(MarketOrder)
    private readonly marketOrderRepository: Repository<MarketOrder>,
    @InjectRepository(FoodOrder)
    private readonly foodOrderRepository: Repository<FoodOrder>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepository: Repository<WithdrawalRequest>,
    private readonly paymeProvider: PaymeProvider,
    private readonly clickProvider: ClickProvider,
    private readonly uzcardProvider: UzcardProvider,
    private readonly dataSource: DataSource,
    private readonly driversService: DriversService,
    // Pul CHIQARISH yo'li — hozir qo'lda o'tkazma. Interfeys orqali
    // olinadi, ya'ni avtomatik provayder qo'shilganda bu sinf o'zgarmaydi.
    @Inject(PAYOUT_PROVIDER)
    private readonly payoutProvider: IPayoutProvider,
    // Hamyonni to'ldirish (`topup_<id>` havolasi) — docs/LEGAL-COMPLIANCE.md
    // §11. Ixtiyoriy: buyurtma callback'larini sinaydigan qo'lda yig'iladigan
    // spec'lar uni bilmaydi.
    @Optional() private readonly walletTopupCallbacks?: WalletTopupCallbacksService,
    // To'langan buyurtma qaytarilganda haydovchi/sotuvchi ulushini qaytarib
    // olish (§23). Ixtiyoriy — qo'lda yig'iladigan spec'lar uchun.
    @Optional() private readonly refundClawback?: OrderRefundClawbackService,
    // `walletTopupHoldDays` (#3a). Ixtiyoriy — qo'lda yig'iladigan spec'lar uchun.
    @Optional() private readonly settingsService?: SettingsService,
  ) {}

  /**
   * Resolves a payable order across all three verticals.
   *
   * This used to look only in `orders`, so a food or market order id was
   * rejected as "Order not found" — card checkout in the super-app could never
   * succeed, it just produced an error every single time. Market and food
   * orders are payable as soon as they are placed (the vendor is already
   * preparing them); a taxi ride is payable once the trip is complete and the
   * final fare is known.
   */
  private async resolvePayableOrder(
    orderId: string,
    userId: string,
  ): Promise<{ amount: number }> {
    const taxiOrder = await this.orderRepository.findOne({ where: { id: orderId } });

    if (taxiOrder) {
      if (taxiOrder.passengerId !== userId) {
        throw new BadRequestException('Order does not belong to you');
      }

      if (taxiOrder.status !== OrderStatus.COMPLETED) {
        throw new BadRequestException('Order must be completed before payment');
      }

      return { amount: taxiOrder.finalPrice ?? taxiOrder.estimatedPrice };
    }

    const marketOrder = await this.marketOrderRepository.findOne({
      where: { id: orderId },
    });

    if (marketOrder) {
      if (marketOrder.customerId !== userId) {
        throw new BadRequestException('Order does not belong to you');
      }

      if (marketOrder.status === MarketOrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot pay for a cancelled order');
      }

      return { amount: marketOrder.totalPrice };
    }

    const foodOrder = await this.foodOrderRepository.findOne({
      where: { id: orderId },
    });

    if (foodOrder) {
      if (foodOrder.customerId !== userId) {
        throw new BadRequestException('Order does not belong to you');
      }

      if (foodOrder.status === FoodOrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot pay for a cancelled order');
      }

      return { amount: foodOrder.totalPrice };
    }

    throw new NotFoundException('Order not found');
  }

  async initiatePayment(
    orderId: string,
    method: 'payme' | 'click' | 'uzcard',
    userId: string,
  ): Promise<PaymentInitiateResult> {
    const { amount } = await this.resolvePayableOrder(orderId, userId);

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
   *
   * ⚠️ The paymentMethod filter is load-bearing, not decoration. A tip writes
   * a second passenger DEBIT against the same orderId (OrdersTipsService,
   * tagged TIP_LEDGER_TAG) and it is created *after* the fare charge, so a
   * plain newest-DEBIT lookup would hand the provider callback the tip row:
   * the amount check would then compare the fare against the tip and reject a
   * legitimate payment — or, if the two amounts happened to match, settle the
   * order against the wrong ledger row. Tips are wallet-only, so restricting
   * the lookup to CARD keeps them out by construction.
   */
  private async findPaymentTransaction(
    orderId: string,
  ): Promise<Transaction | null> {
    // ⚠️ Driver-side rows on the SAME order are CARD DEBITs too: completion
    // books the driver's commission (`'commission'`) and the 1% tax
    // withholding (`'tax_withholding'`) with the order's payment method, and
    // they are created AFTER initiatePayment(). Without these filters the
    // newest-DEBIT lookup returned the commission/tax row and the amount
    // check rejected a legitimate payment. Two independent guards:
    //   1. payer — only the passenger's/customer's own rows;
    //   2. tags  — never a driver-ledger tag, even if the payer is unknown.
    const payerUserId = await this.resolvePayerUserId(orderId);
    const base = {
      orderId,
      type: TransactionType.DEBIT,
      paymentMethod: PaymentMethod.CARD,
      ...(payerUserId ? { userId: payerUserId } : {}),
    };
    return this.transactionRepository.findOne({
      where: {
        ...base,
        // NULL-safe "not a driver tag": a bare NOT IN would also drop the
        // passenger's completion row, whose external_id is NULL.
        externalId: Raw(
          (alias) => `(${alias} IS NULL OR ${alias} NOT IN (:...driverLedgerTags))`,
          { driverLedgerTags: DRIVER_LEDGER_TAGS },
        ),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Who pays for the order: taxi passenger or food/market customer. */
  private async resolvePayerUserId(orderId: string): Promise<string | null> {
    const taxiOrder = await this.orderRepository.findOne({ where: { id: orderId } });
    if (taxiOrder) return taxiOrder.passengerId;
    const marketOrder = await this.marketOrderRepository.findOne({ where: { id: orderId } });
    if (marketOrder) return marketOrder.customerId;
    const foodOrder = await this.foodOrderRepository.findOne({ where: { id: orderId } });
    return foodOrder?.customerId ?? null;
  }

  /**
   * Compares a callback amount (already normalised to UZS) with the amount
   * stored on the transaction. Uses a sub-tiyin tolerance because the DB
   * column is decimal(10,2) and providers round to whole tiyin.
   */
  /** Butun tiyinda qat'iy tenglik (security review #10). */
  private amountsMatch(callbackAmount: number, recordedAmount: number): boolean {
    return sameSomAmount(callbackAmount, recordedAmount);
  }

  // --- Buyurtma to'lovi — merchant protokollari uchun nishon ---
  //
  // Payme Merchant API va Click SHOP API protokoli `merchant/` papkasida
  // (hamyonni to'ldirish bilan UMUMIY). Bu yerda faqat buyurtmaning pul
  // qoidalari: summa, holat, bir martalik o'tish va haydovchi ulushini ochish.

  /** Buyurtmaning karta to'lovi qatori (initiatePayment yaratgan) — yo'q bo'lsa null. */
  async getOrderPayment(orderId: string): Promise<OrderPaymentState | null> {
    const transaction = await this.findPaymentTransaction(orderId);
    if (!transaction) return null;
    return {
      amount: Number(transaction.amount),
      status: transaction.status,
      externalId: transaction.externalId ?? null,
    };
  }

  /**
   * Provayder to'lovni o'tkazdi. Bir martalik: faqat `pending → completed`
   * shartli o'tish; xuddi shu provayder tranzaksiyasining takrori —
   * `already_paid` (daftar o'zgarmaydi), boshqa tranzaksiya bilan to'langan
   * buyurtma — `not_payable`.
   */
  async completeOrderPayment(
    orderId: string,
    input: { amount: number; externalId: string },
    // Merchant tranzaksiyasi (#8): da'vo va haydovchi ulushini ochish
    // protokol holati bilan BITTA tranzaksiyada.
    ctx?: MoneyContext,
  ): Promise<OrderPaymentOutcome> {
    const repo = ctx ? ctx.manager.getRepository(Transaction) : this.transactionRepository;
    const transaction = await this.findPaymentTransaction(orderId);
    if (!transaction) return 'not_found';
    if (!this.amountsMatch(input.amount, transaction.amount)) {
      this.logger.warn(
        `Payment amount mismatch for order ${orderId}: callback=${input.amount} UZS, expected=${transaction.amount} UZS`,
      );
      return 'amount_mismatch';
    }
    if (transaction.status === TransactionStatus.COMPLETED) {
      return transaction.externalId === input.externalId ? 'already_paid' : 'not_payable';
    }
    if (transaction.status !== TransactionStatus.PENDING) return 'not_payable';

    const claimed = await repo.update(
      { id: transaction.id, status: TransactionStatus.PENDING },
      { status: TransactionStatus.COMPLETED, externalId: input.externalId },
    );
    if (!claimed.affected) {
      // Parallel callback birinchi yetib keldi.
      const fresh = await repo.findOne({ where: { id: transaction.id } });
      return fresh?.status === TransactionStatus.COMPLETED && fresh.externalId === input.externalId
        ? 'already_paid'
        : 'not_payable';
    }

    this.logger.log(`Order ${orderId} paid (${input.externalId})`);
    // The fare is now actually collected, so the driver's payout legs
    // become spendable.
    await this.settleOrderPayout(orderId, ctx?.manager);
    return 'paid';
  }

  /**
   * To'langan buyurtma to'lovi provayder tomonidan qaytarildi (Payme
   * CancelTransaction state 2 → −2). `completed → refunded` (computeBalance
   * faqat COMPLETED ni sanaydi). Takroriy chaqiruv — `false`, hech narsa
   * o'zgarmaydi.
   */
  async refundOrderPayment(orderId: string, externalId: string): Promise<boolean> {
    const transaction =
      (await this.transactionRepository.findOne({
        where: { orderId, externalId, type: TransactionType.DEBIT, paymentMethod: PaymentMethod.CARD },
      })) ?? (await this.findPaymentTransaction(orderId));
    if (!transaction) return false;
    if (transaction.status === TransactionStatus.REFUNDED) {
      // Takror: daftar o'zgarmaydi, lekin oldingi clawback yiqilgan bo'lsa
      // shu yerda tiklanadi (u bir martalik — qayta DEBIT yozilmaydi).
      await this.clawbackAfterRefund(orderId, externalId);
      return false;
    }
    if (transaction.status !== TransactionStatus.COMPLETED) return false;
    const result = await this.transactionRepository.update(
      { id: transaction.id, status: TransactionStatus.COMPLETED },
      { status: TransactionStatus.REFUNDED },
    );
    if (result.affected) {
      this.logger.warn(`Order ${orderId} payment refunded by provider (${externalId})`);
      await this.clawbackAfterRefund(orderId, externalId);
    }
    return Boolean(result.affected);
  }

  /** §23 — hech qachon `throw` qilmaydi (provayder callback'i 200 qaytarishi kerak). */
  private async clawbackAfterRefund(orderId: string, externalId: string): Promise<void> {
    try {
      await this.refundClawback?.clawbackForRefundedPayment(orderId, externalId);
    } catch (err) {
      this.logger.error(`Refund clawback failed for order ${orderId}: ${(err as Error).message}`);
    }
  }

  async handleUzcardCallback(
    body: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string } | UzcardTopupResponse> {
    const isValid = this.uzcardProvider.verifyCallback(body);

    if (!isValid) {
      this.logger.warn('Invalid Uzcard callback signature');
      return { success: false, message: 'SIGNATURE_FAILED' };
    }

    if (this.walletTopupCallbacks && WalletTopupsService.isReference(body['order_id'])) {
      return this.walletTopupCallbacks.handleUzcard(body);
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
      // UzcardProvider.initiate() sends. Butun tiyin talab qilinadi (#10).
      const amountTiyin = strictTiyin(body['amount']);
      const callbackAmount = amountTiyin === null ? Number.NaN : amountTiyin / 100;

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

      // Imzo `status` va `transaction_id` ni qamramaydi (#7): provayder
      // status API'si shu tranzaksiyani to'langan deb tasdiqlashi shart.
      if (!transactionId || (await this.uzcardProvider.fetchStatus(transactionId)) !== 'PAID') {
        this.logger.warn(`Uzcard PAID for order ${orderId} not confirmed by status API (${transactionId ?? '—'})`);
        return { success: false, message: 'NOT_CONFIRMED' };
      }

      await this.transactionRepository.update(
        { id: transaction.id },
        {
          status: TransactionStatus.COMPLETED,
          externalId: transactionId ?? transaction.externalId,
        },
      );
      this.logger.log(`Uzcard payment completed for order ${orderId}`);

      await this.settleOrderPayout(orderId);
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

      // To'langan to'lovni qaytarish — provayder ham buni tasdiqlashi shart
      // (#7): soxta `status: CANCELLED` bilan haydovchi ulushini yechib
      // bo'lmasin. To'lanmagan to'lovni yopish pulga ta'sir qilmaydi.
      if (transaction.status === TransactionStatus.COMPLETED) {
        const providerStatus = transactionId ? await this.uzcardProvider.fetchStatus(transactionId) : null;
        if (providerStatus === null || providerStatus === 'PAID') {
          this.logger.warn(`Uzcard ${status} for paid order ${orderId} not confirmed (provider: ${providerStatus ?? '—'})`);
          return { success: false, message: 'NOT_CONFIRMED' };
        }
      }

      await this.transactionRepository.update(
        { id: transaction.id },
        { status: TransactionStatus.REFUNDED },
      );
      // To'langan to'lov qaytdi — haydovchi/sotuvchi ulushi qaytarib olinadi (§23).
      if (transaction.status === TransactionStatus.COMPLETED) {
        await this.clawbackAfterRefund(orderId, transactionId ?? transaction.externalId ?? 'uzcard');
      }
    }

    return { success: true, message: 'OK' };
  }

  async getWalletBalance(userId: string): Promise<WalletBalance> {
    const balance = await this.computeBalance(this.transactionRepository, userId);
    const holdDays = await this.withdrawalHoldDays();
    const { available, held, bonus } = await computeWithdrawableBalance(this.dataSource, userId, balance, holdDays);
    return {
      userId,
      balance,
      availableForWithdrawal: available,
      withdrawalHold: held,
      withdrawalHoldDays: holdDays,
      bonusBalance: bonus,
    };
  }

  private async withdrawalHoldDays(): Promise<number> {
    if (!this.settingsService) return DEFAULT_WALLET_TOPUP_HOLD_DAYS;
    return (await this.settingsService.getWalletTopupSettings()).walletTopupHoldDays;
  }

  // Delegates to the shared helper so every balance read in the codebase —
  // here, withdrawals, and trip settlement — uses the identical query.
  private async computeBalance(
    transactionRepo: Repository<Transaction>,
    userId: string,
  ): Promise<number> {
    return computeWalletBalance(transactionRepo, userId);
  }

  /**
   * Releases a driver's payout once the passenger's fare is actually
   * collected.
   *
   * OrdersCompletionService writes the driver's CREDIT (fare) and DEBIT
   * (commission) legs with the same status as the passenger charge, so for an
   * uncollected card payment they start PENDING and are therefore not
   * spendable — computeWalletBalance counts COMPLETED rows only. When a
   * provider callback settles the charge, this flips both legs to COMPLETED
   * and credits `drivers.balance` with the net payout the platform now owes.
   *
   * Idempotent: a replayed callback finds no PENDING legs and does nothing, so
   * a driver is never paid twice for one trip.
   */
  async settleOrderPayout(orderId: string, outerManager?: EntityManager): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order?.driverId) {
      return;
    }

    const driverUserId = order.driverId;

    const run = (work: (manager: EntityManager) => Promise<void>): Promise<void> =>
      outerManager ? work(outerManager) : this.dataSource.transaction(work);
    await run(async (manager: EntityManager) => {
      await lockWalletForUpdate(manager, driverUserId);

      const transactionRepo = manager.getRepository(Transaction);
      const pendingLegs = await transactionRepo.find({
        where: {
          orderId,
          userId: driverUserId,
          status: TransactionStatus.PENDING,
        },
      });

      if (pendingLegs.length === 0) {
        return;
      }

      let netPayout = 0;
      for (const leg of pendingLegs) {
        netPayout += leg.type === TransactionType.CREDIT ? leg.amount : -leg.amount;
        await transactionRepo.update({ id: leg.id }, { status: TransactionStatus.COMPLETED });
      }

      if (netPayout !== 0) {
        await this.driversService.adjustBalanceWithin(manager, driverUserId, netPayout);
      }

      this.logger.log(
        `Released driver payout of ${netPayout} for order ${orderId} after payment settlement`,
      );
    });
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
    const holdDays = await this.withdrawalHoldDays();
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

      // Yangi karta to'ldirishlari (#3a) va sarflanmagan bonus (audit #2)
      // yechib olinmaydi — shu qulf ichida.
      const { available, held, bonus } = await computeWithdrawableBalance(manager, driverId, balance, holdDays);
      if (dto.amount > available) {
        throw codedBadRequest(
          ERROR_CODES.walletWithdrawalOnHold,
          withdrawalBlockedMessage({ available, held, bonus, holdDays }),
          { details: { available, held, holdDays, bonus } },
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
      // `drivers.balance` — daftarning keshi (§13); sotuvchi uchun no-op.
      await syncDriverBalanceColumn(manager, driverId);

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

  // ⚠️ HOLAT O'ZGARISHI — SHARTLI DA'VO (pul auditi #1). Ilgari qator
  // qulfsiz o'qilib, oxirida to'liq `save` qilinardi: ikki parallel REJECT
  // pulni ikki marta qaytarardi, REJECT va APPROVE ikkalasi o'tib, so'rov ham
  // to'langan, ham qaytarilgan bo'lardi, ikki PAID esa provayderni ikki marta
  // chaqirardi. Endi har bir o'tish `UPDATE ... WHERE id AND status =
  // <kutilgan>` bilan boshlanadi; 1 qator ta'sirlanmasa — hech qanday pul
  // harakatisiz xato. Qaytarim CREDIT va holat — BITTA tranzaksiyada.
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

    if (dto.status === WithdrawalStatus.PAID) {
      if (withdrawal.status !== WithdrawalStatus.APPROVED) {
        throw new BadRequestException(
          `Only approved withdrawal requests can be marked as paid, current status is ${withdrawal.status}`,
        );
      }
      return this.payWithdrawal(withdrawal, dto);
    }

    return this.decideWithdrawal(withdrawal, dto);
  }

  /** PENDING → APPROVED / REJECTED. REJECT ushlab qolishni qaytaradi. */
  private async decideWithdrawal(
    withdrawal: WithdrawalRequest,
    dto: ProcessWithdrawalDto,
  ): Promise<WithdrawalRequest> {
    const patch = {
      status: dto.status,
      adminNote: dto.adminNote ?? withdrawal.adminNote,
      processedAt: new Date(),
    };

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const claimed = await manager
        .getRepository(WithdrawalRequest)
        .update({ id: withdrawal.id, status: WithdrawalStatus.PENDING }, patch);
      if (!claimed.affected) {
        throw new BadRequestException(
          `Withdrawal request ${withdrawal.id} is no longer pending — it was processed concurrently`,
        );
      }

      if (dto.status === WithdrawalStatus.REJECTED) {
        // Ushlab qolishni qaytarish — da'vo bilan bir tranzaksiyada, hamyon
        // qulfi ostida. `uq_transactions_withdrawal_refund` ikkinchi qavat.
        await lockWalletForUpdate(manager, withdrawal.driverId);
        await manager.getRepository(Transaction).save({
          userId: withdrawal.driverId,
          orderId: null,
          amount: withdrawal.amount,
          type: TransactionType.CREDIT,
          paymentMethod: PaymentMethod.WALLET,
          status: TransactionStatus.COMPLETED,
          externalId: `withdrawal_refund_${withdrawal.id}`,
        });
        // `drivers.balance` — daftarning keshi (§13); sotuvchi uchun no-op.
        await syncDriverBalanceColumn(manager, withdrawal.driverId);
      }
    });

    return { ...withdrawal, ...patch };
  }

  /**
   * APPROVED → PAID. Pul CHIQARISH aynan shu yerdan o'tadi. Hozirgi amalga
   * oshirish — qo'lda o'tkazma, ya'ni tarmoqqa chiqmaydi va faqat jurnalga
   * yozadi.
   *
   * ⚠️ NEGA chaqiruv hozir yoziladi. Payme/Click payout kalitlari
   * kelganda `payments.module.ts` dagi bitta bog'lanish o'zgaradi va bu
   * metod o'zgarishsiz qoladi. Aks holda o'sha kuni pul chiqarish
   * mantig'ining o'rtasiga tarmoq chaqiruvi kiritish kerak bo'lardi —
   * pul kodiga eng yomon paytda tegish.
   *
   * ⚠️ SINGLE-FLIGHT: provayderdan OLDIN `payoutStartedAt` shartli da'vo
   * qilinadi — ikki admin bir vaqtda bossa, faqat bittasi yuboradi
   * (`withdrawalId` — provayder uchun idempotentlik kaliti ham).
   *
   * ⚠️ Provayder yiqilsa holat O'ZGARMAYDI (xato yuqoriga otiladi, da'vo
   * bo'shatiladi): "to'landi" deb belgilab qo'yib, keyin pul ketmagan
   * bo'lishi haydovchining pulini yo'q qilardi — u daftarda yechilgan,
   * aslida esa hech qayerga bormagan.
   */
  private async payWithdrawal(
    withdrawal: WithdrawalRequest,
    dto: ProcessWithdrawalDto,
  ): Promise<WithdrawalRequest> {
    if (withdrawal.payoutStartedAt) {
      throw new BadRequestException(this.payoutInProgressMessage(withdrawal.id));
    }

    const payoutStartedAt = new Date();
    const claimed = await this.withdrawalRepository.update(
      { id: withdrawal.id, status: WithdrawalStatus.APPROVED, payoutStartedAt: IsNull() },
      { payoutStartedAt },
    );
    if (!claimed.affected) {
      throw new BadRequestException(this.payoutInProgressMessage(withdrawal.id));
    }

    let result: PayoutResult;
    try {
      result = await this.payoutProvider.send({
        amount: withdrawal.amount,
        destination: withdrawal.payoutDestination,
        withdrawalId: withdrawal.id,
      });
    } catch (err) {
      await this.releasePayoutClaim(withdrawal.id, payoutStartedAt);
      throw err;
    }
    this.logger.log(
      `Withdrawal ${withdrawal.id} paid via ${this.payoutProvider.name}` +
        (result.reference ? ` (ref ${result.reference})` : ''),
    );

    const patch = {
      status: WithdrawalStatus.PAID,
      adminNote: dto.adminNote ?? withdrawal.adminNote,
      payoutReference: result.reference ?? withdrawal.payoutReference,
      processedAt: new Date(),
    };
    const done = await this.withdrawalRepository.update(
      { id: withdrawal.id, status: WithdrawalStatus.APPROVED, payoutStartedAt },
      patch,
    );
    if (!done.affected) {
      // Pul KETDI, lekin holat yozilmadi. Da'vo turibdi — qayta yuborilmaydi.
      this.logger.error(
        `Withdrawal ${withdrawal.id} was sent (ref ${result.reference ?? '—'}) but its PAID status was not saved — fix manually`,
      );
    }
    return { ...withdrawal, ...patch, payoutStartedAt };
  }

  private payoutInProgressMessage(id: string): string {
    return (
      `Withdrawal request ${id} is no longer approved or its payout is already in progress. ` +
      'If a previous attempt was interrupted, check the provider before clearing payout_started_at.'
    );
  }

  /** Provayder yiqildi — keyingi urinish uchun da'voni bo'shatadi (best-effort). */
  private async releasePayoutClaim(id: string, payoutStartedAt: Date): Promise<void> {
    try {
      await this.withdrawalRepository.update(
        { id, status: WithdrawalStatus.APPROVED, payoutStartedAt },
        { payoutStartedAt: null },
      );
    } catch (err) {
      this.logger.error(`Could not release payout claim for withdrawal ${id}: ${(err as Error).message}`);
    }
  }
}

/**
 * Yechish rad etilganda — nima ushlab turilganini aniq aytadi. Bu yerga faqat
 * `amount <= balance` bo'lganda yetiladi, ya'ni ushlov yoki bonus albatta bor.
 */
function withdrawalBlockedMessage(input: { available: number; held: number; bonus: number; holdDays: number }): string {
  // Uch xil TO'LIQ jumla — har biri ERROR_CATALOGUE da ruscha tarjimaga ega
  // (bo'laklardan yig'ilgan matnni katalog tanimaydi).
  const available = formatSom(input.available);
  if (input.held > 0 && input.bonus > 0) {
    return (
      `Karta orqali to'ldirilgan ${formatSom(input.held)} so'm ${input.holdDays} kun davomida va bonus ` +
      `${formatSom(input.bonus)} so'm yechib olinmaydi (bonus faqat komissiya, soliq va smenaga sarflanadi). ` +
      `Hozir yechish mumkin: ${available} so'm.`
    );
  }
  if (input.bonus > 0) {
    return (
      `Bonus ${formatSom(input.bonus)} so'm yechib olinmaydi — u faqat komissiya, soliq va smenaga sarflanadi. ` +
      `Hozir yechish mumkin: ${available} so'm.`
    );
  }
  return (
    `Karta orqali to'ldirilgan ${formatSom(input.held)} so'm ${input.holdDays} kun davomida yechib olinmaydi. ` +
    `Hozir yechish mumkin: ${available} so'm.`
  );
}
