import { ConfigService } from '@nestjs/config';
import {
  CardAutoChargeService,
  MAX_CONSECUTIVE_CARD_FAILURES,
  RECONCILE_AFTER_MS,
  RECONCILE_CANCEL_AFTER_MS,
} from './card-auto-charge.service';
import { OrderStatus, PaymentMethod } from '../../../database/entities/order.entity';
import { TransactionStatus } from '../../../database/entities/transaction.entity';
import { CardChargeAttempt } from '../../../database/entities/card-charge-attempt.entity';

const PENDING = { amount: 25000, status: TransactionStatus.PENDING, externalId: null };
const COMPLETED = { amount: 25000, status: TransactionStatus.COMPLETED, externalId: 'r1' };
const DECLINE_CODE = -31630;

function setup(overrides: { enabled?: boolean; configured?: boolean } = {}) {
  const order = {
    id: 'order-1',
    passengerId: 'p1',
    paymentMethod: PaymentMethod.CARD,
    status: OrderStatus.COMPLETED,
  };
  const orders = { findOne: jest.fn().mockResolvedValue(order) };
  const attempts = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 'att-1', createdAt: new Date() })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([]),
  };
  const payments = {
    getOrderPayment: jest.fn().mockResolvedValueOnce(PENDING).mockResolvedValue(COMPLETED),
  };
  const savedCards = {
    isEnabled: jest.fn().mockReturnValue(overrides.enabled ?? true),
    getChargeableCard: jest.fn().mockResolvedValue({ card: { id: 'card-1' }, token: 'tok' }),
    recordChargeSuccess: jest.fn().mockResolvedValue(undefined),
    recordChargeFailure: jest.fn().mockResolvedValue({ deactivated: false }),
  };
  const payme = {
    isConfigured: jest.fn().mockReturnValue(overrides.configured ?? true),
    createReceipt: jest.fn().mockResolvedValue({ ok: true, value: 'r1' }),
    payReceipt: jest.fn().mockResolvedValue({ ok: true, value: 4 }),
    cancelReceipt: jest.fn().mockResolvedValue({ ok: true, value: 50 }),
    getReceiptState: jest.fn().mockResolvedValue({ ok: true, value: 0 }),
  };
  const config = {
    get: jest.fn((k: string, d?: string) => (k === 'PAYME_CARD_DECLINE_CODES' ? `${DECLINE_CODE}, -31631` : d)),
  } as unknown as ConfigService;
  const service = new CardAutoChargeService(
    orders as never,
    attempts as never,
    payments as never,
    savedCards as never,
    payme as never,
    config,
  );
  return { service, order, orders, attempts, payments, savedCards, payme };
}

/** Holat o'tishi — doim `pending` sharti bilan. */
const moved = (status: string, failureReason: string | null) => [
  { id: 'att-1', status: 'pending' },
  { status, failureReason },
];

describe('CardAutoChargeService.chargeCompletedOrder', () => {
  it('does nothing while the feature is disabled', async () => {
    const { service, payme, orders } = setup({ enabled: false });
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('disabled');
    expect(orders.findOne).not.toHaveBeenCalled();
    expect(payme.createReceipt).not.toHaveBeenCalled();
  });

  it('skips non-card and unfinished orders', async () => {
    const { service, orders, payme } = setup();
    orders.findOne.mockResolvedValueOnce({ id: 'o', paymentMethod: PaymentMethod.CASH, status: OrderStatus.COMPLETED });
    await expect(service.chargeCompletedOrder('o')).resolves.toBe('not_card_order');
    orders.findOne.mockResolvedValueOnce({ id: 'o', paymentMethod: PaymentMethod.CARD, status: OrderStatus.IN_PROGRESS });
    await expect(service.chargeCompletedOrder('o')).resolves.toBe('not_card_order');
    expect(payme.createReceipt).not.toHaveBeenCalled();
  });

  it('never charges an order whose payment is already settled', async () => {
    const { service, payments, payme } = setup();
    payments.getOrderPayment.mockReset().mockResolvedValue(COMPLETED);
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('nothing_to_charge');
    expect(payme.createReceipt).not.toHaveBeenCalled();
  });

  it('falls back to the old flow when the passenger has no saved card', async () => {
    const { service, savedCards, attempts } = setup();
    savedCards.getChargeableCard.mockResolvedValue(null);
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('no_card');
    expect(attempts.save).not.toHaveBeenCalled();
  });

  it('charges the ledger amount and records success once the ledger is settled', async () => {
    const { service, payme, attempts, savedCards } = setup();
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('paid');
    expect(payme.createReceipt).toHaveBeenCalledWith(25000, 'order-1');
    expect(payme.payReceipt).toHaveBeenCalledWith('r1', 'tok');
    expect(attempts.update).toHaveBeenCalledWith(...moved('paid', null));
    expect(savedCards.recordChargeSuccess).toHaveBeenCalledWith('card-1');
  });

  it('paid at Payme but ledger still pending → review, never "paid"', async () => {
    const { service, payments, attempts, savedCards } = setup();
    payments.getOrderPayment.mockReset().mockResolvedValue(PENDING);
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('review');
    expect(attempts.update).toHaveBeenCalledWith(...moved('review', 'ledger_not_settled'));
    expect(savedCards.recordChargeSuccess).not.toHaveBeenCalled();
  });

  it('a concurrent second call cannot start another charge (unique index)', async () => {
    const { service, attempts, payme } = setup();
    attempts.save.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('in_progress');
    expect(payme.createReceipt).not.toHaveBeenCalled();
  });

  it('a real card decline fails the attempt, counts it and cancels the unpaid receipt', async () => {
    const { service, payme, attempts, savedCards } = setup();
    payme.payReceipt.mockResolvedValue({ ok: false, ambiguous: false, reason: 'payme_-31630', rpcCode: DECLINE_CODE });
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('declined');
    expect(attempts.update).toHaveBeenCalledWith(...moved('failed', 'payme_-31630'));
    expect(savedCards.recordChargeFailure).toHaveBeenCalledWith('card-1', MAX_CONSECUTIVE_CARD_FAILURES);
    expect(payme.cancelReceipt).toHaveBeenCalledWith('r1');
  });

  it('a non-card error (bad key, merchant busy) never counts against the card', async () => {
    const { service, payme, savedCards } = setup();
    payme.payReceipt.mockResolvedValue({ ok: false, ambiguous: false, reason: 'payme_-31052', rpcCode: -31052 });
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('provider_error');
    expect(savedCards.recordChargeFailure).not.toHaveBeenCalled();
  });

  it('an HTTP 4xx (no RPC code) never counts against the card', async () => {
    const { service, payme, savedCards } = setup();
    payme.payReceipt.mockResolvedValue({ ok: false, ambiguous: false, reason: 'http_401' });
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('provider_error');
    expect(savedCards.recordChargeFailure).not.toHaveBeenCalled();
  });

  it('does not cancel a receipt that turns out to be paid despite the error', async () => {
    const { service, payme, savedCards } = setup();
    payme.payReceipt.mockResolvedValue({ ok: false, ambiguous: false, reason: 'payme_-31630', rpcCode: DECLINE_CODE });
    payme.getReceiptState.mockResolvedValue({ ok: true, value: 4 });
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('paid');
    expect(payme.cancelReceipt).not.toHaveBeenCalled();
    expect(savedCards.recordChargeFailure).not.toHaveBeenCalled();
  });

  it('does not cancel when the receipt state is unknown — leaves it to the cron', async () => {
    const { service, payme, attempts } = setup();
    payme.payReceipt.mockResolvedValue({ ok: false, ambiguous: false, reason: 'payme_-31630', rpcCode: DECLINE_CODE });
    payme.getReceiptState.mockResolvedValue({ ok: false, ambiguous: true, reason: 'ETIMEDOUT' });
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('pending_reconcile');
    expect(payme.cancelReceipt).not.toHaveBeenCalled();
    expect(attempts.update).not.toHaveBeenCalledWith(...moved('failed', 'payme_-31630'));
  });

  it('a receipt that cannot be created is a provider error, not a card failure', async () => {
    const { service, payme, savedCards } = setup();
    payme.createReceipt.mockResolvedValue({ ok: false, ambiguous: true, reason: 'ETIMEDOUT' });
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('provider_error');
    expect(payme.payReceipt).not.toHaveBeenCalled();
    expect(savedCards.recordChargeFailure).not.toHaveBeenCalled();
  });

  it('a timeout while paying leaves the attempt pending for reconciliation', async () => {
    const { service, payme, savedCards } = setup();
    payme.payReceipt.mockResolvedValue({ ok: false, ambiguous: true, reason: 'ECONNABORTED' });
    await expect(service.chargeCompletedOrder('order-1')).resolves.toBe('pending_reconcile');
    expect(savedCards.recordChargeFailure).not.toHaveBeenCalled();
    expect(payme.cancelReceipt).not.toHaveBeenCalled();
  });

  it('the safe wrapper swallows unexpected errors', async () => {
    const { service, orders } = setup();
    orders.findOne.mockRejectedValue(new Error('db down'));
    await expect(service.chargeCompletedOrderSafely('order-1')).resolves.toBe('error');
  });
});

describe('CardAutoChargeService.reconcilePending', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  const attempt = (over: Partial<CardChargeAttempt>): CardChargeAttempt =>
    ({
      id: 'att-1',
      orderId: 'order-1',
      savedCardId: 'card-1',
      amount: 25000,
      providerReceiptId: 'r1',
      status: 'pending',
      failureReason: null,
      createdAt: new Date(now.getTime() - RECONCILE_AFTER_MS - 1000),
      updatedAt: new Date(now.getTime() - RECONCILE_AFTER_MS - 1000),
      ...over,
    }) as CardChargeAttempt;

  it('picks the least recently checked attempts first (no starvation)', async () => {
    const { service, attempts } = setup();
    await service.reconcilePending(now);
    expect(attempts.find).toHaveBeenCalledWith(expect.objectContaining({ order: { updatedAt: 'ASC' } }));
  });

  it('marks a receipt Payme reports as paid', async () => {
    const { service, attempts, payme, payments, savedCards } = setup();
    payments.getOrderPayment.mockReset().mockResolvedValue(COMPLETED);
    attempts.find.mockResolvedValue([attempt({})]);
    payme.getReceiptState.mockResolvedValue({ ok: true, value: 4 });
    await expect(service.reconcilePending(now)).resolves.toBe(1);
    expect(attempts.update).toHaveBeenCalledWith(...moved('paid', null));
    expect(savedCards.recordChargeSuccess).toHaveBeenCalledWith('card-1');
  });

  it('marks a cancelled receipt as failed without penalising the card', async () => {
    const { service, attempts, payme, savedCards } = setup();
    attempts.find.mockResolvedValue([attempt({})]);
    payme.getReceiptState.mockResolvedValue({ ok: true, value: 50 });
    await expect(service.reconcilePending(now)).resolves.toBe(1);
    expect(attempts.update).toHaveBeenCalledWith(...moved('failed', 'receipt_cancelled'));
    expect(savedCards.recordChargeFailure).not.toHaveBeenCalled();
  });

  it('an attempt that never got a receipt is closed as failed', async () => {
    const { service, attempts, payme } = setup();
    attempts.find.mockResolvedValue([attempt({ providerReceiptId: null })]);
    await expect(service.reconcilePending(now)).resolves.toBe(1);
    expect(payme.getReceiptState).not.toHaveBeenCalled();
  });

  it('keeps a recent undecided receipt pending', async () => {
    const { service, attempts, payme } = setup();
    attempts.find.mockResolvedValue([attempt({})]);
    payme.getReceiptState.mockResolvedValue({ ok: true, value: 5 });
    await expect(service.reconcilePending(now)).resolves.toBe(0);
    expect(payme.cancelReceipt).not.toHaveBeenCalled();
    expect(attempts.update).toHaveBeenCalledWith({ id: 'att-1', status: 'pending' }, { failureReason: 'state_5' });
  });

  it('cancels a long-unpaid receipt so the order is not blocked forever', async () => {
    const { service, attempts, payme } = setup();
    attempts.find.mockResolvedValue([attempt({ createdAt: new Date(now.getTime() - RECONCILE_CANCEL_AFTER_MS - 1) })]);
    payme.getReceiptState.mockResolvedValue({ ok: true, value: 0 });
    await expect(service.reconcilePending(now)).resolves.toBe(1);
    expect(payme.cancelReceipt).toHaveBeenCalledWith('r1');
    expect(attempts.update).toHaveBeenCalledWith(...moved('failed', 'receipt_expired'));
  });

  it('a lost race (status no longer pending) is not counted as resolved', async () => {
    const { service, attempts, payme } = setup();
    attempts.find.mockResolvedValue([attempt({})]);
    attempts.update.mockResolvedValue({ affected: 0 });
    payme.getReceiptState.mockResolvedValue({ ok: true, value: 50 });
    await expect(service.reconcilePending(now)).resolves.toBe(0);
  });

  it('the cron still reconciles when the feature flag is off, but not without keys', async () => {
    const off = setup({ enabled: false });
    await off.service.reconcileTick();
    expect(off.attempts.find).toHaveBeenCalled();

    const noKeys = setup({ configured: false });
    await noKeys.service.reconcileTick();
    expect(noKeys.attempts.find).not.toHaveBeenCalled();
  });
});
