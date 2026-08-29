// KUTISH HAQI — HAQIQIY OQIM ustidan testlar.
//
// ⚠️ NEGA BU FAYL KERAK: `waiting-charge.spec.ts` qoidaning O'ZINI (sof
// funksiyalarni) tekshiradi, `orders.service.fixed-price.spec.ts` esa
// `orders-completion.service.ts` dagi ketma-ketlikni SPEC ICHIDA QAYTA
// YOZADI (`settle` yordamchisi). Ikkalasi ham "qoida to'g'ri" deb aytadi,
// lekin ikkalasi ham "servis o'sha qoidani CHAQIRADI" deb ayta olmaydi:
// kimdir `withWaitingFare` chaqiruvini `completeTrip` dan olib tashlasa,
// o'sha ikki fayl ham yashil qolardi va kutish haqi jimgina yo'qolardi.
//
// Shuning uchun bu yerda HAQIQIY `completeTrip` ishga tushiriladi va
// bazaga YOZILGAN qiymatlar tekshiriladi, hamda haqiqiy `driverArrived`
// yuborgan socket paketi o'qiladi.
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  Order,
  OrderStatus,
  PaymentMethod,
} from '../../database/entities/order.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { FareBreakdown } from '../tariffs/fare-breakdown';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { DriverBonusesService } from '../driver-bonuses/driver-bonuses.service';
import { SettingsService } from '../settings/settings.service';
import { SurgeService } from '../surge/surge.service';
import { OsrmService } from '../routing/osrm.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import { OrdersService } from './orders.service';
import { OrdersQueryService } from './orders-query.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { fakeTransactionRepository, fakeCitiesServiceProvider } from './orders.testing';

const DRIVER_USER_ID = 'driver-user-1';
const ORDER_ID = 'order-1';

const ARRIVED_AT = new Date('2026-08-29T10:00:00.000Z');
const min = (m: number, ms = 0) => new Date(ARRIVED_AT.getTime() + m * 60_000 + ms);

/** Tarif — kutish maydonlari MIGRATSIYADAN keyingi holatda. */
const tariffWithWaiting = (): Tariff =>
  ({
    id: 'tariff-1',
    name: 'Komfort',
    basePrice: 10000,
    pricePerKm: 2000,
    pricePerMin: 500,
    minPrice: 12000,
    maxPrice: null,
    surgeMultiplier: 1.0,
    freeWaitMinutes: 3,
    waitingPricePerMinute: 500,
    isActive: true,
  }) as Tariff;

/**
 * MIGRATSIYADAN OLDINGI tarif: kutish ustunlari umuman yo'q.
 *
 * Bu shunchaki chekka holat emas — testlarda va eski kodda tarif obyektlari
 * qisqartirilgan literal sifatida yuriydi, va `undefined` narxga
 * ko'paytirilsa `NaN` chiqadi. `NaN` esa `decimal` ustunga yozilib, safarni
 * umuman hisoblab bo'lmaydigan holga keltirardi.
 */
const legacyTariff = (): Tariff =>
  ({
    id: 'tariff-1',
    name: 'Eski tarif',
    basePrice: 10000,
    pricePerKm: 2000,
    pricePerMin: 500,
    minPrice: 12000,
    maxPrice: null,
    surgeMultiplier: 1.0,
    isActive: true,
  }) as Tariff;

/** Buyurtma yaratilganda muzlatilgan quote (qat'iy narx uchun). */
const quote = (): FareBreakdown => ({
  baseFare: 10000,
  distanceKm: 8,
  pricePerKm: 2000,
  distanceFare: 16000,
  durationMin: 20,
  pricePerMin: 500,
  timeFare: 10000,
  minPriceAdjustment: 0,
  surgeMultiplier: 1.2,
  surgeFare: 7200,
  maxPriceCap: 0,
  waitingMinutes: 0,
  waitingFare: 0,
  total: 43200,
});

type PersistedUpdate = {
  finalPrice: number;
  fareBreakdown: FareBreakdown;
};

/** Kengaytirilgan invariant — kutish qatori bilan birga yetti qator. */
const sumOfLines = (b: FareBreakdown) =>
  b.baseFare +
  b.distanceFare +
  b.timeFare +
  b.minPriceAdjustment +
  b.surgeFare +
  b.maxPriceCap +
  b.waitingFare;

describe('completeTrip — kutish haqi HAQIQIY oqimda', () => {
  let service: OrdersService;
  let managerUpdate: jest.Mock;

  /**
   * @param order          `completeTrip` ko'radigan buyurtma (arrivedAt shu yerda).
   * @param tariff         yakuniy hisobda ishlatiladigan tarif.
   * @param tripStartTime  safar boshlangan lahza — kutish oynasining oxiri.
   */
  async function build(
    order: Partial<Order>,
    tariff: Tariff,
    tripStartTime: Date | null,
  ): Promise<void> {
    managerUpdate = jest.fn().mockResolvedValue({ affected: 1 });

    const txManager = {
      update: managerUpdate,
      save: jest.fn().mockImplementation((_e: unknown, v: unknown) => Promise.resolve(v)),
    } as unknown as EntityManager;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...ORDERS_PROVIDERS,
        fakeCitiesServiceProvider(),
        { provide: OsrmService, useValue: { routeDistanceMeters: jest.fn() } },
        { provide: RoutedDistancePricing, useValue: { enabled: false } },
        {
          provide: SurgeService,
          useValue: {
            snapshotFor: jest.fn().mockResolvedValue({
              multiplier: 1.0,
              demand: 0,
              supply: 0,
              zone: 'test-zone',
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest
              .fn()
              .mockImplementation((cb: (m: EntityManager) => Promise<unknown>) => cb(txManager)),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            // 5 km — hisoblagich rejimidagi haqiqiy masofa.
            query: jest.fn().mockResolvedValue([{ distance_meters: '5000' }]),
            update: jest.fn().mockResolvedValue({}),
            count: jest.fn().mockResolvedValue(5),
          },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest
              .fn()
              .mockResolvedValue(
                tripStartTime === null ? null : { id: 'trip-1', startTime: tripStartTime },
              ),
            update: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: fakeTransactionRepository(0, { save: jest.fn() }),
        },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        // ⚠️ HAQIQIY `TariffsService`: narx tarkibi mock qilinsa, kutish
        // qatorining haqiqiy tarkibga qanday qo'shilishi tekshirilmay
        // qolardi — aynan shu joyda xato bo'lishi mumkin.
        TariffsService,
        {
          provide: getRepositoryToken(Tariff),
          useValue: { findOne: jest.fn().mockResolvedValue(tariff) },
        },
        {
          provide: RealtimeGateway,
          useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { notifyTripCompleted: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'passenger-1', referredByUserId: null }),
          },
        },
        {
          provide: DriversService,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue({
              id: 'driver-1',
              userId: DRIVER_USER_ID,
              commissionRate: 10,
              isOnline: true,
            }),
            adjustBalanceWithin: jest
              .fn()
              .mockResolvedValue({ driverId: 'driver-1', newBalance: 1, wentOffline: false }),
            takeOfflineInRedis: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: PromoCodesService, useValue: {} },
        {
          provide: DriverBonusesService,
          useValue: { evaluateForDriver: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SettingsService,
          useValue: { getDefaultCommissionRate: jest.fn().mockResolvedValue(20) },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
    const queryService = module.get(OrdersQueryService);
    jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue({
      id: ORDER_ID,
      status: OrderStatus.IN_PROGRESS,
      driverId: DRIVER_USER_ID,
      passengerId: 'passenger-1',
      tariffId: 'tariff-1',
      paymentMethod: PaymentMethod.CASH,
      promoCodeId: null,
      isFixedPrice: false,
      fareBreakdown: null,
      arrivedAt: null,
      ...order,
    } as unknown as Order);
  }

  /** Bazaga YOZILGAN yakuniy qiymatlar. */
  const persisted = (): PersistedUpdate =>
    managerUpdate.mock.calls[0][2] as PersistedUpdate;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("qat'iy narx — kutish KAFOLATDAN TASHQARIDA", () => {
    it('8 daqiqa kutish qat\'iy narx USTIGA 2500 so\'m qo\'shadi', async () => {
      // Yo'lovchiga 43 200 so'm ko'rsatilgan edi. Biznes qaroriga ko'ra
      // kutish kafolatga kirmaydi, ya'ni u endi 45 700 to'laydi.
      await build(
        { isFixedPrice: true, fareBreakdown: quote(), arrivedAt: ARRIVED_AT },
        tariffWithWaiting(),
        min(8),
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(persisted().fareBreakdown.waitingMinutes).toBe(5);
      expect(persisted().fareBreakdown.waitingFare).toBe(2500);
      expect(persisted().fareBreakdown.total).toBe(45700);
      expect(persisted().finalPrice).toBe(45700);
    });

    it('INVARIANT: yozilgan tarkibda qatorlar yig\'indisi === jami', async () => {
      await build(
        { isFixedPrice: true, fareBreakdown: quote(), arrivedAt: ARRIVED_AT },
        tariffWithWaiting(),
        min(8),
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      const b = persisted().fareBreakdown;
      expect(sumOfLines(b)).toBeCloseTo(b.total, 6);
      expect(persisted().finalPrice).toBe(b.total);
    });

    it('quote O\'ZGARTIRILMAYDI — muzlatilgan yozuv joyida buzilmaydi', async () => {
      // `withWaitingFare` yangi obyekt qaytaradi. Joyida o'zgartirilsa,
      // buyurtma yaratilgandagi baholash yozuvi buzilardi.
      const frozen = quote();
      await build(
        { isFixedPrice: true, fareBreakdown: frozen, arrivedAt: ARRIVED_AT },
        tariffWithWaiting(),
        min(8),
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(frozen.waitingFare).toBe(0);
      expect(frozen.total).toBe(43200);
    });

    it('bepul oyna ichida kutilgan safar narxi O\'ZGARMAYDI', async () => {
      await build(
        { isFixedPrice: true, fareBreakdown: quote(), arrivedAt: ARRIVED_AT },
        tariffWithWaiting(),
        min(2.5),
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(persisted().fareBreakdown.waitingFare).toBe(0);
      expect(persisted().finalPrice).toBe(43200);
    });
  });

  describe('chegara xulqi — nizo chiqadigan aniq nuqta', () => {
    const fixedAfter = async (start: Date) => {
      await build(
        { isFixedPrice: true, fareBreakdown: quote(), arrivedAt: ARRIVED_AT },
        tariffWithWaiting(),
        start,
      );
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      return persisted().fareBreakdown;
    };

    it('AYNAN 3:00.000 — hali bepul', async () => {
      expect((await fixedAfter(min(3))).waitingFare).toBe(0);
    });

    it('3:00.001 — to\'rtinchi daqiqa BOSHLANGAN, to\'liq undiriladi', async () => {
      const b = await fixedAfter(min(3, 1));
      expect(b.waitingMinutes).toBe(1);
      expect(b.waitingFare).toBe(500);
    });

    it('7:10 kutish → 5 haqli daqiqa = 2500 so\'m', async () => {
      const b = await fixedAfter(min(7, 10_000));
      expect(b.waitingMinutes).toBe(5);
      expect(b.waitingFare).toBe(2500);
    });
  });

  describe('ORQAGA MOSLIK — hisob-kitob AVVALGIDEK qolishi shart', () => {
    it('arrivedAt = null (eski buyurtma) — kutish undirilmaydi', async () => {
      await build(
        { isFixedPrice: true, fareBreakdown: quote(), arrivedAt: null },
        tariffWithWaiting(),
        min(30),
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(persisted().fareBreakdown.waitingMinutes).toBe(0);
      expect(persisted().fareBreakdown.waitingFare).toBe(0);
      expect(persisted().finalPrice).toBe(43200);
    });

    it('kutish maydonlari YO\'Q eski tarif — NaN emas, standart qiymat', async () => {
      // Migratsiyagacha yaratilgan tarifda `waitingPricePerMinute`
      // `undefined`. Himoya bo'lmasa `5 * undefined = NaN` bo'lib,
      // butun safar narxi NaN ga aylanardi.
      await build(
        { isFixedPrice: true, fareBreakdown: quote(), arrivedAt: ARRIVED_AT },
        legacyTariff(),
        min(8),
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      const b = persisted().fareBreakdown;
      expect(Number.isNaN(b.waitingFare)).toBe(false);
      expect(b.waitingMinutes).toBe(5);
      expect(b.waitingFare).toBe(2500);
      expect(persisted().finalPrice).toBe(45700);
    });

    it('safar yozuvi yo\'q — kutish oynasini yopib bo\'lmaydi, 0', async () => {
      await build(
        { isFixedPrice: true, fareBreakdown: quote(), arrivedAt: ARRIVED_AT },
        tariffWithWaiting(),
        null,
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(persisted().fareBreakdown.waitingFare).toBe(0);
      expect(persisted().finalPrice).toBe(43200);
    });

    it('teskari vaqtlar (soat orqaga ketgan) CHEGIRMAGA aylanmaydi', async () => {
      // Manfiy kutish narxni KAMAYTIRISHI mumkin bo'lgan yagona yo'l.
      await build(
        { isFixedPrice: true, fareBreakdown: quote(), arrivedAt: min(10) },
        tariffWithWaiting(),
        ARRIVED_AT,
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(persisted().fareBreakdown.waitingMinutes).toBe(0);
      expect(persisted().fareBreakdown.waitingFare).toBe(0);
      expect(persisted().finalPrice).toBe(43200);
    });
  });

  describe('hisoblagich rejimi — kutish qoidasi AYNAN bir xil', () => {
    it('kutish hisoblagichli safarga ham USTIGA qo\'shiladi', async () => {
      await build(
        { isFixedPrice: false, fareBreakdown: null, arrivedAt: ARRIVED_AT },
        tariffWithWaiting(),
        min(8),
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      const b = persisted().fareBreakdown;
      expect(b.waitingMinutes).toBe(5);
      expect(b.waitingFare).toBe(2500);
      // Yo'l haqi safar davomiyligiga bog'liq (test soati bilan o'lchanadi),
      // shuning uchun aynan raqam emas, MUNOSABAT tekshiriladi: kutishsiz
      // qatorlar yig'indisi + kutish = jami.
      expect(sumOfLines(b)).toBeCloseTo(b.total, 6);
      expect(b.total - b.waitingFare).toBeCloseTo(sumOfLines(b) - 2500, 6);
      expect(persisted().finalPrice).toBe(b.total);
    });

    it('pul BUTUN so\'mda — kutish qatorida kasr qism yo\'q', async () => {
      await build(
        { isFixedPrice: false, fareBreakdown: null, arrivedAt: ARRIVED_AT },
        tariffWithWaiting(),
        min(7, 10_000),
      );

      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(Number.isInteger(persisted().fareBreakdown.waitingFare)).toBe(true);
      expect(persisted().fareBreakdown.waitingFare).toBe(2500);
    });
  });
});

/**
 * `order:arrived` SOCKET SHARTNOMASI.
 *
 * Yo'lovchi ilovasi hisoblagichni o'z soatidan emas, shu paketdan yuritadi.
 * Uchta maydondan bittasi tushib qolsa, ilova jimgina 3 daqiqa / 500 so'm
 * degan zaxira qiymatga qaytardi — ya'ni tarif o'zgarganda yo'lovchi
 * NOTO'G'RI raqam ko'rardi.
 */
describe('driverArrived — socket paketi', () => {
  let module: TestingModule;
  let service: OrdersService;
  let emitToUser: jest.Mock;

  const arrivedOrder = {
    id: ORDER_ID,
    status: OrderStatus.ARRIVED,
    driverId: DRIVER_USER_ID,
    passengerId: 'passenger-1',
    arrivedAt: ARRIVED_AT,
    tariff: { freeWaitMinutes: 5, waitingPricePerMinute: 800 },
  } as unknown as Order;

  beforeEach(async () => {
    emitToUser = jest.fn();

    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
    };

    module = await Test.createTestingModule({
      providers: [
        ...ORDERS_PROVIDERS,
        fakeCitiesServiceProvider(),
        { provide: OsrmService, useValue: { routeDistanceMeters: jest.fn() } },
        { provide: RoutedDistancePricing, useValue: { enabled: false } },
        { provide: SurgeService, useValue: { snapshotFor: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            // Geofence tekshiruvi: haydovchi olish nuqtasida.
            query: jest.fn().mockResolvedValue([{ distance_meters: 10 }]),
            createQueryBuilder: jest.fn(() => queryBuilder),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn() },
        },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository() },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        { provide: TariffsService, useValue: {} },
        {
          provide: RealtimeGateway,
          useValue: { emitToUser, emitToManagers: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { notifyDriverArrived: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: UsersService,
          useValue: { findById: jest.fn().mockResolvedValue({ id: 'passenger-1' }) },
        },
        { provide: DriversService, useValue: { findByUserId: jest.fn() } },
        { provide: PromoCodesService, useValue: {} },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);
    const queryService = module.get(OrdersQueryService);
    jest
      .spyOn(queryService, 'findByIdOrThrow')
      .mockResolvedValueOnce({
        id: ORDER_ID,
        status: OrderStatus.ACCEPTED,
        driverId: DRIVER_USER_ID,
        passengerId: 'passenger-1',
      } as unknown as Order)
      .mockResolvedValue(arrivedOrder);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('kutish shartnomasini TO\'LIQ uzatadi', async () => {
    await service.driverArrived(DRIVER_USER_ID, ORDER_ID);

    expect(emitToUser).toHaveBeenCalledWith('passenger-1', 'order:arrived', {
      orderId: ORDER_ID,
      arrivedAt: ARRIVED_AT,
      freeWaitMinutes: 5,
      waitingPricePerMinute: 800,
      message: 'Your driver has arrived',
    });
  });

  it('IKKINCHI marta bosilganda vaqt QAYTA yozilmaydi', async () => {
    // ⚠️ Kutish hisobi shu vaqtdan boshlanadi. Tugma qayta bosilganda vaqt
    // yangilansa, haydovchi hisobni istagancha nolga tushira olardi.
    //
    // Ikki qavat himoya bor va bu test BIRINCHISINI tekshiradi: buyurtma
    // allaqachon ARRIVED bo'lgani uchun chaqiruv SQL'ga umuman yetib
    // bormaydi. Ikkinchi qavat — `COALESCE("arrived_at", :arrivedAt)` —
    // `orders.service.spec.ts` da qo'riqlanadi va status sharti kelajakda
    // yumshatilsa ham qoidani saqlaydi.
    const queryService = module.get(OrdersQueryService);
    // `beforeEach` dagi navbat tozalanadi: bu testda BIRINCHI o'qish ham
    // allaqachon ARRIVED bo'lgan buyurtmani qaytarishi kerak.
    const findById = jest.spyOn(queryService, 'findByIdOrThrow');
    findById.mockReset();
    findById.mockResolvedValue(arrivedOrder);

    await expect(service.driverArrived(DRIVER_USER_ID, ORDER_ID)).rejects.toThrow(
      BadRequestException,
    );
    expect(emitToUser).not.toHaveBeenCalled();
  });

  it('qiymatlar HAQIQIY tarifdan keladi, standart zaxiradan emas', async () => {
    // Tarif 5 daqiqa / 800 so'm. Agar paket 3 / 500 bersa, ilova tarifni
    // umuman o'qimayotgan bo'lardi va yo'lovchi noto'g'ri raqam ko'rardi.
    await service.driverArrived(DRIVER_USER_ID, ORDER_ID);

    const payload = emitToUser.mock.calls[0][2] as {
      freeWaitMinutes: number;
      waitingPricePerMinute: number;
    };
    expect(payload.freeWaitMinutes).toBe(5);
    expect(payload.waitingPricePerMinute).toBe(800);
  });
});
