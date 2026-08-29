// KUTISH SHARTNOMASI — HAR BIR buyurtma javobida.
//
// Mobil ilovalar hisoblagichni shu uchta kalitdan yuritadi:
//
//   arrivedAt              — hisob qachondan boshlanadi (null = boshlanmagan)
//   freeWaitMinutes        — qachongacha bepul
//   waitingPricePerMinute  — keyin har boshlangan daqiqa uchun qancha
//
// ⚠️ NEGA HAR BIR O'QISH YO'LI ALOHIDA TEKSHIRILADI: uchta kalit
// `attachDisplayFields` da qo'shiladi, va yangi ro'yxat metodi yozilganda
// uni chaqirishni UNUTISH juda oson. Unutilsa, javob xatosiz keladi-yu
// ilova hisoblagichni ko'rsatmaydi (yoki zaxira 3/500 ga qaytadi) — ya'ni
// nuqson faqat pul hisoblanganda, kech bilinadi.
//
// ⚠️ Kalitlar ILDIZDA, `order.tariff` ichida EMAS: `tariff` relation'i har
// bir javobda yuklanmasligi mumkin, ilovani unga bog'lash esa ekranni
// munosabat yuklanishiga bog'lab qo'yardi.
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { Trip } from '../../database/entities/trip.entity';
import { UserRole } from '../../database/entities/user.entity';
import { DriversService } from '../drivers/drivers.service';
import {
  DEFAULT_FREE_WAIT_MINUTES,
  DEFAULT_WAITING_PRICE_PER_MINUTE,
} from '../tariffs/waiting-charge';
import { OrdersQueryService } from './orders-query.service';

type WaitingContract = {
  arrivedAt: Date | null;
  freeWaitMinutes: number;
  waitingPricePerMinute: number;
};

const ARRIVED_AT = new Date('2026-08-29T10:00:00.000Z');

const orderRow = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'order-1',
    passengerId: 'passenger-1',
    driverId: null,
    status: OrderStatus.ARRIVED,
    pickupAddress: 'Angren markazi',
    dropoffAddress: 'Angren bozori',
    waypoints: null,
    completedAt: null,
    arrivedAt: ARRIVED_AT,
    // Migratsiyadan keyingi tarif: kutish qiymatlari tarifning O'ZIDAN.
    tariff: { freeWaitMinutes: 5, waitingPricePerMinute: 800 },
    ...overrides,
  }) as unknown as Order;

const contractOf = (order: Order): WaitingContract =>
  order as unknown as WaitingContract;

describe('OrdersQueryService — kutish shartnomasi har bir o\'qish yo\'lida', () => {
  let service: OrdersQueryService;
  let find: jest.Mock;
  let findAndCount: jest.Mock;
  let findOne: jest.Mock;

  beforeEach(async () => {
    find = jest.fn().mockResolvedValue([orderRow()]);
    findAndCount = jest.fn().mockResolvedValue([[orderRow()], 1]);
    findOne = jest.fn().mockResolvedValue(orderRow());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersQueryService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            find,
            findAndCount,
            findOne,
            query: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(DispatchOverride),
          useValue: { findAndCount: jest.fn().mockResolvedValue([[], 0]) },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        { provide: DriversService, useValue: { findByUserId: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersQueryService);
  });

  // Har bir tashqi o'qish yo'li — nomi va bitta buyurtma qaytaradigan chaqiruvi.
  const readPaths: Array<[string, () => Promise<Order>]> = [
    ['findByIdOrThrow (GET /orders/:id)', () => service.findByIdOrThrow('order-1')],
    [
      'findByIdForUser (kirish huquqi tekshirilgan GET /orders/:id)',
      () =>
        service.findByIdForUser('order-1', {
          id: 'passenger-1',
          role: UserRole.PASSENGER,
        }),
    ],
    [
      'getPassengerHistory (GET /orders/my)',
      async () => (await service.getPassengerHistory('passenger-1')).orders[0],
    ],
    [
      'getDriverHistory (haydovchi tarixi)',
      async () => (await service.getDriverHistory('driver-1')).orders[0],
    ],
    [
      'getActiveOrders (GET /orders/active — dispetcher taxtasi)',
      async () => (await service.getActiveOrders())[0],
    ],
    [
      'getScheduledOrders (GET /orders/scheduled)',
      async () => (await service.getScheduledOrders('passenger-1'))[0],
    ],
    [
      'getAllOrders (menejer ro\'yxati, sahifalangan)',
      async () => (await service.getAllOrders()).orders[0],
    ],
    [
      'getNoDriversFoundExceptions (dispetcher istisnolari)',
      async () => (await service.getNoDriversFoundExceptions()).orders[0],
    ],
  ];

  it.each(readPaths)('%s — uchta kalit ham javobda', async (_name, read) => {
    const order = await read();
    const contract = contractOf(order);

    expect(contract.arrivedAt).toEqual(ARRIVED_AT);
    expect(contract.freeWaitMinutes).toBe(5);
    expect(contract.waitingPricePerMinute).toBe(800);
  });

  it.each(readPaths)('%s — kalitlar ILDIZDA, tariff ichida emas', async (_name, read) => {
    const order = await read();

    // `Object.keys` ustidan tekshiriladi: qiymat `undefined` bo'lib qolsa
    // ham `toBeDefined` o'tib ketishi mumkin edi.
    expect(Object.keys(order as unknown as Record<string, unknown>)).toEqual(
      expect.arrayContaining([
        'arrivedAt',
        'freeWaitMinutes',
        'waitingPricePerMinute',
      ]),
    );
  });

  describe('qiymat manbai', () => {
    it('HAQIQIY tarifdan keladi — standart faqat zaxira', async () => {
      const order = await service.findByIdOrThrow('order-1');
      const contract = contractOf(order);

      // Tarif 5/800 bergan. 3/500 chiqsa, javob tarifni umuman o'qimayotgan
      // bo'lardi va yo'lovchi noto'g'ri raqam ko'rardi.
      expect(contract.freeWaitMinutes).not.toBe(DEFAULT_FREE_WAIT_MINUTES);
      expect(contract.waitingPricePerMinute).not.toBe(
        DEFAULT_WAITING_PRICE_PER_MINUTE,
      );
    });

    it('ESKI tarif (kutish ustunlarisiz) — standart qiymat, undefined emas', async () => {
      // Migratsiyagacha yaratilgan tarif obyektida bu maydonlar yo'q.
      // `undefined` chiqsa, ilova `null` ni ko'paytirib `NaN` ko'rsatardi.
      findOne.mockResolvedValue(orderRow({ tariff: {} as never }));

      const contract = contractOf(await service.findByIdOrThrow('order-1'));

      expect(contract.freeWaitMinutes).toBe(DEFAULT_FREE_WAIT_MINUTES);
      expect(contract.waitingPricePerMinute).toBe(DEFAULT_WAITING_PRICE_PER_MINUTE);
    });

    it('tarif munosabati umuman yuklanmagan bo\'lsa ham yiqilmaydi', async () => {
      findOne.mockResolvedValue(orderRow({ tariff: null as never }));

      const contract = contractOf(await service.findByIdOrThrow('order-1'));

      expect(contract.freeWaitMinutes).toBe(DEFAULT_FREE_WAIT_MINUTES);
      expect(contract.waitingPricePerMinute).toBe(DEFAULT_WAITING_PRICE_PER_MINUTE);
    });

    it('bepul oyna 0 — haqiqiy sozlama, standartga TUSHMAYDI', async () => {
      findOne.mockResolvedValue(
        orderRow({
          tariff: { freeWaitMinutes: 0, waitingPricePerMinute: 500 } as never,
        }),
      );

      expect(contractOf(await service.findByIdOrThrow('order-1')).freeWaitMinutes).toBe(0);
    });
  });

  describe('arrivedAt', () => {
    it('haydovchi hali "keldim" bosmagan — null, hisoblagich ko\'rsatilmaydi', async () => {
      findOne.mockResolvedValue(orderRow({ arrivedAt: null }));

      expect(contractOf(await service.findByIdOrThrow('order-1')).arrivedAt).toBeNull();
    });

    it('ESKI buyurtmada maydon umuman yo\'q — undefined emas, null', async () => {
      // Migratsiyadan oldingi qatorda `arrived_at` ustuni ham yo'q edi.
      // `undefined` JSON javobdan TUSHIB QOLADI, va ilovada "kalit yo'q"
      // bilan "hali kelmagan" farqlanmay qolardi.
      const legacy = orderRow();
      delete (legacy as unknown as Record<string, unknown>).arrivedAt;
      findOne.mockResolvedValue(legacy);

      const contract = contractOf(await service.findByIdOrThrow('order-1'));
      expect(contract.arrivedAt).toBeNull();
      expect(contract.arrivedAt).not.toBeUndefined();
    });
  });

  it('tariff relation HAR BIR o\'qish yo\'lida yuklanadi', async () => {
    // Qiymatlar haqiqiy tarifdan kelishi shu munosabatga bog'liq. U
    // tushib qolsa, javob jimgina 3/500 zaxiraga qaytardi.
    await service.getPassengerHistory('passenger-1');
    await service.getDriverHistory('driver-1');
    await service.getActiveOrders();
    await service.getScheduledOrders('passenger-1');
    await service.getAllOrders();
    await service.getNoDriversFoundExceptions();
    await service.findByIdOrThrow('order-1');

    const allCalls = [
      ...findAndCount.mock.calls,
      ...find.mock.calls,
      ...findOne.mock.calls,
    ];

    expect(allCalls.length).toBeGreaterThan(0);
    for (const [options] of allCalls as Array<[{ relations?: string[] }]>) {
      expect(options.relations).toContain('tariff');
    }
  });
});
