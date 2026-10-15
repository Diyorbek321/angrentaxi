import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
import { WithdrawalRequest } from '../../database/entities/withdrawal-request.entity';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';
import { PAYOUT_PROVIDER } from './payout.interface';
import { DriversService } from '../drivers/drivers.service';
import { OrderRefundClawbackService } from './order-refund-clawback.service';

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
  let clawback: { clawbackForRefundedPayment: jest.Mock };
  let transactionRepository: { findOne: jest.Mock; update: jest.Mock };
  let paymeProvider: { verifyCallbackSignature: jest.Mock };
  let clickProvider: { verifyCallbackSignature: jest.Mock };
  let uzcardProvider: { verifyCallback: jest.Mock; fetchStatus: jest.Mock };

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
    uzcardProvider = { verifyCallback: jest.fn().mockReturnValue(true), fetchStatus: jest.fn().mockResolvedValue('PAID') };
    clawback = { clawbackForRefundedPayment: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        // settleOrderPayout looks the order up to find its driver. These
        // callback tests assert ledger status transitions, not payout release,
        // so the order resolves with no driver and settlement is a no-op.
        {
          provide: getRepositoryToken(Order),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        { provide: getRepositoryToken(MarketOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(FoodOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(WithdrawalRequest), useValue: {} },
        { provide: PaymeProvider, useValue: paymeProvider },
        { provide: ClickProvider, useValue: clickProvider },
        { provide: UzcardProvider, useValue: uzcardProvider },
        // Pul CHIQARISH adapteri. Qo'lda o'tkazma hech qanday tarmoqqa
        // chiqmaydi, shuning uchun mock ham shunchaki natija qaytaradi.
        {
          provide: PAYOUT_PROVIDER,
          useValue: {
            name: 'manual',
            send: jest.fn().mockResolvedValue({ reference: null, settled: true }),
          },
        },
        // settleOrderPayout credits drivers.balance once a card payment lands.
        {
          provide: DriversService,
          useValue: { adjustBalanceWithin: jest.fn().mockResolvedValue({
            driverId: 'driver-profile-1',
            newBalance: 0,
            wentOffline: false,
          }) },
        },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: OrderRefundClawbackService, useValue: clawback },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Buyurtma to'lovi (Payme/Click merchant protokollari nishoni) -------
  //
  // Protokol (JSON-RPC, prepare/complete, imzo) `merchant/*.spec.ts` da;
  // bu yerda buyurtmaning pul qoidalari: summa, bir martalik, refund.

  describe('completeOrderPayment()', () => {
    const pay = (amount = AMOUNT_UZS, externalId = 'payme_p9') =>
      service.completeOrderPayment(ORDER_ID, { amount, externalId });

    it("to'g'ri summa — pending → completed (shartli yozuv), 'paid'", async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      await expect(pay()).resolves.toBe('paid');
      expect(transactionRepository.update).toHaveBeenCalledWith(
        { id: 'tx-1', status: TransactionStatus.PENDING },
        { status: TransactionStatus.COMPLETED, externalId: 'payme_p9' },
      );
    });

    // ⚠️ REGRESSIYA: chaqim (tips) ayni shu buyurtmaga yo'lovchi nomidan
    // IKKINCHI DEBIT yozadi va u yo'l haqidan KEYIN yaratiladi. CARD filtri
    // uni tuzilishiga ko'ra chetlab o'tadi.
    it('looks up the card debit only, so a wallet tip cannot shadow it', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      await pay();

      expect(transactionRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderId: ORDER_ID,
            type: TransactionType.DEBIT,
            paymentMethod: PaymentMethod.CARD,
          }),
        }),
      );
    });

    it("summa mos emas — 'amount_mismatch', daftar o'zgarmaydi", async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());
      await expect(pay(100)).resolves.toBe('amount_mismatch');
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it("noma'lum buyurtma — 'not_found'", async () => {
      transactionRepository.findOne.mockResolvedValue(null);
      await expect(pay()).resolves.toBe('not_found');
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it("xuddi shu provayder tranzaksiyasining takrori — 'already_paid', daftar o'zgarmaydi", async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...makeTransaction(TransactionStatus.COMPLETED),
        externalId: 'payme_p9',
      });
      await expect(pay()).resolves.toBe('already_paid');
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it("boshqa tranzaksiya bilan to'langan — 'not_payable' (ikki marta to'lanmaydi)", async () => {
      transactionRepository.findOne.mockResolvedValue({
        ...makeTransaction(TransactionStatus.COMPLETED),
        externalId: 'click_1',
      });
      await expect(pay()).resolves.toBe('not_payable');
    });

    it("qaytarilgan to'lovni yakunlamaydi — 'not_payable'", async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction(TransactionStatus.REFUNDED));
      await expect(pay()).resolves.toBe('not_payable');
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it("parallel callback birinchi yozgan bo'lsa — 'already_paid'", async () => {
      transactionRepository.findOne
        .mockResolvedValueOnce(makeTransaction())
        .mockResolvedValueOnce({ ...makeTransaction(TransactionStatus.COMPLETED), externalId: 'payme_p9' });
      transactionRepository.update.mockResolvedValueOnce({ affected: 0 });
      await expect(pay()).resolves.toBe('already_paid');
    });
  });

  describe('refundOrderPayment()', () => {
    it('completed → refunded', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction(TransactionStatus.COMPLETED));
      await expect(service.refundOrderPayment(ORDER_ID, 'payme_p9')).resolves.toBe(true);
      expect(transactionRepository.update).toHaveBeenCalledWith(
        { id: 'tx-1', status: TransactionStatus.COMPLETED },
        { status: TransactionStatus.REFUNDED },
      );
    });

    it('takroriy refund — no-op', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction(TransactionStatus.REFUNDED));
      await expect(service.refundOrderPayment(ORDER_ID, 'payme_p9')).resolves.toBe(false);
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    // §23: haydovchi/sotuvchi ulushi qaytarib olinadi (bir martalik — servis o'zi kafolatlaydi).
    it("refunddan keyin ulush qaytarib olinadi (clawback)", async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction(TransactionStatus.COMPLETED));
      await service.refundOrderPayment(ORDER_ID, 'payme_p9');
      expect(clawback.clawbackForRefundedPayment).toHaveBeenCalledWith(ORDER_ID, 'payme_p9');
    });

    it("takroriy refund ham clawback'ni chaqiradi (avvalgisi yiqilgan bo'lsa tiklanadi; idempotent)", async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction(TransactionStatus.REFUNDED));
      await service.refundOrderPayment(ORDER_ID, 'payme_p9');
      expect(clawback.clawbackForRefundedPayment).toHaveBeenCalledWith(ORDER_ID, 'payme_p9');
    });

    it("clawback xatosi provayder javobini buzmaydi", async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction(TransactionStatus.COMPLETED));
      clawback.clawbackForRefundedPayment.mockRejectedValue(new Error('db down'));
      await expect(service.refundOrderPayment(ORDER_ID, 'payme_p9')).resolves.toBe(true);
    });

    it("to'lanmagan (pending) to'lov — clawback yo'q", async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction(TransactionStatus.PENDING));
      await expect(service.refundOrderPayment(ORDER_ID, 'payme_p9')).resolves.toBe(false);
      expect(clawback.clawbackForRefundedPayment).not.toHaveBeenCalled();
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

    // Security review #7: UZPS imzosi `status` va `transaction_id` ni
    // qamramaydi — pulga ta'sir qiluvchi o'tish provayder status API'si bilan.
    it('does not complete a PAID callback the provider status API does not confirm', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());
      uzcardProvider.fetchStatus.mockResolvedValue('PENDING');

      const result = await service.handleUzcardCallback(paidBody(AMOUNT_UZS * 100));

      expect(result).toEqual({ success: false, message: 'NOT_CONFIRMED' });
      expect(uzcardProvider.fetchStatus).toHaveBeenCalledWith('uzcard-tx-3');
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a PAID callback without transaction_id', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      const result = await service.handleUzcardCallback({ status: 'PAID', order_id: ORDER_ID, amount: AMOUNT_UZS * 100 });

      expect(result.success).toBe(false);
      expect(transactionRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a fractional-tiyin amount (#10)', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction());

      const result = await service.handleUzcardCallback(paidBody(AMOUNT_UZS * 100 + 0.4));

      expect(result).toEqual({ success: false, message: 'AMOUNT_MISMATCH' });
    });

    it('ignores a CANCELLED callback for a completed payment the provider still reports PAID', async () => {
      transactionRepository.findOne.mockResolvedValue(makeTransaction(TransactionStatus.COMPLETED));
      uzcardProvider.fetchStatus.mockResolvedValue('PAID');

      const result = await service.handleUzcardCallback({
        status: 'CANCELLED',
        order_id: ORDER_ID,
        transaction_id: 'uzcard-tx-3',
      });

      expect(result).toEqual({ success: false, message: 'NOT_CONFIRMED' });
      expect(transactionRepository.update).not.toHaveBeenCalled();
      expect(clawback.clawbackForRefundedPayment).not.toHaveBeenCalled();
    });

    it('reverses a completed transaction on a CANCELLED callback', async () => {
      transactionRepository.findOne.mockResolvedValue(
        makeTransaction(TransactionStatus.COMPLETED),
      );
      uzcardProvider.fetchStatus.mockResolvedValue('CANCELLED');

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
      // To'langan to'lov qaytdi — ulush qaytarib olinadi (§23).
      expect(clawback.clawbackForRefundedPayment).toHaveBeenCalledWith(ORDER_ID, 'uzcard-tx-3');
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
