// Rejalashtirilgan safarning YURAGI: cron kimni topadi, dispatch qanday
// idempotent bo'ladi, va narx nima uchun QAYTA HISOBLANMAYDI.
//
// Bu spec `ORDERS_PROVIDERS` ni ATAYLAB ishlatmaydi — `ScheduledOrdersService`
// o'sha massivdan tashqarida turadi (`orders.module.ts` dagi izohga qarang),
// shuning uchun bu yerda faqat unga kerak bo'lgan hamkorlar mock qilinadi.
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, LessThan } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TariffsService } from '../tariffs/tariffs.service';
import { UsersService } from '../users/users.service';
import { OrdersCreationService } from './orders-creation.service';
import { OrdersQueryService } from './orders-query.service';
import { OrderStatusTransitionService } from './order-status-transition.service';
import { ScheduledOrdersService } from './scheduled-orders.service';
import {
  SCHEDULED_DISPATCH_LEAD_MINUTES,
  SCHEDULED_STALE_AFTER_MINUTES,
} from './scheduled-orders.constants';

describe('ScheduledOrdersService', () => {
  let service: ScheduledOrdersService;

  let orderRepository: { find: jest.Mock };
  let queryService: { findByIdOrThrow: jest.Mock };
  let creationService: { getOutstandingWalletDebt: jest.Mock };
  let statusTransition: { updateOrderStatusAtomic: jest.Mock };
  let tariffsService: { findById: jest.Mock };
  let matchingService: { startSearch: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock; emitToManagers: jest.Mock };
  let notificationsService: { notifyOrderCancelled: jest.Mock };
  let usersService: { findById: jest.Mock };

  // ⚠️ SOAT QOTIRILGAN VA HAR BIR CHAQIRUVGA UZATILADI.
  // `releaseDueOrder(id)` ni `now` siz chaqirish real soatni ishlatadi, holbuki
  // quyidagi fixture `scheduledAt` ni qat'iy sanaga bog'lab qo'yadi. Ular
  // ajralgan zahoti reja `SCHEDULED_STALE_AFTER_MINUTES` dan eskirgan bo'lib
  // ko'rinadi va servis uni ishga tushirish o'rniga BEKOR qiladi — ya'ni test
  // faqat kunning 38 daqiqasida o'tadi, qolgan vaqtda yiqiladi. Shuning uchun
  // pastdagi har bir `releaseDueOrder` ga aynan shu `NOW` beriladi.
  const NOW = new Date('2026-08-19T10:00:00.000Z');

  const scheduledOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'order-1',
      passengerId: 'passenger-1',
      tariffId: 'tariff-1',
      status: OrderStatus.SCHEDULED,
      estimatedPrice: 18000,
      scheduledAt: new Date('2026-08-19T10:08:00.000Z'),
      ...overrides,
    }) as Order;

  beforeEach(async () => {
    orderRepository = { find: jest.fn().mockResolvedValue([]) };
    queryService = { findByIdOrThrow: jest.fn() };
    creationService = { getOutstandingWalletDebt: jest.fn().mockResolvedValue(0) };
    statusTransition = { updateOrderStatusAtomic: jest.fn().mockResolvedValue(undefined) };
    tariffsService = {
      findById: jest.fn().mockResolvedValue({ id: 'tariff-1', isActive: true }),
    };
    matchingService = { startSearch: jest.fn().mockResolvedValue(undefined) };
    realtimeGateway = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
    notificationsService = { notifyOrderCancelled: jest.fn().mockResolvedValue(undefined) };
    usersService = { findById: jest.fn().mockResolvedValue({ id: 'passenger-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledOrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: OrdersQueryService, useValue: queryService },
        { provide: OrdersCreationService, useValue: creationService },
        { provide: OrderStatusTransitionService, useValue: statusTransition },
        { provide: TariffsService, useValue: tariffsService },
        { provide: MatchingService, useValue: matchingService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(ScheduledOrdersService);
  });

  describe('dispatchDueOrders — cron kimni topadi', () => {
    it("faqat SCHEDULED va stale oynasi bilan cheklangan oraliqni so'raydi", async () => {
      await service.dispatchDueOrders(NOW);

      const expectedCutoff = new Date(
        NOW.getTime() + SCHEDULED_DISPATCH_LEAD_MINUTES * 60_000,
      );
      // Pastki chegara `cancelStaleScheduled` oynasiga TUTASHADI: ikkalasi
      // birga butun vaqt o'qini bo'shliqsiz va ustma-ustliksiz qoplaydi.
      const expectedFloor = new Date(
        NOW.getTime() - SCHEDULED_STALE_AFTER_MINUTES * 60_000,
      );

      expect(orderRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: OrderStatus.SCHEDULED,
            scheduledAt: Between(expectedFloor, expectedCutoff),
          },
        }),
      );
    });

    it('eng yaqin rejani birinchi ishlaydi va paketni cheklaydi', async () => {
      await service.dispatchDueOrders(NOW);

      const args = orderRepository.find.mock.calls[0][0];
      expect(args.order).toEqual({ scheduledAt: 'ASC' });
      expect(args.take).toBeGreaterThan(0);
    });

    it("bitta buzuq buyurtma butun paketni to'xtatmaydi", async () => {
      orderRepository.find.mockResolvedValue([{ id: 'bad' }, { id: 'good' }]);
      queryService.findByIdOrThrow.mockImplementation(async (id: string) => {
        if (id === 'bad') throw new Error('tarif topilmadi');
        return scheduledOrder({ id: 'good' });
      });

      const released = await service.dispatchDueOrders(NOW);

      expect(released).toBe(1);
      expect(matchingService.startSearch).toHaveBeenCalledWith('good');
    });
  });

  describe('releaseDueOrder — idempotentlik', () => {
    it('SCHEDULED bo\'lmagan buyurtmaga umuman tegmaydi', async () => {
      queryService.findByIdOrThrow.mockResolvedValue(
        scheduledOrder({ status: OrderStatus.SEARCHING }),
      );

      await expect(service.releaseDueOrder('order-1', NOW)).resolves.toBe(false);

      expect(statusTransition.updateOrderStatusAtomic).not.toHaveBeenCalled();
      expect(matchingService.startSearch).not.toHaveBeenCalled();
    });

    it('shartli UPDATE ni AYNAN [SCHEDULED] kutilgan holati bilan bajaradi', async () => {
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder());

      await service.releaseDueOrder('order-1', NOW);

      expect(statusTransition.updateOrderStatusAtomic).toHaveBeenCalledWith(
        'order-1',
        [OrderStatus.SCHEDULED],
        { status: OrderStatus.CREATED },
      );
    });

    it('poygada yutqazganda (ConflictException) startSearch CHAQIRILMAYDI', async () => {
      // Ikki instans bir vaqtda bir buyurtmani ko'rdi. Ikkinchisining
      // shartli UPDATE'i 0 qatorga tegadi — u qidiruvni takror
      // boshlamasligi SHART, aks holda bitta safar uchun ikkita haydovchi
      // navbati ochilardi.
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder());
      statusTransition.updateOrderStatusAtomic.mockRejectedValue(
        new ConflictException('Order is no longer in the expected state'),
      );

      await expect(service.releaseDueOrder('order-1', NOW)).resolves.toBe(false);

      expect(matchingService.startSearch).not.toHaveBeenCalled();
    });

    it('yutgan instansda startSearch AYNAN BIR MARTA chaqiriladi', async () => {
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder());

      await expect(service.releaseDueOrder('order-1', NOW)).resolves.toBe(true);

      expect(matchingService.startSearch).toHaveBeenCalledTimes(1);
      expect(matchingService.startSearch).toHaveBeenCalledWith('order-1');
    });

    it('ConflictException bo\'lmagan xatoni yutmaydi', async () => {
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder());
      statusTransition.updateOrderStatusAtomic.mockRejectedValue(new Error('baza yiqildi'));

      await expect(service.releaseDueOrder('order-1', NOW)).rejects.toThrow('baza yiqildi');
    });
  });

  describe('releaseDueOrder — narx QOTIRILGAN', () => {
    it('tarifni qayta narxlamaydi va estimatedPrice ga tegmaydi', async () => {
      const order = scheduledOrder({ estimatedPrice: 18000 });
      queryService.findByIdOrThrow.mockResolvedValue(order);

      await service.releaseDueOrder('order-1', NOW);

      // Narx buyurtma berilganda `fare_breakdown` ga QUOTE sifatida
      // yozilgan va `is_fixed_price` bilan qotirilgan. Dispatch paytida
      // qayta hisoblansa, yo'lovchiga ko'rsatilgan raqam bilan
      // undiriladigan raqam bir-biridan uzoqlashardi.
      const updatePayload = statusTransition.updateOrderStatusAtomic.mock.calls[0][2];
      expect(updatePayload).toEqual({ status: OrderStatus.CREATED });
      expect(updatePayload).not.toHaveProperty('estimatedPrice');
      expect(updatePayload).not.toHaveProperty('discountAmount');
    });

    it("yo'lovchiga o'zgarmagan narx bilan xabar yuboradi", async () => {
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder({ estimatedPrice: 18000 }));

      await service.releaseDueOrder('order-1', NOW);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'passenger-1',
        'order:scheduled_released',
        expect.objectContaining({ orderId: 'order-1', estimatedPrice: 18000 }),
      );
    });
  });

  describe('releaseDueOrder — dispatch paytidagi darvozalar', () => {
    it('tarif nofaol bo\'lsa bekor qiladi va qidiruv boshlamaydi', async () => {
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder());
      tariffsService.findById.mockResolvedValue({ id: 'tariff-1', isActive: false });

      await expect(service.releaseDueOrder('order-1', NOW)).resolves.toBe(false);

      expect(statusTransition.updateOrderStatusAtomic).toHaveBeenCalledWith(
        'order-1',
        [OrderStatus.SCHEDULED],
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      expect(matchingService.startSearch).not.toHaveBeenCalled();
    });

    it("qarz paydo bo'lgan bo'lsa bekor qiladi va push yuboradi", async () => {
      // Yo'lovchi rejalashtirgan paytda qarzsiz edi; oradan o'tgan vaqtda
      // hamyoni yetmagan safar qoldirgan.
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder());
      creationService.getOutstandingWalletDebt.mockResolvedValue(12000);

      await expect(service.releaseDueOrder('order-1', NOW)).resolves.toBe(false);

      expect(matchingService.startSearch).not.toHaveBeenCalled();
      expect(notificationsService.notifyOrderCancelled).toHaveBeenCalledTimes(1);
    });

    it('qarz nol bo\'lganda odatdagidek davom etadi', async () => {
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder());
      creationService.getOutstandingWalletDebt.mockResolvedValue(0);

      await expect(service.releaseDueOrder('order-1', NOW)).resolves.toBe(true);
    });
  });

  describe('cancelStaleScheduled', () => {
    it('scheduled_at dan belgilangan vaqt o\'tganlarni so\'raydi', async () => {
      await service.cancelStaleScheduled(NOW);

      const expectedCutoff = new Date(
        NOW.getTime() - SCHEDULED_STALE_AFTER_MINUTES * 60_000,
      );

      expect(orderRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: OrderStatus.SCHEDULED,
            scheduledAt: LessThan(expectedCutoff),
          },
        }),
      );
    });

    it('topilganini bekor qiladi va qidiruv BOSHLAMAYDI', async () => {
      orderRepository.find.mockResolvedValue([{ id: 'stale-1' }]);
      queryService.findByIdOrThrow.mockResolvedValue(scheduledOrder({ id: 'stale-1' }));

      await expect(service.cancelStaleScheduled(NOW)).resolves.toBe(1);

      expect(statusTransition.updateOrderStatusAtomic).toHaveBeenCalledWith(
        'stale-1',
        [OrderStatus.SCHEDULED],
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      expect(matchingService.startSearch).not.toHaveBeenCalled();
    });
  });

  describe('cron o\'ramlari', () => {
    it('dispatch tick xatoni yutadi — scheduler jim qolmasligi kerak', async () => {
      orderRepository.find.mockRejectedValue(new Error('baza yiqildi'));

      await expect(service.handleDispatchTick()).resolves.toBeUndefined();
    });

    it('stale tick xatoni yutadi', async () => {
      orderRepository.find.mockRejectedValue(new Error('baza yiqildi'));

      await expect(service.handleStaleTick()).resolves.toBeUndefined();
    });
  });

  // ⚠️ IKKI CRON'NING ORALIG'I. `dispatchDueOrders` va `cancelStaleScheduled`
  // bir xil qatorlarni ko'rishi MUMKIN emas: eskirgan reja ikkalasiga ham
  // tushsa, dispatch (har daqiqada, eng eskisi BIRINCHI) stale'dan (har 10
  // daqiqada) doim oldin yetib boradi va xavfsizlik to'ri hech qachon
  // ishlamaydi.
  describe('eskirgan reja dispatch va stale oralig\'ida yo\'qolmaydi', () => {
    // Backend uzoq o'chib turgan holat: reja vaqti 2 soat oldin edi.
    const STALE_AT = new Date(NOW.getTime() - 120 * 60_000);

    it("dispatch so'rovi eskirgan rejalarni QAMRAB OLMAYDI (pastki chegara bor)", async () => {
      await service.dispatchDueOrders(NOW);

      const where = orderRepository.find.mock.calls[0][0].where;
      const staleCutoff = new Date(NOW.getTime() - SCHEDULED_STALE_AFTER_MINUTES * 60_000);

      // `scheduledAt` faqat yuqori chegara bo'lsa, 2 soat oldingi reja ham
      // shu so'rovga tushadi — aynan `cancelStaleScheduled` to'sishi kerak
      // bo'lgan holat.
      expect(where.scheduledAt).toEqual(
        Between(
          staleCutoff,
          new Date(NOW.getTime() + SCHEDULED_DISPATCH_LEAD_MINUTES * 60_000),
        ),
      );
    });

    it('eskirgan rejani ishga TUSHIRMAYDI, bekor qiladi', async () => {
      queryService.findByIdOrThrow.mockResolvedValue(
        scheduledOrder({ id: 'stale-1', scheduledAt: STALE_AT }),
      );

      const released = await service.releaseDueOrder('stale-1', NOW);

      expect(released).toBe(false);
      expect(matchingService.startSearch).not.toHaveBeenCalled();
      expect(statusTransition.updateOrderStatusAtomic).toHaveBeenCalledWith(
        'stale-1',
        [OrderStatus.SCHEDULED],
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
    });
  });

});
