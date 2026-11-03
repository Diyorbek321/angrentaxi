import { BadRequestException } from '@nestjs/common';
import { FoodService } from './food.service';
import { FoodOrder, FoodOrderStatus, FoodPaymentMethod } from '../../database/entities/food-order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { TransactionStatus } from '../../database/entities/transaction.entity';
import { CARD_PAYMENT_PENDING_MESSAGE } from '../delivery/vendor-card-payment';

/**
 * Kartali buyurtma — to'lovdan oldin sotuvchiga ketmaydi
 * (docs/INCIDENT-POLICY.md §1).
 */
describe('FoodService — kartali buyurtma to\'lovi', () => {
  const restaurant = {
    id: 'rest-1',
    name: 'Osh Markazi',
    ownerUserId: 'owner-1',
    commissionRate: 10,
    lat: 41.02,
    lng: 70.14,
  } as Restaurant;

  const order = (overrides: Partial<FoodOrder> = {}): FoodOrder =>
    ({
      id: 'fo-1',
      restaurantId: 'rest-1',
      customerId: 'cust-1',
      status: FoodOrderStatus.NEW,
      items: [{ dishId: 'd1', name: 'Osh', qty: 2, price: 30000, prepMinutes: 10 }],
      totalPrice: 67000,
      paymentMethod: FoodPaymentMethod.CARD,
      deliveryOrderId: null,
      promoCodeId: null,
      ...overrides,
    }) as FoodOrder;

  function build(opts: { paid?: boolean; cardAvailable?: boolean; stored?: FoodOrder } = {}) {
    const stored = opts.stored ?? order();
    const orderRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn().mockResolvedValue(stored),
      find: jest.fn().mockResolvedValue([stored]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const restaurantRepo = {
      findOne: jest.fn().mockResolvedValue(restaurant),
      findOneOrFail: jest.fn().mockResolvedValue(restaurant),
    };
    const dishRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'd1', name: 'Osh', price: 30000, prepMinutes: 15, isAvailable: true, categoryId: 'c1' },
      ]),
    };
    const transactionRepo = {
      save: jest.fn(async (t) => t),
      count: jest.fn().mockResolvedValue(opts.paid ? 1 : 0),
      find: jest.fn().mockResolvedValue(opts.paid ? [{ orderId: stored.id, userId: stored.customerId }] : []),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const realtimeGateway = { emitToUser: jest.fn() };
    const settingsService = {
      getDeliveryPricing: jest.fn().mockResolvedValue({ deliveryFee: 7000, freeDeliveryFrom: 0 }),
      getMaxCashVendorOrder: jest.fn().mockResolvedValue(200000),
      cardPaymentsAvailable: jest.fn().mockReturnValue(opts.cardAvailable ?? true),
      getCardPaymentTimeoutMinutes: jest.fn().mockResolvedValue(15),
    };
    const promoCodesService = { releaseForVendorOrder: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = { notifyUserIds: jest.fn().mockResolvedValue(undefined) };
    const service = new FoodService(
      restaurantRepo as never,
      {} as never,
      dishRepo as never,
      orderRepo as never,
      transactionRepo as never,
      realtimeGateway as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      settingsService as never,
      undefined,
      { activeForVendor: jest.fn().mockResolvedValue([]) } as never,
      promoCodesService as never,
      notificationsService as never,
    );
    return { service, orderRepo, transactionRepo, realtimeGateway, promoCodesService, notificationsService };
  }

  const dto = {
    restaurantId: 'rest-1',
    items: [{ dishId: 'd1', qty: 2 }],
    deliveryAddress: 'Navoiy 5',
    deliveryLat: 41.03,
    deliveryLng: 70.15,
  };

  describe('createOrder', () => {
    it("karta provayderi yo'q — kartali buyurtma 400, hech narsa saqlanmaydi", async () => {
      const { service, orderRepo } = build({ cardAvailable: false });
      await expect(
        service.createOrder('cust-1', null, { ...dto, paymentMethod: FoodPaymentMethod.CARD }),
      ).rejects.toThrow(/Karta orqali to'lov hozircha mavjud emas/);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("karta yo'q va savat naqd chegarasidan oshgan — buyurtma berib bo'lmaydi", async () => {
      const { service, orderRepo } = build({ cardAvailable: false });
      await expect(
        service.createOrder('cust-1', null, { ...dto, items: [{ dishId: 'd1', qty: 10 }] }),
      ).rejects.toThrow(/karta orqali to'lov esa hozircha mavjud emas/);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("karta mavjud — yangi kartali buyurtma paymentPending: true", async () => {
      const { service } = build();
      const created = await service.createOrder('cust-1', null, { ...dto, paymentMethod: FoodPaymentMethod.CARD });
      expect(created.paymentPending).toBe(true);
    });

    it("naqd buyurtma — paymentPending: false", async () => {
      const { service } = build();
      const created = await service.createOrder('cust-1', null, dto);
      expect(created.paymentPending).toBe(false);
    });
  });

  describe('sotuvchi', () => {
    it("to'lanmagan kartali buyurtmani qabul qilib bo'lmaydi", async () => {
      const { service, orderRepo } = build();
      await expect(service.acceptOrder('rest-1', 'fo-1')).rejects.toThrow(CARD_PAYMENT_PENDING_MESSAGE);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it("to'lanmagan kartali buyurtmani advanceOrder bilan ham surib bo'lmaydi", async () => {
      const { service, orderRepo } = build();
      await expect(service.advanceOrder('rest-1', 'fo-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("to'langan kartali buyurtma qabul qilinadi", async () => {
      const { service } = build({ paid: true });
      const accepted = await service.acceptOrder('rest-1', 'fo-1');
      expect(accepted).toMatchObject({ status: FoodOrderStatus.PREPARING, paymentPending: false });
    });

    it('ro\'yxat va tafsilot paymentPending ni ko\'rsatadi', async () => {
      const unpaid = build();
      await expect(unpaid.service.listOrders('rest-1')).resolves.toEqual([
        expect.objectContaining({ id: 'fo-1', paymentPending: true }),
      ]);
      await expect(unpaid.service.getOrder('rest-1', 'fo-1')).resolves.toMatchObject({ paymentPending: true });
      const paid = build({ paid: true });
      await expect(paid.service.listOrders('rest-1')).resolves.toEqual([
        expect.objectContaining({ id: 'fo-1', paymentPending: false }),
      ]);
    });
  });

  describe('hisob-kitob', () => {
    it("to'lanmagan kartali buyurtma yetkazilsa — sotuvchiga karta tushumi YOZILMAYDI", async () => {
      // Eski (qoida kiritilmasidan oldingi) buyurtma: allaqachon READY.
      const { service, transactionRepo } = build({ stored: order({ status: FoodOrderStatus.READY }) });
      // READY → DELIVERED ham to'lovsiz bloklangan; hisob-kitob himoyasini
      // kuryer hodisasi yo'li orqali tekshiramiz.
      await (service as unknown as { settleDelivered: (r: Restaurant, o: FoodOrder) => Promise<void> }).settleDelivered(
        restaurant,
        order({ status: FoodOrderStatus.DELIVERED }),
      );
      expect(transactionRepo.save).not.toHaveBeenCalled();
    });

    it("to'langan kartali buyurtma — tushum va komissiya yoziladi", async () => {
      const { service, transactionRepo } = build({ paid: true, stored: order({ status: FoodOrderStatus.READY }) });
      await service.advanceOrder('rest-1', 'fo-1');
      expect(transactionRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('expireUnpaidCardOrders', () => {
    it("muddati o'tgan to'lanmagan buyurtma bekor: to'lov yopiladi, promokod bo'shaydi, mijozga push", async () => {
      const stale = order({ promoCodeId: 'pc-1' });
      const { service, orderRepo, transactionRepo, promoCodesService, notificationsService, realtimeGateway } =
        build({ stored: stale });
      const now = new Date('2026-11-03T12:00:00Z');

      await expect(service.expireUnpaidCardOrders(now)).resolves.toBe(1);

      // Nomzodlar: yangi, kartali, 15 daqiqadan eski.
      const where = orderRepo.find.mock.calls[0][0].where;
      expect(where).toMatchObject({ status: FoodOrderStatus.NEW, paymentMethod: FoodPaymentMethod.CARD });
      expect(transactionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'fo-1', status: TransactionStatus.PENDING }),
        { status: TransactionStatus.FAILED },
      );
      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 'fo-1', status: FoodOrderStatus.NEW },
        expect.objectContaining({ status: FoodOrderStatus.CANCELLED, cancelledBy: 'system' }),
      );
      expect(promoCodesService.releaseForVendorOrder).toHaveBeenCalledWith('pc-1', 'cust-1', {
        kind: 'food',
        id: 'fo-1',
      });
      expect(notificationsService.notifyUserIds).toHaveBeenCalledWith(
        ['cust-1'],
        expect.any(Function),
        'food_order_payment_expired',
        { orderId: 'fo-1' },
      );
      const text = notificationsService.notifyUserIds.mock.calls[0][1];
      expect(text('ru').title).toBe('Заказ отменён');
      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'owner-1',
        'food:order:cancelled',
        expect.objectContaining({ orderId: 'fo-1', cancelledBy: 'system' }),
      );
    });

    it("shu orada to'langan buyurtma bekor QILINMAYDI", async () => {
      const { service, orderRepo, notificationsService } = build({ paid: true });
      await expect(service.expireUnpaidCardOrders(new Date())).resolves.toBe(0);
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(notificationsService.notifyUserIds).not.toHaveBeenCalled();
    });

    it('sotuvchi/mijoz shu lahzada holatni o\'zgartirgan bo\'lsa — hech narsa qilinmaydi', async () => {
      const { service, orderRepo, promoCodesService, notificationsService } = build({
        stored: order({ promoCodeId: 'pc-1' }),
      });
      orderRepo.update.mockResolvedValue({ affected: 0 });
      await expect(service.expireUnpaidCardOrders(new Date())).resolves.toBe(0);
      expect(promoCodesService.releaseForVendorOrder).not.toHaveBeenCalled();
      expect(notificationsService.notifyUserIds).not.toHaveBeenCalled();
    });
  });
});
