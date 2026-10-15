import { FindOperator } from 'typeorm';
import { Order, PaymentMethod } from '../../database/entities/order.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { OrderRefundClawbackService, REFUND_CLAWBACK_TAG } from './order-refund-clawback.service';

/**
 * Biznes qarori (2026-10-15): karta to'lovi Payme/Click orqali QAYTARILSA va
 * haydovchi/sotuvchi ulushi allaqachon hamyonga tushgan bo'lsa — o'sha ulush
 * hamyondan qaytarib olinadi (bir martalik), manfiyga tushsa oflayn, push,
 * amallar jurnali va fiskal qaytarish cheki.
 */
type Row = Partial<Transaction> & { id: string };

function harness(entities: {
  orders?: Array<Partial<Order>>;
  food?: Array<Partial<FoodOrder>>;
  market?: Array<Partial<MarketOrder>>;
  restaurants?: Array<Partial<Restaurant>>;
  stores?: Array<Partial<Store>>;
  ledger?: Array<Partial<Transaction>>;
  driverOnline?: boolean;
}) {
  let seq = 0;
  const ledger: Row[] = (entities.ledger ?? []).map((row) => ({ id: `t${++seq}`, ...row }));
  const tables = new Map<unknown, Array<Record<string, unknown>>>([
    [Order, (entities.orders ?? []) as Array<Record<string, unknown>>],
    [FoodOrder, (entities.food ?? []) as Array<Record<string, unknown>>],
    [MarketOrder, (entities.market ?? []) as Array<Record<string, unknown>>],
    [Restaurant, (entities.restaurants ?? []) as Array<Record<string, unknown>>],
    [Store, (entities.stores ?? []) as Array<Record<string, unknown>>],
  ]);
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, expected]) =>
      expected instanceof FindOperator
        ? (expected.value as unknown[]).includes(row[key])
        : row[key] === expected,
    );
  const balanceOf = (userId: string) =>
    ledger
      .filter((r) => r.userId === userId && r.status === TransactionStatus.COMPLETED)
      .reduce((sum, r) => sum + (r.type === TransactionType.CREDIT ? 1 : -1) * Number(r.amount), 0);

  const ledgerRepo = {
    find: jest.fn(async ({ where }: { where: Record<string, unknown> }) => ledger.filter((r) => matches(r, where))),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => ledger.find((r) => matches(r, where)) ?? null),
    save: jest.fn(async (row: Partial<Transaction>) => {
      if (ledger.some((r) => r.externalId && r.externalId === row.externalId)) {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      }
      const saved = { id: `t${++seq}`, ...row } as Row;
      ledger.push(saved);
      return saved;
    }),
    update: jest.fn(async (where: Record<string, unknown>, changes: Partial<Transaction>) => {
      let affected = 0;
      ledger.forEach((r, i) => {
        if (matches(r, where)) {
          ledger[i] = { ...r, ...changes } as Row;
          affected += 1;
        }
      });
      return { affected };
    }),
  };
  let online = entities.driverOnline ?? true;
  const manager = {
    findOne: jest.fn(async (entity: unknown, { where }: { where: Record<string, unknown> }) =>
      (tables.get(entity) ?? []).find((row) => matches(row, where)) ?? null,
    ),
    getRepository: jest.fn(() => ledgerRepo),
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('UPDATE drivers')) {
        const userId = params[0] as string;
        if (!userId.startsWith('driver')) return [[], 0];
        const balance = balanceOf(userId);
        const was = online;
        if (balance < 0) online = false;
        return [[{ driver_id: `d-${userId}`, balance: String(balance), is_online: online, was_online: was }], 1];
      }
      return [];
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (fn: (m: typeof manager) => unknown) => fn(manager)),
    manager,
  };
  const auditLog = { record: jest.fn(async () => ({ id: 'audit-1' })) };
  const driversService = { takeOfflineInRedis: jest.fn(async () => undefined) };
  const notifier = { balanceChanged: jest.fn(async () => undefined) };
  const fiscal = { recordOrderRefund: jest.fn(async () => null) };
  const service = new OrderRefundClawbackService(
    dataSource as never,
    auditLog as never,
    driversService as never,
    notifier as never,
    fiscal as never,
  );
  return { service, ledger, auditLog, driversService, notifier, fiscal, balanceOf };
}

const card = { paymentMethod: PaymentMethod.CARD, status: TransactionStatus.COMPLETED };

describe('OrderRefundClawbackService', () => {
  describe('taksi safari (karta)', () => {
    const taxiLedger = [
      { userId: 'passenger-1', orderId: 'order-1', amount: 20000, type: TransactionType.DEBIT, externalId: 'payme_tx1', ...card },
      { userId: 'driver-1', orderId: 'order-1', amount: 20000, type: TransactionType.CREDIT, externalId: null, ...card },
      { userId: 'driver-1', orderId: 'order-1', amount: 2000, type: TransactionType.DEBIT, externalId: 'commission', ...card },
      { userId: 'driver-1', orderId: 'order-1', amount: 200, type: TransactionType.DEBIT, externalId: 'tax_withholding', ...card },
    ];

    it("haydovchiga tushgan sof ulush (yo'l haqi − komissiya − soliq) bir marta DEBIT qilinadi", async () => {
      const h = harness({ orders: [{ id: 'order-1', driverId: 'driver-1' }], ledger: taxiLedger });

      const result = await h.service.clawbackForRefundedPayment('order-1', 'payme_tx1');

      expect(result).toEqual([
        expect.objectContaining({ userId: 'driver-1', role: 'driver', amount: 17800, tag: REFUND_CLAWBACK_TAG.driver('order-1') }),
      ]);
      expect(h.ledger.at(-1)).toEqual(
        expect.objectContaining({
          userId: 'driver-1',
          orderId: 'order-1',
          amount: 17800,
          type: TransactionType.DEBIT,
          status: TransactionStatus.COMPLETED,
          externalId: 'refund_clawback_driver_order-1',
        }),
      );
      expect(h.balanceOf('driver-1')).toBe(0);

      // Takror (provayder callback'i qayta keldi) — hech narsa yozilmaydi.
      await expect(h.service.clawbackForRefundedPayment('order-1', 'payme_tx1')).resolves.toEqual([]);
      expect(h.ledger.filter((r) => r.externalId?.startsWith('refund_clawback'))).toHaveLength(1);
    });

    it('jurnal, push, fiskal qaytarish cheki', async () => {
      const h = harness({ orders: [{ id: 'order-1', driverId: 'driver-1' }], ledger: taxiLedger });
      await h.service.clawbackForRefundedPayment('order-1', 'payme_tx1');

      expect(h.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: null,
          action: 'payment.refund_clawback',
          targetType: 'order',
          targetId: 'order-1',
          amount: 17800,
          metadata: expect.objectContaining({ userId: 'driver-1', role: 'driver', providerExternalId: 'payme_tx1' }),
        }),
        expect.anything(),
      );
      expect(h.notifier.balanceChanged).toHaveBeenCalledWith(
        'driver-1',
        expect.objectContaining({
          delta: -17800,
          reason: 'refund_clawback',
          push: expect.objectContaining({ event: 'payment_refund_clawback' }),
          extra: { orderId: 'order-1' },
        }),
      );
      expect(h.fiscal.recordOrderRefund).toHaveBeenCalledWith('order-1');
    });

    it("hamyon manfiyga tushsa — oflayn (Redis ham)", async () => {
      const h = harness({
        orders: [{ id: 'order-1', driverId: 'driver-1' }],
        ledger: [
          ...taxiLedger,
          { userId: 'driver-1', orderId: null, amount: 15000, type: TransactionType.DEBIT, externalId: 'withdrawal_x', ...card },
        ],
      });
      await h.service.clawbackForRefundedPayment('order-1', 'payme_tx1');
      expect(h.balanceOf('driver-1')).toBe(-15000);
      expect(h.driversService.takeOfflineInRedis).toHaveBeenCalledWith('d-driver-1', expect.any(String));
    });

    it("ulush hali ochilmagan (PENDING) — DEBIT yo'q, oyoqlar REFUNDED (hech qachon ochilmaydi)", async () => {
      const pending = taxiLedger.map((row) => ({ ...row, status: TransactionStatus.PENDING }));
      const h = harness({ orders: [{ id: 'order-1', driverId: 'driver-1' }], ledger: pending });

      await expect(h.service.clawbackForRefundedPayment('order-1', 'payme_tx1')).resolves.toEqual([]);
      expect(h.ledger.filter((r) => r.userId === 'driver-1').map((r) => r.status)).toEqual([
        TransactionStatus.REFUNDED,
        TransactionStatus.REFUNDED,
        TransactionStatus.REFUNDED,
      ]);
      expect(h.notifier.balanceChanged).not.toHaveBeenCalled();
      expect(h.fiscal.recordOrderRefund).toHaveBeenCalledWith('order-1');
    });
  });

  describe('ovqat buyurtmasi (karta): sotuvchi + kuryer', () => {
    it("sotuvchidan tovar − komissiya, kuryerdan yetkazish ulushi qaytarib olinadi", async () => {
      const h = harness({
        food: [{ id: 'fo-1', restaurantId: 'rest-1', deliveryOrderId: 'ride-1' }],
        restaurants: [{ id: 'rest-1', ownerUserId: 'owner-1' }],
        orders: [{ id: 'ride-1', driverId: 'driver-2' }],
        ledger: [
          { userId: 'owner-1', orderId: null, amount: 100000, type: TransactionType.CREDIT, externalId: 'food_order_fo-1', ...card },
          { userId: 'owner-1', orderId: null, amount: 10000, type: TransactionType.DEBIT, externalId: 'food_order_commission_fo-1', ...card },
          { userId: 'driver-2', orderId: 'ride-1', amount: 8000, type: TransactionType.CREDIT, externalId: null, ...card },
          { userId: 'driver-2', orderId: 'ride-1', amount: 800, type: TransactionType.DEBIT, externalId: 'commission', ...card },
        ],
      });

      const result = await h.service.clawbackForRefundedPayment('fo-1', 'click_99');

      expect(result).toEqual([
        expect.objectContaining({ userId: 'owner-1', role: 'vendor', amount: 90000, tag: 'refund_clawback_vendor_fo-1' }),
        expect.objectContaining({ userId: 'driver-2', role: 'driver', amount: 7200, tag: 'refund_clawback_driver_ride-1' }),
      ]);
      expect(h.ledger.find((r) => r.externalId === 'refund_clawback_vendor_fo-1')).toEqual(
        expect.objectContaining({ orderId: null, amount: 90000, type: TransactionType.DEBIT }),
      );
      expect(h.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: 'food_order', targetId: 'fo-1', amount: 90000 }),
        expect.anything(),
      );
      expect(h.fiscal.recordOrderRefund).toHaveBeenCalledWith('fo-1');
      expect(h.fiscal.recordOrderRefund).toHaveBeenCalledWith('ride-1');
    });
  });

  describe('market buyurtmasi (karta)', () => {
    it('do‘kon egasidan sof ulush', async () => {
      const h = harness({
        market: [{ id: 'mo-1', storeId: 'store-1', deliveryOrderId: null }],
        stores: [{ id: 'store-1', ownerUserId: 'owner-2' }],
        ledger: [
          { userId: 'owner-2', orderId: null, amount: 50000, type: TransactionType.CREDIT, externalId: 'market_order_mo-1', ...card },
          { userId: 'owner-2', orderId: null, amount: 5000, type: TransactionType.DEBIT, externalId: 'market_order_commission_mo-1', ...card },
        ],
      });
      const result = await h.service.clawbackForRefundedPayment('mo-1', 'payme_t');
      expect(result).toEqual([expect.objectContaining({ userId: 'owner-2', role: 'vendor', amount: 45000 })]);
    });
  });

  it("noma'lum buyurtma — hech narsa", async () => {
    const h = harness({});
    await expect(h.service.clawbackForRefundedPayment('nope', 'x')).resolves.toEqual([]);
    expect(h.fiscal.recordOrderRefund).not.toHaveBeenCalled();
  });
});
