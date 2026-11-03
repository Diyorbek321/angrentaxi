import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Order, OrderStatus, PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { DEFAULT_DELIVERY_INCIDENT_SETTINGS } from '../settings/delivery-incident-settings';
import { OrdersCompletionService } from './orders-completion.service';

/**
 * Yetkazish hodisalari (docs/INCIDENT-POLICY.md §2) — yakunlash:
 * topshirish kodi, manzilda kutish, qaytarilgan yetkazish hisob-kitobi.
 */
const ORDER_ID = 'ride-1';
const DRIVER = 'courier-1';
const CUSTOMER = 'customer-1';
const FEE = 7000;
const T0 = new Date('2026-11-03T10:00:00Z');
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

function build(order: Partial<Order> = {}, pinRow: { pin: string | null; attempts?: number } = { pin: '0427' }) {
  let attempts = pinRow.attempts ?? 0;
  const managerUpdate = jest.fn(async (entity: unknown, criteria: Record<string, unknown>) => {
    if (entity !== Order) return { affected: 1 };
    const failed = criteria.deliveryFailedAt as FindOperator<unknown> | undefined;
    const isFailedInDb = baseOrder.deliveryFailedAt != null;
    if (failed && (failed.type === 'isNull') === isFailedInDb) return { affected: 0 };
    return { affected: 1 };
  });
  const managerSave = jest.fn(async (_e: unknown, row: unknown) => row);
  const manager = {
    update: managerUpdate,
    save: managerSave,
    query: jest.fn(async () => []),
    getRepository: jest.fn(() => ({})),
  };
  const baseOrder = {
    id: ORDER_ID,
    status: OrderStatus.IN_PROGRESS,
    driverId: DRIVER,
    passengerId: CUSTOMER,
    tariffId: 't1',
    paymentMethod: PaymentMethod.CASH,
    serviceType: ServiceType.FOOD,
    promoCodeId: null,
    isFixedPrice: true,
    fareBreakdown: {
      baseFare: FEE, distanceKm: 3, pricePerKm: 0, distanceFare: 0, durationMin: 8, pricePerMin: 0,
      timeFare: 0, minPriceAdjustment: 0, surgeMultiplier: 1, surgeFare: 0, maxPriceCap: 0,
      waitingMinutes: 0, waitingFare: 0, roundingAdjustment: 0, total: FEE,
    },
    arrivedAt: null,
    scheduledAt: null,
    dropoffArrivedAt: null,
    deliveryFailedAt: null,
    details: { foodOrderId: 'food-1' },
    ...order,
  } as unknown as Order;

  const orderRepository = {
    query: jest.fn(async (sql: string) => {
      if (/has_pin/.test(sql)) return [{ has_pin: pinRow.pin != null }];
      if (/WITH spent/.test(sql)) {
        if (attempts >= 5) return [];
        attempts += 1;
        return [{ delivery_pin: pinRow.pin, delivery_pin_attempts: attempts }];
      }
      return [{ distance_meters: '3000' }];
    }),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
  const publish = jest.fn().mockResolvedValue(undefined);
  const notifyTripCompleted = jest.fn().mockResolvedValue(undefined);
  const service = new OrdersCompletionService(
    orderRepository as never,
    { findOne: jest.fn().mockResolvedValue({ id: 'trip', startTime: T0 }), update: jest.fn() } as never,
    { save: jest.fn() } as never,
    {
      findById: jest.fn().mockResolvedValue({ id: 't1', freeWaitMinutes: 3, waitingPricePerMinute: 500 }),
      calculatePriceBreakdown: jest.fn(),
    } as never,
    { emitToUser: jest.fn(), emitToManagers: jest.fn() } as never,
    { notifyTripCompleted } as never,
    { findById: jest.fn().mockResolvedValue({ id: CUSTOMER, referredByUserId: null }) } as never,
    {
      findByUserId: jest.fn().mockResolvedValue({ id: 'd1', userId: DRIVER, commissionRate: 10, isOnline: true }),
      adjustBalanceWithin: jest.fn().mockResolvedValue({ driverId: 'd1', wentOffline: false }),
      takeOfflineInRedis: jest.fn(),
    } as never,
    { findById: jest.fn(), validate: jest.fn(), apply: jest.fn() } as never,
    { evaluateForDriver: jest.fn().mockResolvedValue(undefined) } as never,
    {
      getDefaultCommissionRate: jest.fn().mockResolvedValue(10),
      getDeliveryIncidentSettings: jest.fn().mockResolvedValue(DEFAULT_DELIVERY_INCIDENT_SETTINGS),
    } as never,
    { findByIdOrThrow: jest.fn().mockResolvedValue(baseOrder) } as never,
    { routeDistanceMeters: jest.fn() } as never,
    { enabled: false } as never,
    { transaction: jest.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)) } as never,
    { publish } as never,
  );
  const ledger = () =>
    managerSave.mock.calls.filter(([e]) => e === Transaction).map(([, r]) => r as Partial<Transaction>);
  const claim = () => managerUpdate.mock.calls.find(([e]) => e === Order) as unknown as [unknown, unknown, Partial<Order>];
  return { service, ledger, claim, publish, notifyTripCompleted, adjust: undefined };
}

describe('OrdersCompletionService — yetkazish hodisalari', () => {
  describe('topshirish kodi', () => {
    it('ovqat — kodsiz topshirib bo\'lmaydi', async () => {
      const { service } = build();
      await expect(service.completeTrip(DRIVER, ORDER_ID)).rejects.toThrow(/mijozdan ilovadagi 4 xonali kod/);
    });

    it("noto'g'ri kod — rad, to'g'risi — topshiriladi", async () => {
      const { service } = build();
      await expect(service.completeTrip(DRIVER, ORDER_ID, '1111')).rejects.toThrow(BadRequestException);
      await expect(service.completeTrip(DRIVER, ORDER_ID, '0427')).resolves.toBeDefined();
    });

    it('5 urinishdan keyin — dispetcherga', async () => {
      const { service } = build({}, { pin: '0427', attempts: 5 });
      await expect(service.completeTrip(DRIVER, ORDER_ID, '0427')).rejects.toThrow(ForbiddenException);
    });

    it("049 dan oldingi kodsiz safar — kodsiz topshiriladi", async () => {
      const { service } = build({}, { pin: null });
      await expect(service.completeTrip(DRIVER, ORDER_ID)).resolves.toBeDefined();
    });

    it('dispetcher kodsiz yakunlaydi', async () => {
      const { service } = build();
      await expect(service.completeByDispatcher(ORDER_ID)).resolves.toBeDefined();
    });
  });

  describe('manzilda kutish', () => {
    it('naqd ovqat: bepul 5 daqiqadan oshgani tarif narxida qo\'shiladi', async () => {
      const { service, claim } = build({ dropoffArrivedAt: minutesAgo(8.5) });
      await service.completeTrip(DRIVER, ORDER_ID, '0427');
      const data = claim()[2];
      expect(data.fareBreakdown?.waitingMinutes).toBe(4); // ceil(8.5) − 5
      expect(data.finalPrice).toBe(FEE + 4 * 500);
    });

    it('kartali ovqat topshirilganda kutish undirilmaydi', async () => {
      const { service, claim } = build({ dropoffArrivedAt: minutesAgo(8), paymentMethod: PaymentMethod.CARD });
      await service.completeTrip(DRIVER, ORDER_ID, '0427');
      expect(claim()[2].finalPrice).toBe(FEE);
    });
  });

  describe('qaytarilmoqda', () => {
    const failed = { dropoffArrivedAt: minutesAgo(20), deliveryFailedAt: minutesAgo(12) };

    it('kuryer ham, dispetcher ham "topshirildi" deb yopa olmaydi', async () => {
      const { service } = build(failed);
      await expect(service.completeTrip(DRIVER, ORDER_ID, '0427')).rejects.toThrow(/qaytarilmoqda/);
      await expect(service.completeByDispatcher(ORDER_ID)).rejects.toThrow(/qaytarilmoqda/);
    });

    it('belgilanmagan safarda qaytarish tasdig\'i rad', async () => {
      const { service } = build();
      await expect(service.completeTrip(DRIVER, ORDER_ID, undefined, { returned: true })).rejects.toThrow(
        /belgilanmagan/,
      );
    });

    it("naqd ovqat qaytdi: mijoz qarzi = yetkazish + kutish + qaytarish, kuryerga platforma to'laydi", async () => {
      const { service, ledger, claim, publish, notifyTripCompleted } = build(failed);
      await service.completeTrip(DRIVER, ORDER_ID, undefined, { returned: true });

      const data = claim()[2];
      // kutish: ceil(20−12=8)−5 = 3 daq × 500 = 1500; qaytarish 50% × 7000 = 3500
      expect(data.fareBreakdown?.waitingMinutes).toBe(3);
      expect(data.fareBreakdown?.returnFare).toBe(3500);
      expect(data.finalPrice).toBe(FEE + 1500 + 3500);
      expect(data.deliveryOutcome).toBe('returned');

      const rows = ledger();
      const debt = rows.find((r) => r.userId === CUSTOMER && r.type === TransactionType.DEBIT);
      expect(debt).toMatchObject({
        amount: 12000,
        paymentMethod: PaymentMethod.WALLET,
        status: TransactionStatus.PENDING,
        orderId: ORDER_ID,
      });
      const credit = rows.find((r) => r.userId === DRIVER && r.type === TransactionType.CREDIT);
      expect(credit).toMatchObject({ amount: 12000, status: TransactionStatus.COMPLETED });
      const commission = rows.find((r) => r.userId === DRIVER && r.externalId === 'commission');
      expect(commission).toMatchObject({ amount: 1200, status: TransactionStatus.COMPLETED });

      expect(publish).toHaveBeenCalledWith(expect.anything(), 'returned', { customerOwes: 12000 });
      expect(notifyTripCompleted).not.toHaveBeenCalled();
    });

    it('kartali ovqat qaytdi: summa to\'langan puldan — darhol COMPLETED', async () => {
      const { service, ledger } = build({ ...failed, paymentMethod: PaymentMethod.CARD });
      await service.completeTrip(DRIVER, ORDER_ID, undefined, { returned: true });
      const debit = ledger().find((r) => r.userId === CUSTOMER);
      expect(debit).toMatchObject({ paymentMethod: PaymentMethod.CARD, status: TransactionStatus.COMPLETED });
    });

    it("posilka qaytdi: oddiy safardek (naqdni kuryer yuboruvchidan oladi) + qaytarish haqi", async () => {
      const { service, ledger, claim } = build({
        ...failed,
        serviceType: ServiceType.PARCEL,
        details: { recipientPhone: '+998901112233' },
      });
      await service.completeTrip(DRIVER, ORDER_ID, undefined, { returned: true });
      expect(claim()[2].fareBreakdown?.returnFare).toBe(3500);
      // Naqd: yo'lovchi DEBIT COMPLETED (naqd), kuryerga faqat komissiya DEBIT.
      const rows = ledger();
      expect(rows.find((r) => r.userId === CUSTOMER)).toMatchObject({
        paymentMethod: PaymentMethod.CASH,
        status: TransactionStatus.COMPLETED,
      });
      expect(rows.some((r) => r.userId === DRIVER && r.type === TransactionType.CREDIT)).toBe(false);
    });
  });
});
