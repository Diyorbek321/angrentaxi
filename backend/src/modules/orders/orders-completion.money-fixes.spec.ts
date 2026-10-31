import { ConflictException, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Order, OrderStatus, PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { TAX_WITHHOLDING_LEDGER_TAG } from '../tax/tax-withholding';
import { OrdersCompletionService, RIDE_PROMO_COMPENSATION_TAG } from './orders-completion.service';
import {
  FARE_BONUS_LEDGER_TAG,
  FARE_BONUS_SPEND_LEDGER_TAG,
} from '../../database/entities/transaction.entity';

/**
 * Safar yakunidagi pul xatolari (2026-10-16 audit):
 *  1. ikki marta yakunlash — sharti bilan "da'vo" (claim) qilish;
 *  2. taksi promokodini PLATFORMA to'laydi (komissiya chegirmasiz narxdan);
 *  3. rejalashtirilgan safarda kutish `scheduledAt` dan boshlanadi;
 *  4. referal — faqat yo'lovchining o'z safarlari sanaladi.
 *
 * Servis qo'lda yig'iladi: bu yerda faqat `completeTrip` ning o'z mantig'i
 * tekshiriladi, Nest konteyneri emas.
 */

const ORDER_ID = 'order-1';
const DRIVER_USER_ID = 'driver-user-1';
const PASSENGER_ID = 'passenger-1';
const REFERRER_ID = 'referrer-1';
const FARE = 20000;

interface BuildOptions {
  /** Yo'lovchining sarflanmagan bonusi (computeBonusBalance). */
  passengerBonus?: number;
  order?: Partial<Order>;
  promoDiscount?: number;
  tripStartTime?: Date | null;
  waitingTariff?: boolean;
  referredBy?: string | null;
  completedRideCount?: number;
  walletBalance?: number;
  referralSave?: (row: Partial<Transaction>) => Promise<unknown>;
}

function build(options: BuildOptions = {}) {
  // Bazadagi buyurtma holati — shartli UPDATE shu qiymatga qarab ishlaydi,
  // xuddi Postgres'dagi `WHERE status = 'in_progress'` kabi.
  let dbStatus: OrderStatus = OrderStatus.IN_PROGRESS;

  const managerUpdate = jest.fn(async (entity: unknown, criteria: unknown, _data: unknown) => {
    if (entity !== Order) return { affected: 1 };
    const expected = (criteria as { status?: OrderStatus }).status;
    if (typeof criteria === 'object' && expected !== undefined) {
      if (dbStatus !== expected) return { affected: 0 };
      dbStatus = OrderStatus.COMPLETED;
      return { affected: 1 };
    }
    // Shartsiz yozuv — eski xulq: har doim "muvaffaqiyatli".
    dbStatus = OrderStatus.COMPLETED;
    return { affected: 1 };
  });
  const managerSave = jest.fn(async (_entity: unknown, row: unknown) => row);
  const manager = {
    update: managerUpdate,
    save: managerSave,
    query: jest.fn(async (sql: string) =>
      /AS bonus/.test(sql) ? [{ bonus: String(options.passengerBonus ?? 0) }] : [],
    ),
    getRepository: jest.fn(() => ({
      createQueryBuilder: () => ({
        select: function () { return this; },
        where: function () { return this; },
        getRawOne: async () => ({ balance: String(options.walletBalance ?? 1_000_000) }),
      }),
    })),
  };
  // Haqiqiy tranzaksiya kabi: callback'dan oldin bir "tick" kutadi, shunda
  // `Promise.all` dagi ikki chaqiruv haqiqatan ham aralashib ketadi.
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => Promise<unknown>) => {
      await Promise.resolve();
      return cb(manager);
    }),
  };

  const baseOrder = {
    id: ORDER_ID,
    status: OrderStatus.IN_PROGRESS,
    driverId: DRIVER_USER_ID,
    passengerId: PASSENGER_ID,
    tariffId: 'tariff-1',
    paymentMethod: PaymentMethod.CASH,
    serviceType: ServiceType.TAXI,
    promoCodeId: options.promoDiscount ? 'promo-1' : null,
    isFixedPrice: false,
    fareBreakdown: null,
    arrivedAt: null,
    scheduledAt: null,
    details: null,
    ...options.order,
  } as unknown as Order;

  const referralSave = jest.fn(options.referralSave ?? (async (row: unknown) => row));
  const orderCount = jest.fn().mockResolvedValue(options.completedRideCount ?? 1);
  const orderRepository = {
    query: jest.fn().mockResolvedValue([{ distance_meters: '3000' }]),
    update: jest.fn(),
    count: orderCount,
  };
  const tripRepository = {
    findOne: jest.fn().mockResolvedValue(
      options.tripStartTime ? { id: 'trip-1', orderId: ORDER_ID, startTime: options.tripStartTime } : null,
    ),
    update: jest.fn().mockResolvedValue({}),
  };
  const transactionRepository = { save: referralSave };
  const tariffsService = {
    findById: jest.fn().mockResolvedValue(
      options.waitingTariff
        ? { id: 'tariff-1', freeWaitMinutes: 3, waitingPricePerMinute: 500 }
        : { id: 'tariff-1' },
    ),
    calculatePriceBreakdown: jest.fn((_t: unknown, km = 0, min = 0) => ({
      baseFare: FARE, distanceKm: km, pricePerKm: 0, distanceFare: 0,
      durationMin: min, pricePerMin: 0, timeFare: 0,
      minPriceAdjustment: 0, surgeMultiplier: 1, surgeFare: 0,
      maxPriceCap: 0, total: FARE,
    })),
  };
  const realtimeGateway = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
  const notificationsService = { notifyTripCompleted: jest.fn().mockResolvedValue(undefined) };
  const usersService = {
    findById: jest.fn().mockResolvedValue({
      id: PASSENGER_ID,
      referredByUserId: options.referredBy === undefined ? null : options.referredBy,
    }),
  };
  const adjustBalanceWithin = jest
    .fn()
    .mockResolvedValue({ driverId: 'driver-1', newBalance: 0, wentOffline: false });
  const driversService = {
    findByUserId: jest.fn().mockResolvedValue({
      id: 'driver-1', userId: DRIVER_USER_ID, commissionRate: 10, pinfl: null, tin: null, isOnline: true,
    }),
    adjustBalanceWithin,
    takeOfflineInRedis: jest.fn(),
  };
  const promoApply = jest.fn().mockResolvedValue(undefined);
  const promoCodesService = {
    findById: jest.fn().mockResolvedValue({ id: 'promo-1', code: 'PROMO5' }),
    validate: jest.fn().mockResolvedValue({ promoCodeId: 'promo-1', discountAmount: options.promoDiscount ?? 0 }),
    apply: promoApply,
  };
  const evaluateForDriver = jest.fn().mockResolvedValue(undefined);
  const settingsService = { getDefaultCommissionRate: jest.fn().mockResolvedValue(20) };
  const queryService = { findByIdOrThrow: jest.fn().mockResolvedValue(baseOrder) };
  const financePolicy = {
    get: jest.fn().mockResolvedValue({
      defaultCommissionRate: 20,
      launchPromoCommissionUntil: null,
      taxWithholding: { enabled: true, ratePercent: 1 },
    }),
  };
  const recordForRide = jest.fn().mockResolvedValue(undefined);

  const service = new OrdersCompletionService(
    orderRepository as never,
    tripRepository as never,
    transactionRepository as never,
    tariffsService as never,
    realtimeGateway as never,
    notificationsService as never,
    usersService as never,
    driversService as never,
    promoCodesService as never,
    { evaluateForDriver } as never,
    settingsService as never,
    queryService as never,
    { routeDistanceMeters: jest.fn() } as never,
    { enabled: false } as never,
    dataSource as never,
    undefined,
    undefined,
    undefined,
    financePolicy as never,
    { recordForRide } as never,
    undefined,
  );

  const ledgerRows = () =>
    managerSave.mock.calls
      .filter(([entity]) => entity === Transaction)
      .map(([, row]) => row as Partial<Transaction>);
  const orderUpdates = () =>
    managerUpdate.mock.calls
      .filter(([entity]) => entity === Order)
      .map(([, , data]) => data as Partial<Order>);
  /** Barcha yozuvlardan keyingi buyurtma qatori (birlashtirilgan). */
  const persistedOrder = (): Partial<Order> =>
    orderUpdates().reduce<Partial<Order>>((acc, data) => ({ ...acc, ...data }), {});

  return {
    service,
    managerUpdate,
    ledgerRows,
    persistedOrder,
    adjustBalanceWithin,
    evaluateForDriver,
    recordForRide,
    promoApply,
    referralSave,
    orderCount,
    tripRepository,
    notificationsService,
  };
}

describe('OrdersCompletionService — pul xatolari tuzatishlari', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('1. safarni ikki marta yakunlab bo‘lmaydi', () => {
    it('buyurtmani faqat IN_PROGRESS bo‘lsa shartli yozadi (tranzaksiyadagi birinchi yozuv)', async () => {
      const h = build();
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      const [entity, criteria, data] = h.managerUpdate.mock.calls[0];
      expect(entity).toBe(Order);
      expect(criteria).toEqual({ id: ORDER_ID, status: OrderStatus.IN_PROGRESS });
      expect(data).toEqual(expect.objectContaining({ status: OrderStatus.COMPLETED }));
    });

    it('ikki parallel completeTrip — bitta to‘plam pul yozuvi, ikkinchisi Conflict', async () => {
      const h = build({
        promoDiscount: 5000,
        referredBy: REFERRER_ID,
        tripStartTime: new Date(Date.now() - 10 * 60_000),
      });

      const results = await Promise.allSettled([
        h.service.completeTrip(DRIVER_USER_ID, ORDER_ID),
        h.service.completeTrip(DRIVER_USER_ID, ORDER_ID),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      // Bitta naqd safar: yo'lovchi DEBIT, komissiya, soliq, promokod qoplamasi.
      expect(h.ledgerRows()).toHaveLength(4);
      expect(h.adjustBalanceWithin).toHaveBeenCalledTimes(1);
      expect(h.promoApply).toHaveBeenCalledTimes(1);
      // Promokod hisoblagichi pul yozuvlari bilan BITTA tranzaksiyada: rollback
      // bo'lsa, foydalanish ham qaytadi (qayta urinish ikkinchisini yemaydi).
      const txManager = h.adjustBalanceWithin.mock.calls[0][0];
      expect(h.promoApply.mock.calls[0][3]).toBe(txManager);
      expect(h.evaluateForDriver).toHaveBeenCalledTimes(1);
      expect(h.recordForRide).toHaveBeenCalledTimes(1);
      expect(h.notificationsService.notifyTripCompleted).toHaveBeenCalledTimes(1);
      expect(h.tripRepository.update).toHaveBeenCalledTimes(1);
      // Referal: yo'lovchi + taklif qilgan — bir martadan.
      expect(h.referralSave).toHaveBeenCalledTimes(2);
    });

    it('allaqachon yakunlangan (dispetcher ulgurgan) — hech qanday pul yozuvi yo‘q', async () => {
      const h = build();
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      const rowsAfterFirst = h.ledgerRows().length;

      await expect(h.service.completeTrip(DRIVER_USER_ID, ORDER_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(h.ledgerRows()).toHaveLength(rowsAfterFirst);
      expect(h.adjustBalanceWithin).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. taksi promokodini platforma to‘laydi (20 000, promo 5 000, komissiya 10%)', () => {
    const byTag = (rows: Partial<Transaction>[], tag: string | null) =>
      rows.filter((r) => (r.externalId ?? null) === tag);

    it('NAQD: haydovchi 15 000 oladi + hamyoniga 5 000 qoplama; komissiya/soliq 20 000 dan', async () => {
      const h = build({ promoDiscount: 5000 });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      const rows = h.ledgerRows();

      const passengerDebit = rows.find((r) => r.userId === PASSENGER_ID);
      expect(passengerDebit).toEqual(
        expect.objectContaining({ amount: 15000, type: TransactionType.DEBIT, status: TransactionStatus.COMPLETED }),
      );
      expect(byTag(rows, 'commission')[0]).toEqual(expect.objectContaining({ amount: 2000 }));
      expect(byTag(rows, TAX_WITHHOLDING_LEDGER_TAG)[0]).toEqual(expect.objectContaining({ amount: 200 }));
      // Naqdda safar puli CREDIT qilinmaydi — faqat chegirma qoplamasi.
      expect(rows.filter((r) => r.userId === DRIVER_USER_ID && r.type === TransactionType.CREDIT)).toEqual([
        expect.objectContaining({
          amount: 5000,
          orderId: ORDER_ID,
          paymentMethod: PaymentMethod.WALLET,
          status: TransactionStatus.COMPLETED,
          externalId: RIDE_PROMO_COMPENSATION_TAG(ORDER_ID),
        }),
      ]);
      // drivers.balance: +5 000 qoplama − 2 000 komissiya − 200 soliq.
      expect(h.adjustBalanceWithin.mock.calls[0][2]).toBe(2800);

      expect(h.persistedOrder()).toEqual(
        expect.objectContaining({ finalPrice: 15000, discountAmount: 5000, driverEarning: 18000 }),
      );
      expect(h.persistedOrder().fareBreakdown?.total).toBe(FARE);
      // Chek — yo'lovchi to'lagan summa.
      expect(h.recordForRide).toHaveBeenCalledWith(
        expect.objectContaining({ total: 15000, commissionAmount: 2000 }),
      );
    });

    it('KARTA: yo‘lovchidan 15 000 (PENDING), haydovchiga 20 000 CREDIT (PENDING), qoplama yo‘q', async () => {
      const h = build({ promoDiscount: 5000, order: { paymentMethod: PaymentMethod.CARD } });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      const rows = h.ledgerRows();

      expect(rows.find((r) => r.userId === PASSENGER_ID)).toEqual(
        expect.objectContaining({ amount: 15000, status: TransactionStatus.PENDING }),
      );
      expect(rows.filter((r) => r.userId === DRIVER_USER_ID && r.type === TransactionType.CREDIT)).toEqual([
        expect.objectContaining({ amount: 20000, status: TransactionStatus.PENDING, externalId: null }),
      ]);
      expect(byTag(rows, 'commission')[0]).toEqual(expect.objectContaining({ amount: 2000 }));
      expect(byTag(rows, TAX_WITHHOLDING_LEDGER_TAG)[0]).toEqual(expect.objectContaining({ amount: 200 }));
      expect(byTag(rows, RIDE_PROMO_COMPENSATION_TAG(ORDER_ID))).toHaveLength(0);
      expect(h.adjustBalanceWithin.mock.calls[0][2]).toBe(0);
      expect(h.persistedOrder()).toEqual(
        expect.objectContaining({ finalPrice: 15000, discountAmount: 5000, driverEarning: 18000 }),
      );
    });

    it('HAMYON: yo‘lovchidan 15 000, haydovchiga 20 000 CREDIT, balansga 20 000 − 2 000 − 200', async () => {
      const h = build({ promoDiscount: 5000, order: { paymentMethod: PaymentMethod.WALLET } });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      const rows = h.ledgerRows();

      expect(rows.find((r) => r.userId === PASSENGER_ID)).toEqual(
        expect.objectContaining({ amount: 15000, status: TransactionStatus.COMPLETED }),
      );
      expect(rows.filter((r) => r.userId === DRIVER_USER_ID && r.type === TransactionType.CREDIT)).toEqual([
        expect.objectContaining({ amount: 20000, status: TransactionStatus.COMPLETED }),
      ]);
      expect(byTag(rows, RIDE_PROMO_COMPENSATION_TAG(ORDER_ID))).toHaveLength(0);
      expect(h.adjustBalanceWithin.mock.calls[0][2]).toBe(17800);
      expect(h.persistedOrder()).toEqual(
        expect.objectContaining({ finalPrice: 15000, discountAmount: 5000, driverEarning: 18000 }),
      );
    });

    it('HAMYON: bonus bilan to\u2018langan qism haydovchiga yechib bo\u2018lmaydigan fare_bonus bo\u2018lib tushadi', async () => {
      // Yo'lovchi hamyonida 30 000: 15 000 haqiqiy pul + 15 000 bonus. Avval
      // haqiqiy pul ketadi → 20 000 lik safarning 5 000 i bonusdan.
      const h = build({
        walletBalance: 30000,
        passengerBonus: 15000,
        order: { paymentMethod: PaymentMethod.WALLET },
      });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      const credits = h.ledgerRows().filter((r) => r.userId === DRIVER_USER_ID && r.type === TransactionType.CREDIT);

      expect(credits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amount: 15000, externalId: null }),
          expect.objectContaining({ amount: 5000, externalId: FARE_BONUS_LEDGER_TAG }),
        ]),
      );
      expect(credits).toHaveLength(2);
      // Hamyon harakati o'zgarmaydi — faqat yechib olish huquqi.
      expect(h.adjustBalanceWithin.mock.calls[0][2]).toBe(17800);
    });

    it('HAMYON: yo\u2018lovchi DEBIT\u2018i bo\u2018linadi — bonus qismi bonus hisobidan ayiriladi (fare_bonus_spend)', async () => {
      // Aks holda sarflangan bonus hisobda qolib, keyingi haqiqiy pulli
      // safarda haydovchining naqd daromadi fare_bonus bo'lib qulflanardi.
      const h = build({
        walletBalance: 30000,
        passengerBonus: 15000,
        order: { paymentMethod: PaymentMethod.WALLET },
      });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      const debits = h.ledgerRows().filter((r) => r.userId === PASSENGER_ID && r.type === TransactionType.DEBIT);

      expect(debits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amount: 15000, externalId: null, status: TransactionStatus.COMPLETED }),
          expect.objectContaining({ amount: 5000, externalId: FARE_BONUS_SPEND_LEDGER_TAG, status: TransactionStatus.COMPLETED }),
        ]),
      );
      expect(debits).toHaveLength(2);
    });

    it('HAMYON bonussiz — yo\u2018lovchidan avvalgidek BITTA DEBIT', async () => {
      const h = build({ walletBalance: 30000, order: { paymentMethod: PaymentMethod.WALLET } });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      const debits = h.ledgerRows().filter((r) => r.userId === PASSENGER_ID && r.type === TransactionType.DEBIT);
      expect(debits).toEqual([expect.objectContaining({ amount: 20000, externalId: null })]);
    });

    it('HAMYON + promo: platforma qoplagan chegirma bonus emas', async () => {
      // Yo'lovchi 15 000 to'laydi (hammasi bonus), 5 000 ni platforma qoplaydi.
      const h = build({
        promoDiscount: 5000,
        walletBalance: 15000,
        passengerBonus: 15000,
        order: { paymentMethod: PaymentMethod.WALLET },
      });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      const credits = h.ledgerRows().filter((r) => r.userId === DRIVER_USER_ID && r.type === TransactionType.CREDIT);

      expect(credits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amount: 5000, externalId: null }),
          expect.objectContaining({ amount: 15000, externalId: FARE_BONUS_LEDGER_TAG }),
        ]),
      );
    });

    it('promokod band qilinmasa — to‘liq narx, qoplama yo‘q', async () => {
      const h = build({ promoDiscount: 5000 });
      h.promoApply.mockRejectedValueOnce(new Error('limit reached'));
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(h.persistedOrder()).toEqual(
        expect.objectContaining({ finalPrice: 20000, discountAmount: null, driverEarning: 18000 }),
      );
      expect(h.ledgerRows().filter((r) => r.type === TransactionType.CREDIT)).toHaveLength(0);
      expect(h.adjustBalanceWithin.mock.calls[0][2]).toBe(-2200);
    });
  });

  describe('3. rejalashtirilgan safarda kutish scheduledAt dan boshlanadi', () => {
    const SCHEDULED_AT = new Date('2026-10-16T09:00:00Z');
    const min = (m: number) => new Date(SCHEDULED_AT.getTime() + m * 60_000);

    it('haydovchi 6 daqiqa erta keldi, yo‘lovchi aynan vaqtida chiqdi — kutish 0', async () => {
      const h = build({
        waitingTariff: true,
        tripStartTime: SCHEDULED_AT,
        order: { scheduledAt: SCHEDULED_AT, arrivedAt: min(-6) },
      });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(h.persistedOrder().fareBreakdown?.waitingMinutes ?? 0).toBe(0);
      expect(h.persistedOrder().fareBreakdown?.waitingFare ?? 0).toBe(0);
    });

    it('erta kelgan, yo‘lovchi 5 daqiqa kechikdi — faqat scheduledAt dan keyingi vaqt sanaladi', async () => {
      const h = build({
        waitingTariff: true,
        tripStartTime: min(5),
        order: { scheduledAt: SCHEDULED_AT, arrivedAt: min(-6) },
      });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      // 5 daqiqa − 3 bepul = 2 daqiqa × 500.
      expect(h.persistedOrder().fareBreakdown?.waitingMinutes).toBe(2);
      expect(h.persistedOrder().fareBreakdown?.waitingFare).toBe(1000);
    });

    it('scheduledAt dan keyin kelgan — kutish odatdagidek arrivedAt dan', async () => {
      const h = build({
        waitingTariff: true,
        tripStartTime: min(12),
        order: { scheduledAt: SCHEDULED_AT, arrivedAt: min(2) },
      });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(h.persistedOrder().fareBreakdown?.waitingMinutes).toBe(7);
    });
  });

  describe('4. referal — faqat yo‘lovchining o‘z safarlari', () => {
    it('sanashda ovqat/market kuryer safarlari hisobga olinmaydi', async () => {
      const h = build({ referredBy: REFERRER_ID });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      const where = (h.orderCount.mock.calls[0][0] as { where: Record<string, unknown> }).where;
      expect(where.passengerId).toBe(PASSENGER_ID);
      expect(where.status).toBe(OrderStatus.COMPLETED);
      const serviceTypes = (where.serviceType as { value: ServiceType[] }).value;
      expect([...serviceTypes].sort()).toEqual(
        // Shaharlararo band — yo'lovchining o'z safari (2026-10-17 qarori).
        [ServiceType.CARGO, ServiceType.INTERCITY, ServiceType.PARCEL, ServiceType.TAXI].sort(),
      );
      expect(h.referralSave).toHaveBeenCalledTimes(2);
    });

    it('kuryer safarining o‘zi (ovqat yetkazish) referal bermaydi', async () => {
      const h = build({
        referredBy: REFERRER_ID,
        order: { serviceType: ServiceType.FOOD, details: { foodOrderId: 'food-1' } },
      });
      await h.service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(h.referralSave).not.toHaveBeenCalled();
    });

    it('unique index to‘qnashuvi (23505) yiqitmaydi va qolgan yozuvni davom ettiradi', async () => {
      const uniqueViolation = new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' }));
      const h = build({
        referredBy: REFERRER_ID,
        referralSave: async (row) => {
          if (row.userId === PASSENGER_ID) throw uniqueViolation;
          return row;
        },
      });

      await expect(h.service.completeTrip(DRIVER_USER_ID, ORDER_ID)).resolves.toBeDefined();
      expect(h.referralSave).toHaveBeenCalledTimes(2);
    });
  });
});
