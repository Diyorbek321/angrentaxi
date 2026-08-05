import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { Order, PaymentMethod } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import { WithdrawalRequest } from '../../database/entities/withdrawal-request.entity';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';

/**
 * Coverage for the hardened payment-callback handlers: a valid callback
 * settles the payment, a mismatched amount is refused, and a replayed
 * callback is acknowledged without rewriting the ledger.
 *
 * Signature verification itself is delegated to the providers (and covered
 * by payme.provider.spec.ts / click.provider.spec.ts / uzcard.provider.spec.ts);
 * here it is mocked so the amount and idempotency rules can be exercised on
 * their own.
 */
describe('PaymentsService - provider callbacks', () => {
  const ORDER_ID = 'order-uuid-1';
  const AMOUNT_UZS = 25000;

  let service: PaymentsService;
  let transactionRepository: { findOne: jest.Mock; update: jest.Mock };
  let paymeProvider: { verifyCallbackSignature: jest.Mock };
  let clickProvider: { verifyCallbackSignature: jest.Mock };
  let uzcardProvider: { verifyCallback: jest.Mock };

  const makeTransaction = (
    status: TransactionStatus = TransactionStatus.PENDING,
  ): Transaction =>
    ({
      id: 'tx-1',
      userId: 'user-1',
      orderId: ORDER_ID,
      amount: AMOUNT_UZS,
      type: TransactionType.DEBIT,
      paymentMethod: PaymentMethod.CARD,
      status,
      externalId: `payme_${ORDER_ID}_1`,
    }) as Transaction;

  beforeEach(async () => {
    transactionRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    paymeProvider = { verifyCallbackSignature: jest.fn().mockReturnValue(true) };
    clickProvider = { verifyCallbackSignature: jest.fn().mockReturnValue(true) };
    uzcardProvider = { verifyCallback: jest.fn().mockReturnValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: getRepositoryToken(Order), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(WithdrawalRequest), useValue: {} },
        { provide: PaymeProvider, useValue: paymeProvider },
        { provide: ClickProvider, useValue: clickProvider },
        { provide: UzcardProvider, useValue: uzcardProvider },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Payme -------------------------------------------------------------

  describe('handlePaymeCallback()', () => {
    // Payme quotes amounts in tiyin.
    const performBody = (amountTiyin: number): Record<string, unknown> => ({
      method: 'PerformTransaction',
      params: {
        id: 'payme-tx-9',
        amount: amountTiyin,
        account: { order_id: ORDER_ID },
      },
    });

    it('rejects a callback whose signature does not verify', async () => {
      paymeProvider.verifyCallbackSignature.mockReturnValue(false);

      const result = await service.handlePaymeCallback(
        performBody(AMOUNT_UZS * 100),
        'Basic eDo=',
      );

      expect(result).toEqual({ allow: false });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('completes the transaction when signature and amount are correct', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      const result = await service.handlePaymeCallback(
        performBody(AMOUNT_UZS * 100),
        'Basic key',
      );

      expect(result).toEqual({ allow: true });
      expect(transactionRepository.update).toHaveBeenCalledWith(
        { id: 'tx-1' },
        { status: TransactionStatus.COMPLETED, externalId: 'payme-tx-9' },
      );
    });

    it('rejects a callback whose amount does not match the stored amount', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      // Attacker pays 100 UZS for a 25 000 UZS order.
      const result = await service.handlePaymeCallback(
        performBody(100 * 100),
        'Basic key',
      );

      expect(result).toEqual({ allow: false });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a callback for an unknown order', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      const result = await service.handlePaymeCallback(
        performBody(AMOUNT_UZS * 100),
        'Basic key',
      );

      expect(result).toEqual({ allow: false });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('acknowledges a replayed callback without rewriting the transaction', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.COMPLETED),
      );

      const result = await service.handlePaymeCallback(
        performBody(AMOUNT_UZS * 100),
        'Basic key',
      );

      expect(result).toEqual({ allow: true });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('refuses to complete a transaction that was already refunded', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.REFUNDED),
      );

      const result = await service.handlePaymeCallback(
        performBody(AMOUNT_UZS * 100),
        'Basic key',
      );

      expect(result).toEqual({ allow: false });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('reverses a completed transaction on CancelTransaction', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.COMPLETED),
      );

      const result = await service.handlePaymeCallback(
        { method: 'CancelTransaction', params: { id: 'payme-tx-9' } },
        'Basic key',
      );

      expect(result).toEqual({ allow: true });
      expect(transactionRepository.update).toHaveBeenCalledWith(
        { id: 'tx-1' },
        { status: TransactionStatus.REFUNDED },
      );
    });

    it('treats a repeated CancelTransaction as a no-op', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.REFUNDED),
      );

      const result = await service.handlePaymeCallback(
        { method: 'CancelTransaction', params: { id: 'payme-tx-9' } },
        'Basic key',
      );

      expect(result).toEqual({ allow: true });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });
  });

  // --- Click -------------------------------------------------------------

  describe('handleClickCallback()', () => {
    // Click quotes amounts in whole soum.
    const completeBody = (amount: number): Record<string, unknown> => ({
      action: 2,
      amount,
      merchant_trans_id: ORDER_ID,
      click_trans_id: 'click-tx-7',
    });

    it('rejects a callback whose signature does not verify', async () => {
      clickProvider.verifyCallbackSignature.mockReturnValue(false);

      const result = await service.handleClickCallback(completeBody(AMOUNT_UZS));

      expect(result).toEqual({ error: -1, error_note: 'SIGNATURE_FAILED' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('completes the transaction when signature and amount are correct', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      const result = await service.handleClickCallback(completeBody(AMOUNT_UZS));

      expect(result).toEqual({ error: 0, error_note: 'Success' });
      expect(transactionRepository.update).toHaveBeenCalledWith(
        { id: 'tx-1' },
        {
          status: TransactionStatus.COMPLETED,
          externalId: `click_${ORDER_ID}_click-tx-7`,
        },
      );
    });

    it('rejects a callback whose amount does not match the stored amount', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      const result = await service.handleClickCallback(completeBody(100));

      expect(result).toEqual({ error: -2, error_note: 'INCORRECT_AMOUNT' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a callback for an unknown order', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      const result = await service.handleClickCallback(completeBody(AMOUNT_UZS));

      expect(result).toEqual({ error: -5, error_note: 'TRANSACTION_NOT_FOUND' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('acknowledges a replayed callback without rewriting the transaction', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.COMPLETED),
      );

      const result = await service.handleClickCallback(completeBody(AMOUNT_UZS));

      expect(result).toEqual({ error: 0, error_note: 'Success' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('does not touch the ledger on the prepare action', async () => {
      const result = await service.handleClickCallback({
        ...completeBody(AMOUNT_UZS),
        action: 1,
      });

      expect(result).toEqual({ error: 0, error_note: 'Success' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });
  });

  // --- Uzcard ------------------------------------------------------------

  describe('handleUzcardCallback()', () => {
    // UZPS quotes amounts in tiyin.
    const paidBody = (amountTiyin: number): Record<string, unknown> => ({
      status: 'PAID',
      order_id: ORDER_ID,
      transaction_id: 'uzcard-tx-3',
      amount: amountTiyin,
    });

    it('rejects a callback whose signature does not verify', async () => {
      uzcardProvider.verifyCallback.mockReturnValue(false);

      const result = await service.handleUzcardCallback(paidBody(AMOUNT_UZS * 100));

      expect(result).toEqual({ success: false, message: 'SIGNATURE_FAILED' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('completes the transaction when signature and amount are correct', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      const result = await service.handleUzcardCallback(paidBody(AMOUNT_UZS * 100));

      expect(result).toEqual({ success: true, message: 'OK' });
      expect(transactionRepository.update).toHaveBeenCalledWith(
        { id: 'tx-1' },
        { status: TransactionStatus.COMPLETED, externalId: 'uzcard-tx-3' },
      );
    });

    it('rejects a callback whose amount does not match the stored amount', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      const result = await service.handleUzcardCallback(paidBody(100 * 100));

      expect(result).toEqual({ success: false, message: 'AMOUNT_MISMATCH' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a callback for an unknown order', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      const result = await service.handleUzcardCallback(paidBody(AMOUNT_UZS * 100));

      expect(result).toEqual({ success: false, message: 'ORDER_NOT_FOUND' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('acknowledges a replayed callback without rewriting the transaction', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.COMPLETED),
      );

      const result = await service.handleUzcardCallback(paidBody(AMOUNT_UZS * 100));

      expect(result).toEqual({ success: true, message: 'OK' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('reverses a completed transaction on a CANCELLED callback', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.COMPLETED),
      );

      const result = await service.handleUzcardCallback({
        status: 'CANCELLED',
        order_id: ORDER_ID,
        transaction_id: 'uzcard-tx-3',
      });

      expect(result).toEqual({ success: true, message: 'OK' });
      expect(transactionRepository.update).toHaveBeenCalledWith(
        { id: 'tx-1' },
        { status: TransactionStatus.REFUNDED },
      );
    });

    it('treats a repeated CANCELLED callback as a no-op', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.REFUNDED),
      );

      const result = await service.handleUzcardCallback({
        status: 'CANCELLED',
        order_id: ORDER_ID,
        transaction_id: 'uzcard-tx-3',
      });

      expect(result).toEqual({ success: true, message: 'OK' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });
  });
});
