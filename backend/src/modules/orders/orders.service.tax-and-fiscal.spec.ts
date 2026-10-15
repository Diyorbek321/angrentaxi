import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  ServiceType,
} from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { DriverBonusesService } from '../driver-bonuses/driver-bonuses.service';
import { SettingsService } from '../settings/settings.service';
import { FinancePolicyService } from '../settings/finance-policy.service';
import { CompletionFinancePolicy } from '../settings/legal-compliance-settings';
import { FiscalReceiptsService } from '../fiscal/fiscal-receipts.service';
import { OrdersService } from './orders.service';
import { OrdersQueryService } from './orders-query.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { SurgeService } from '../surge/surge.service';
import { OsrmService } from '../routing/osrm.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import { fakeTransactionRepository, fakeCitiesServiceProvider } from './orders.testing';
import { TAX_WITHHOLDING_LEDGER_TAG } from '../tax/tax-withholding';
import { ShiftPassesService } from '../shift-passes/shift-passes.service';

/**
 * Safar yakunidagi yangi pul qoidalari:
 *  · soliq agenti sifatida 1% ushlab qolish (PQ-247) — komissiya bilan bir
 *    tranzaksiyada, alohida `tax_withholding` DEBIT qatori;
 *  · ishga tushirish aksiyasi — taksi komissiyasi 0;
 *  · fiskal chek yozuvi — yakunlashni HECH QACHON buzmaydi.
 *
 * Fare 20 000 so'm, haydovchining shaxsiy stavkasi 10% (komissiya 2 000).
 */
describe('completeTrip — soliq ushlab qolish, aksiya va fiskal chek', () => {
  const DRIVER_USER_ID = 'driver-user-1';
  const ORDER_ID = 'order-1';
  const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  let service: OrdersService;
  let managerSave: jest.Mock;
  let adjustBalanceWithin: jest.Mock;
  let recordForRide: jest.Mock;
  let hasActivePassFor: jest.Mock;

  const policy = (overrides: Partial<CompletionFinancePolicy> = {}): CompletionFinancePolicy => ({
    defaultCommissionRate: 20,
    launchPromoCommissionUntil: null,
    taxWithholding: { enabled: true, ratePercent: 1 },
    ...overrides,
  });

  async function build(options: {
    policy?: CompletionFinancePolicy | null;
    paymentMethod?: PaymentMethod;
    serviceType?: ServiceType;
    driverRate?: number | null;
    fiscalFails?: boolean;
    /** undefined — smena provayderi ulanmagan (eski wiring). */
    shiftPassActive?: boolean;
  } = {}) {
    managerSave = jest.fn().mockImplementation((_e: unknown, value: unknown) => Promise.resolve(value));
    adjustBalanceWithin = jest
      .fn()
      .mockResolvedValue({ driverId: 'driver-1', newBalance: 0, wentOffline: false });
    recordForRide = options.fiscalFails
      ? jest.fn().mockRejectedValue(new Error('fiscal down'))
      : jest.fn().mockResolvedValue(undefined);

    const txManager = { update: jest.fn().mockResolvedValue({ affected: 1 }), save: managerSave };
    const optional = [
      ...(options.policy === null
        ? []
        : [{ provide: FinancePolicyService, useValue: { get: jest.fn().mockResolvedValue(options.policy ?? policy()) } }]),
      { provide: FiscalReceiptsService, useValue: { recordForRide } },
    ];
    hasActivePassFor = jest.fn().mockResolvedValue(options.shiftPassActive === true);
    if (options.shiftPassActive !== undefined) {
      optional.push({ provide: ShiftPassesService, useValue: { hasActivePassFor } } as never);
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...ORDERS_PROVIDERS,
        ...optional,
        fakeCitiesServiceProvider(),
        { provide: OsrmService, useValue: { routeDistanceMeters: jest.fn() } },
        { provide: RoutedDistancePricing, useValue: { enabled: false } },
        { provide: SurgeService, useValue: { snapshotFor: jest.fn() } },
        {
          provide: DataSource,
          useValue: {
            transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
              cb(txManager as unknown as EntityManager),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            query: jest.fn().mockResolvedValue([{ distance_meters: '3000' }]),
            update: jest.fn(),
            count: jest.fn().mockResolvedValue(5),
          },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: { findOne: jest.fn().mockResolvedValue(null), update: jest.fn() },
        },
        { provide: getRepositoryToken(Transaction), useValue: fakeTransactionRepository() },
        { provide: getRepositoryToken(DispatchOverride), useValue: {} },
        {
          provide: TariffsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'tariff-1' }),
            calculatePriceBreakdown: jest.fn((_t, km = 0, min = 0) => ({
              baseFare: 0, distanceKm: km, pricePerKm: 0, distanceFare: 0,
              durationMin: min, pricePerMin: 0, timeFare: 0,
              minPriceAdjustment: 0, surgeMultiplier: 1, surgeFare: 0,
              maxPriceCap: 0, total: 20000,
            })),
          },
        },
        { provide: RealtimeGateway, useValue: { emitToUser: jest.fn(), emitToManagers: jest.fn() } },
        { provide: NotificationsService, useValue: { notifyTripCompleted: jest.fn() } },
        {
          provide: UsersService,
          useValue: { findById: jest.fn().mockResolvedValue({ id: 'p1', referredByUserId: null }) },
        },
        {
          provide: DriversService,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue({
              id: 'driver-1',
              userId: DRIVER_USER_ID,
              commissionRate: options.driverRate === undefined ? 10 : options.driverRate,
              pinfl: '12345678901234',
              tin: null,
              isOnline: true,
            }),
            adjustBalanceWithin,
            takeOfflineInRedis: jest.fn(),
          },
        },
        { provide: PromoCodesService, useValue: {} },
        { provide: DriverBonusesService, useValue: { evaluateForDriver: jest.fn().mockResolvedValue(undefined) } },
        { provide: SettingsService, useValue: { getDefaultCommissionRate: jest.fn().mockResolvedValue(20) } },
      ],
    }).compile();

    service = module.get(OrdersService);
    jest.spyOn(module.get(OrdersQueryService), 'findByIdOrThrow').mockResolvedValue({
      id: ORDER_ID,
      status: OrderStatus.IN_PROGRESS,
      driverId: DRIVER_USER_ID,
      passengerId: 'p1',
      tariffId: 'tariff-1',
      paymentMethod: options.paymentMethod ?? PaymentMethod.CASH,
      serviceType: options.serviceType ?? ServiceType.TAXI,
      promoCodeId: null,
    } as unknown as Order);
  }

  const savedRows = () =>
    managerSave.mock.calls.map(([, row]) => row as Partial<Transaction>);
  const taxRows = () => savedRows().filter((r) => r.externalId === TAX_WITHHOLDING_LEDGER_TAG);
  const balanceDelta = () => adjustBalanceWithin.mock.calls[0][2] as number;

  describe('soliq ushlab qolish', () => {
    it('yoqilgan, naqd — 1% alohida DEBIT, balansdan komissiya bilan birga yechiladi', async () => {
      await build();
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(taxRows()).toEqual([
        expect.objectContaining({
          userId: DRIVER_USER_ID,
          orderId: ORDER_ID,
          amount: 200,
          type: TransactionType.DEBIT,
          status: TransactionStatus.COMPLETED,
        }),
      ]);
      expect(balanceDelta()).toBe(-2000 - 200);
    });

    it('karta, pul hali yig‘ilmagan — qator PENDING, balans o‘zgarmaydi', async () => {
      await build({ paymentMethod: PaymentMethod.CARD });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(taxRows()).toEqual([
        expect.objectContaining({ amount: 200, status: TransactionStatus.PENDING }),
      ]);
      expect(balanceDelta()).toBe(0);
    });

    it("o'chiq — qator yozilmaydi, hisob avvalgidek", async () => {
      await build({ policy: policy({ taxWithholding: { enabled: false, ratePercent: 1 } }) });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(taxRows()).toEqual([]);
      expect(managerSave).toHaveBeenCalledTimes(2);
      expect(balanceDelta()).toBe(-2000);
    });

    it("siyosat provayderi yo'q (eski wiring) — avvalgi xulq", async () => {
      await build({ policy: null });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(taxRows()).toEqual([]);
      expect(balanceDelta()).toBe(-2000);
    });

    it('kuryer yetkazishi ham ushlab qolinadi (ovqat yetkazish safari)', async () => {
      await build({ serviceType: ServiceType.FOOD });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      expect(taxRows()).toHaveLength(1);
    });
  });

  describe('ishga tushirish aksiyasi', () => {
    it('faol — taksi komissiyasi 0, komissiya qatori yozilmaydi', async () => {
      await build({
        policy: policy({
          launchPromoCommissionUntil: FUTURE,
          taxWithholding: { enabled: false, ratePercent: 1 },
        }),
      });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(savedRows().filter((r) => r.externalId === 'commission')).toEqual([]);
      expect(balanceDelta()).toBe(0);
    });

    it('faol, lekin yuk tashish — komissiya odatdagidek', async () => {
      await build({
        serviceType: ServiceType.CARGO,
        policy: policy({
          launchPromoCommissionUntil: FUTURE,
          taxWithholding: { enabled: false, ratePercent: 1 },
        }),
      });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      expect(balanceDelta()).toBe(-2000);
    });

    it('shaxsiy stavka yo‘q — platforma standarti siyosatdan olinadi', async () => {
      await build({ driverRate: null, policy: policy({ taxWithholding: { enabled: false, ratePercent: 1 } }) });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      expect(balanceDelta()).toBe(-4000);
    });
  });

  describe('fiskal chek', () => {
    it('har bir yakunlangan safar uchun yozuv so‘raladi (komitent — haydovchi)', async () => {
      await build();
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(recordForRide).toHaveBeenCalledWith({
        orderId: ORDER_ID,
        serviceType: ServiceType.TAXI,
        paymentMethod: PaymentMethod.CASH,
        total: 20000,
        commissionAmount: 2000,
        principalUserId: DRIVER_USER_ID,
        principalPinfl: '12345678901234',
        principalTin: null,
      });
    });

    it('fiskal xatosi safar yakunini BUZMAYDI', async () => {
      await build({ fiscalFails: true });
      await expect(service.completeTrip(DRIVER_USER_ID, ORDER_ID)).resolves.toBeDefined();
    });
  });

  describe('smena (shift pass)', () => {
    it('faol smena — komissiya 0, lekin 1% soliq baribir ushlanadi', async () => {
      await build({ shiftPassActive: true });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);

      expect(hasActivePassFor).toHaveBeenCalledWith(DRIVER_USER_ID, ServiceType.TAXI, expect.any(Date));
      expect(savedRows().filter((r) => r.externalId === 'commission')).toEqual([]);
      expect(taxRows()).toEqual([expect.objectContaining({ amount: 200 })]);
      expect(balanceDelta()).toBe(-200);
    });

    it('faol smena — fiskal chek baribir yoziladi, komissiya 0 bilan', async () => {
      await build({ shiftPassActive: true });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      expect(recordForRide).toHaveBeenCalledWith(expect.objectContaining({ total: 20000, commissionAmount: 0 }));
    });

    it('smena yo‘q — komissiya odatdagidek', async () => {
      await build({ shiftPassActive: false });
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      expect(balanceDelta()).toBe(-2000 - 200);
    });

    it('smena tekshiruvi xatosi yakunlashni buzmaydi — komissiya olinadi (konservativ)', async () => {
      await build({ shiftPassActive: false });
      hasActivePassFor.mockRejectedValue(new Error('db down'));
      await service.completeTrip(DRIVER_USER_ID, ORDER_ID);
      expect(balanceDelta()).toBe(-2000 - 200);
    });
  });
});
