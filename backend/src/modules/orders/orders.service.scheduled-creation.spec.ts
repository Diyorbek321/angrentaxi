// Rejalashtirilgan buyurtma YARATILISHI: vaqt validatsiyasi, SCHEDULED
// holatida tug'ilishi, va narxning aynan oddiy safardagidek QOTIRILISHI.
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OrdersService } from './orders.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { SurgeService } from '../surge/surge.service';
import { OsrmService } from '../routing/osrm.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import { fakeDataSourceProvider, fakeTransactionRepository, fakeCitiesServiceProvider } from './orders.testing';
import { OrdersQueryService } from './orders-query.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { DriverBonusesService } from '../driver-bonuses/driver-bonuses.service';
import { SettingsService } from '../settings/settings.service';
import {
  SCHEDULED_MAX_AHEAD_DAYS,
  SCHEDULED_MIN_LEAD_MINUTES,
} from './scheduled-orders.constants';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe('OrdersService.create — rejalashtirilgan safar', () => {
  let service: OrdersService;
  let queryService: OrdersQueryService;
  let orderRepository: { query: jest.Mock; findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock; emitToManagers: jest.Mock };
  let surgeService: { snapshotFor: jest.Mock };

  const baseDto = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto =>
    ({
      tariffId: 'tariff-1',
      pickupLat: 40.0956,
      pickupLng: 70.9432,
      dropoffLat: 40.105,
      dropoffLng: 70.95,
      ...overrides,
    });

  /** Hozirdan `minutes` daqiqa keyingi ISO satr. */
  const inMinutes = (minutes: number) =>
    new Date(Date.now() + minutes * MINUTE).toISOString();

  beforeEach(async () => {
    orderRepository = {
      query: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    realtimeGateway = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
    surgeService = {
      snapshotFor: jest.fn().mockResolvedValue({
        multiplier: 1.4,
        demand: 8,
        supply: 3,
        zone: 'test-zone',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...ORDERS_PROVIDERS,
        fakeCitiesServiceProvider(),
        // OSRM javob beradi -> marshrut ma'lum -> narx QAT'IY qotiriladi.
        {
          provide: OsrmService,
          useValue: { routeDistanceMeters: jest.fn().mockResolvedValue(5000) },
        },
        { provide: RoutedDistancePricing, useValue: { enabled: false } },
        { provide: SurgeService, useValue: surgeService },
        fakeDataSourceProvider(),
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        {
          provide: getRepositoryToken(Trip),
          useValue: { save: jest.fn(), findOne: jest.fn(), find: jest.fn() },
        },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository(0) },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        {
          provide: TariffsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'tariff-1', isActive: true }),
            calculatePriceBreakdown: jest.fn().mockReturnValue({
              baseFare: 5000, distanceKm: 5, pricePerKm: 2000, distanceFare: 10000,
              durationMin: 13, pricePerMin: 0, timeFare: 0,
              minPriceAdjustment: 0, surgeMultiplier: 1.4, surgeFare: 6000,
              maxPriceCap: 0, total: 21000,
            }),
          },
        },
        { provide: RealtimeGateway, useValue: realtimeGateway },
        { provide: NotificationsService, useValue: {} },
        { provide: UsersService, useValue: { findById: jest.fn(), findOrCreateByPhone: jest.fn() } },
        { provide: DriversService, useValue: { findByUserId: jest.fn() } },
        { provide: PromoCodesService, useValue: { validate: jest.fn() } },
        { provide: DriverBonusesService, useValue: {} },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);
    queryService = module.get(OrdersQueryService);
    jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.SCHEDULED,
    } as Order);
  });

  /** INSERT chaqiruvining parametrlar massivi. */
  const insertParams = (): unknown[] =>
    orderRepository.query.mock.calls[0][1] as unknown[];

  /** Qavs chuqurligini hisobga olib vergul bo'yicha bo'ladi. */
  const splitTopLevel = (text: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const ch of text) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current.trim());
    return parts;
  };

  /**
   * INSERT parametri USTUN NOMI bo'yicha.
   *
   * ⚠️ NEGA nom bo'yicha, `params[params.length - 1]` emas: bu testlar
   * dastlab oxirgi indeksga tayangandi, chunki o'sha paytda `scheduled_at`
   * oxirgi ustun edi. `city_id` qo'shilishi bilan assert jimgina BOSHQA
   * ustunni tekshira boshladi va yolg'on o'tib ketdi.
   *
   * ⚠️ Ustun TARTIBI parametr raqamiga TENG EMAS: geometriya ustunlari
   * ikkitadan o'rin egallaydi (`ST_MakePoint($3, $4)`). Shu sabab moslik
   * `VALUES` ifodasidan o'qiladi — ustun ifodasidagi BIRINCHI `$n`.
   */
  const insertParam = (column: string): unknown => {
    const sql = orderRepository.query.mock.calls[0][0] as string;
    const columns = splitTopLevel(
      sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')),
    );
    const values = splitTopLevel(
      sql.slice(sql.indexOf('(', sql.indexOf('VALUES')) + 1, sql.lastIndexOf(')')),
    );

    const columnIndex = columns.indexOf(column);
    if (columnIndex < 0) {
      throw new Error(`INSERT ustunlari orasida '${column}' yo'q`);
    }
    const placeholder = /\$(\d+)/.exec(values[columnIndex] ?? '');
    if (!placeholder) {
      throw new Error(`VALUES ichida '${column}' uchun parametr topilmadi`);
    }
    return insertParams()[Number(placeholder[1]) - 1];
  };

  describe('vaqt validatsiyasi', () => {
    it("o'tgan vaqtni rad etadi", async () => {
      await expect(
        service.create('passenger-1', baseDto({ scheduledAt: inMinutes(-60) })),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(orderRepository.query).not.toHaveBeenCalled();
    });

    it("minimal zaxiradan yaqin vaqtni rad etadi", async () => {
      await expect(
        service.create(
          'passenger-1',
          baseDto({ scheduledAt: inMinutes(SCHEDULED_MIN_LEAD_MINUTES - 5) }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maksimal ufqdan uzoq vaqtni rad etadi', async () => {
      await expect(
        service.create(
          'passenger-1',
          baseDto({ scheduledAt: new Date(Date.now() + (SCHEDULED_MAX_AHEAD_DAYS + 1) * DAY).toISOString() }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("noto'g'ri formatdagi sanani rad etadi", async () => {
      await expect(
        service.create('passenger-1', baseDto({ scheduledAt: 'ertaga ertalab' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('chegara ichidagi vaqtni qabul qiladi', async () => {
      await expect(
        service.create(
          'passenger-1',
          baseDto({ scheduledAt: inMinutes(SCHEDULED_MIN_LEAD_MINUTES + 5) }),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('buyurtma SCHEDULED holatida tug\'iladi', () => {
    it('status SCHEDULED va scheduled_at yoziladi', async () => {
      const when = inMinutes(120);
      await service.create('passenger-1', baseDto({ scheduledAt: when }));

      const params = insertParams();
      expect(params).toContain(OrderStatus.SCHEDULED);
      expect(insertParam('scheduled_at')).toEqual(new Date(when));
    });

    it("scheduledAt berilmasa mavjud xatti-harakat 1:1 saqlanadi", async () => {
      await service.create('passenger-1', baseDto());

      const params = insertParams();
      expect(params).toContain(OrderStatus.CREATED);
      // Oddiy buyurtmada scheduled_at — null.
      expect(insertParam('scheduled_at')).toBeNull();
    });
  });

  describe('narx BUYURTMA VAQTIDA qotiriladi', () => {
    it('surge yaratish paytida olinadi va quote saqlanadi', async () => {
      await service.create('passenger-1', baseDto({ scheduledAt: inMinutes(120) }));

      // Rejalashtirilgan safar ham AYNAN oddiy safar yo'lidan o'tadi:
      // marshrut hozir hisoblanadi, surge hozir olinadi, natija
      // `fare_breakdown` ga QUOTE bo'lib yoziladi va `is_fixed_price`
      // qo'yiladi. Dispatch paytida hech narsa qayta hisoblanmaydi.
      expect(surgeService.snapshotFor).toHaveBeenCalledWith(40.0956, 70.9432);

      const params = insertParams();
      expect(params).toContain(1.4); // surge_multiplier saqlangan
      expect(params).toContain(true); // is_fixed_price
      expect(params).toContain(21000); // quote total = estimated_price
    });
  });

  describe('yaratilganda qidiruv boshlanmasligi uchun signal', () => {
    it("'order:created' EMAS, 'order:scheduled' yuboriladi", async () => {
      await service.create('passenger-1', baseDto({ scheduledAt: inMinutes(120) }));

      const events = realtimeGateway.emitToUser.mock.calls.map((c) => c[1]);
      expect(events).toContain('order:scheduled');
      expect(events).not.toContain('order:created');
    });

    it('dispetcher taxtasiga chiqarilmaydi', async () => {
      await service.create('passenger-1', baseDto({ scheduledAt: inMinutes(120) }));

      expect(realtimeGateway.emitToManagers).not.toHaveBeenCalled();
    });

    it("oddiy buyurtmada 'order:created' saqlanib qoladi", async () => {
      jest.spyOn(queryService, 'findByIdOrThrow').mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CREATED,
      } as Order);

      await service.create('passenger-1', baseDto());

      const events = realtimeGateway.emitToUser.mock.calls.map((c) => c[1]);
      expect(events).toContain('order:created');
      expect(realtimeGateway.emitToManagers).toHaveBeenCalledWith(
        'order:created',
        expect.anything(),
      );
    });
  });
});

/**
 * DTO darvozasi.
 *
 * `main.ts` `ValidationPipe` ni `forbidNonWhitelisted: true` bilan
 * ishga tushiradi — ya'ni DTO da e'lon qilinmagan maydon 400 beradi.
 * Bu testlar mobil ilova yuboradigan shakl HTTP chegarasidan o'tishini
 * tekshiradi.
 */
describe('CreateOrderDto.scheduledAt', () => {
  const payload = (scheduledAt?: unknown) => ({
    tariffId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    pickupLat: 40.0956,
    pickupLng: 70.9432,
    dropoffLat: 40.105,
    dropoffLng: 70.95,
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
  });

  it('UTC ISO-8601 satrni qabul qiladi', async () => {
    const dto = plainToInstance(CreateOrderDto, payload('2026-08-20T03:00:00.000Z'));
    expect(await validate(dto)).toHaveLength(0);
  });

  it('maydonsiz ham yaroqli (odatdagi buyurtma)', async () => {
    const dto = plainToInstance(CreateOrderDto, payload());
    expect(await validate(dto)).toHaveLength(0);
  });

  it('ISO bo\'lmagan satrni rad etadi', async () => {
    const dto = plainToInstance(CreateOrderDto, payload('20-08-2026 08:00'));
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('scheduledAt');
  });
});
