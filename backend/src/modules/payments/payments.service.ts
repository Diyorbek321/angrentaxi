import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';
import { PaymentInitiateResult } from './payment.interface';

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
    private readonly paymeProvider: PaymeProvider,
    private readonly clickProvider: ClickProvider,
    private readonly uzcardProvider: UzcardProvider,
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
    const result = await this.transactionRepository
      .createQueryBuilder('t')
      .select(
        `SUM(CASE WHEN t.type = 'credit' AND t.status = 'completed' THEN t.amount ELSE 0 END) -
         SUM(CASE WHEN t.type = 'debit' AND t.status = 'completed' THEN t.amount ELSE 0 END)`,
        'balance',
      )
      .where('t.userId = :userId', { userId })
      .getRawOne<{ balance: string }>();

    const balance = parseFloat(result?.balance ?? '0');

    return { userId, balance: Math.max(0, balance) };
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
}
