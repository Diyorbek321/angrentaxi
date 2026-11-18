import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, FindOperator } from 'typeorm';
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
import { TAX_WITHHOLDING_LEDGER_TAG } from '../tax/tax-withholding';

/**
 * Regression: the provider callback must find the PASSENGER's card payment
 * row, never the driver's commission or tax-withholding DEBIT on the same
 * order. Card trips write all three as CARD DEBITs against one order id, and
 * the driver rows are created later at completion — a plain "newest CARD
 * DEBIT" lookup handed the callback the commission/tax row and the amount
 * check rejected a legitimate payment.
 *
 * The transaction repository is an in-memory ledger that evaluates the
 * `where` the service passes (including TypeORM IsNull/Not/In operators), so
 * the test checks the actual selection, not just the query shape.
 */
describe('PaymentsService — passenger payment lookup', () => {
  const ORDER_ID = 'order-1';
  const PASSENGER = 'passenger-1';
  const DRIVER = 'driver-user-1';
  const FARE = 25000;

  let ledger: Array<Partial<Transaction> & { createdAt: Date }>;
  let update: jest.Mock;
  let service: PaymentsService;

  const matchesValue = (actual: unknown, expected: unknown): boolean => {
    if (expected instanceof FindOperator) {
      const op = expected as FindOperator<unknown>;
      switch (op.type) {
        case 'isNull':
          return actual === null || actual === undefined;
        case 'in':
          return (op.value as unknown[]).includes(actual);
        case 'not':
          return actual !== null && actual !== undefined && !matchesValue(actual, op.value);
        case 'raw':
          return evaluateRaw(op, actual);
        default:
          throw new Error(`unsupported operator ${op.type}`);
      }
    }
    return actual === expected;
  };

  /**
   * Evaluates the one Raw shape the service uses:
   * `(col IS NULL OR col NOT IN (:...param))`. Anything else fails loudly.
   */
  function evaluateRaw(op: FindOperator<unknown>, actual: unknown): boolean {
    const sql = (op.getSql as (alias: string) => string)('col');
    const m = /^\(col IS NULL OR col NOT IN \(:\.\.\.(\w+)\)\)$/.exec(sql);
    if (!m) throw new Error(`unsupported raw sql ${sql}`);
    const params = op.objectLiteralParameters as Record<string, unknown[]>;
    return actual === null || actual === undefined || !params[m[1]].includes(actual);
  }

  const matches = (row: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, value]) => matchesValue(row[key], value));

  const findOne = jest.fn(
    async (options: { where: Record<string, unknown> | Array<Record<string, unknown>> }) => {
      const clauses = Array.isArray(options.where) ? options.where : [options.where];
      const hits = ledger
        .filter((row) => clauses.some((c) => matches(row as Record<string, unknown>, c)))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return hits[0] ?? null;
    },
  );

  const row = (over: Partial<Transaction>, minute: number) => ({
    orderId: ORDER_ID,
    type: TransactionType.DEBIT,
    paymentMethod: PaymentMethod.CARD,
    status: TransactionStatus.PENDING,
    createdAt: new Date(Date.UTC(2026, 9, 15, 10, minute)),
    ...over,
  });

  beforeEach(async () => {
    update = jest.fn().mockResolvedValue({ affected: 1 });
    ledger = [
      // initiatePayment — the passenger's card charge (provider's own id).
      row({ id: 'tx-pay', userId: PASSENGER, amount: FARE, externalId: `payme_${ORDER_ID}_1` }, 1),
      // completion rows, created AFTER the payment was initiated
      row({ id: 'tx-commission', userId: DRIVER, amount: 2500, externalId: 'commission' }, 2),
      row({ id: 'tx-tax', userId: DRIVER, amount: 250, externalId: TAX_WITHHOLDING_LEDGER_TAG }, 3),
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Transaction), useValue: { findOne, update } },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
              where.id === ORDER_ID ? { id: ORDER_ID, passengerId: PASSENGER, driverId: null } : null,
            ),
          },
        },
        { provide: getRepositoryToken(MarketOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(FoodOrder), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(WithdrawalRequest), useValue: {} },
        { provide: PaymeProvider, useValue: { verifyCallbackSignature: jest.fn().mockReturnValue(true) } },
        { provide: ClickProvider, useValue: { verifyCallbackSignature: jest.fn().mockReturnValue(true) } },
        { provide: UzcardProvider, useValue: { verifyCallback: jest.fn().mockReturnValue(true) } },
        { provide: PAYOUT_PROVIDER, useValue: { name: 'manual', send: jest.fn() } },
        { provide: DriversService, useValue: { adjustBalanceWithin: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('Payme: settles the passenger row even though commission and tax rows are newer', async () => {
    const result = await service.completeOrderPayment(ORDER_ID, { amount: FARE, externalId: 'payme_payme-9' });

    expect(result).toBe('paid');
    expect(update).toHaveBeenCalledWith(
      { id: 'tx-pay', status: TransactionStatus.PENDING },
      { status: TransactionStatus.COMPLETED, externalId: 'payme_payme-9' },
    );
  });

  it('Click: amount check compares against the fare, not the tax row', async () => {
    const result = await service.completeOrderPayment(ORDER_ID, { amount: FARE, externalId: 'click_click-1' });

    expect(result).toBe('paid');
    expect(update).toHaveBeenCalledWith(
      { id: 'tx-pay', status: TransactionStatus.PENDING },
      expect.objectContaining({ status: TransactionStatus.COMPLETED }),
    );
  });

  it('Uzcard: never picks the driver commission row', async () => {
    // Only the driver rows remain — a passenger-scoped lookup finds nothing.
    ledger = ledger.filter((r) => r.userId === DRIVER);

    const result = await service.handleUzcardCallback({
      status: 'PAID',
      order_id: ORDER_ID,
      transaction_id: 'uz-1',
      amount: 2500 * 100,
    });

    expect(result).toEqual({ success: false, message: 'ORDER_NOT_FOUND' });
    expect(update).not.toHaveBeenCalled();
  });

  it('falls back to excluding driver-side ledger tags when the order cannot be resolved', async () => {
    // e.g. a food/market order whose repository lookup is unavailable
    ledger = ledger.map((r) => ({ ...r, orderId: 'food-order-1' }));

    const result = await service.completeOrderPayment('food-order-1', { amount: FARE, externalId: 'payme_payme-10' });

    expect(result).toBe('paid');
    expect(update).toHaveBeenCalledWith(
      { id: 'tx-pay', status: TransactionStatus.PENDING },
      { status: TransactionStatus.COMPLETED, externalId: 'payme_payme-10' },
    );
  });
});
