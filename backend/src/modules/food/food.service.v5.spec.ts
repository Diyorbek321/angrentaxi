import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FoodService } from './food.service';
import { FoodOrder, FoodOrderStatus, FoodPaymentMethod } from '../../database/entities/food-order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import {
  Promotion,
  PromotionDiscountType,
  PromotionScope,
  PromotionVendorType,
} from '../../database/entities/promotion.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { TransactionType } from '../../database/entities/transaction.entity';

/** docs/specs/food-market-ux-v5.md — bekor qilish, promokod, aksiya, manzil, kategoriyalar. */
describe('FoodService — UX v5', () => {
  const restaurant = {
    id: 'rest-1',
    name: 'Osh Markazi',
    ownerUserId: 'owner-1',
    commissionRate: 10,
    lat: 41.02,
    lng: 70.14,
  } as Restaurant;

  const promotion = (overrides: Partial<Promotion> = {}): Promotion =>
    ({
      id: 'promo-a',
      vendorType: PromotionVendorType.RESTAURANT,
      vendorId: 'rest-1',
      title: 'Osh −20%',
      description: null,
      discountType: PromotionDiscountType.PERCENT,
      discountValue: 20,
      scope: PromotionScope.ITEMS,
      categoryIds: [],
      itemIds: ['d1'],
      minOrderAmount: null,
      startsAt: new Date('2026-10-01'),
      endsAt: null,
      isActive: true,
      ...overrides,
    }) as Promotion;

  const dishes = [
    { id: 'd1', name: 'Osh', price: 30000, prepMinutes: 15, isAvailable: true, categoryId: 'c1' },
    { id: 'd2', name: 'Non', price: 5000, prepMinutes: 1, isAvailable: true, categoryId: 'c2' },
  ];

  function build(stored?: Partial<FoodOrder>) {
    const orderRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn().mockResolvedValue(stored ? ({ id: 'fo-1', ...stored } as FoodOrder) : null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const restaurantRepo = {
      findOne: jest.fn().mockResolvedValue(restaurant),
      findOneOrFail: jest.fn().mockResolvedValue(restaurant),
      find: jest.fn().mockResolvedValue([restaurant, { ...restaurant, id: 'rest-2', name: 'Lavash' }]),
    };
    const categoryRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'c1', name: 'Taomlar', sortOrder: 1, restaurantId: 'rest-1' },
        { id: 'c2', name: 'Non', sortOrder: 2, restaurantId: 'rest-1' },
        { id: 'c3', name: "Bo'sh", sortOrder: 3, restaurantId: 'rest-1' },
      ]),
    };
    const dishRepo = { find: jest.fn().mockResolvedValue(dishes) };
    const transactionRepo = { save: jest.fn(async (t) => t) };
    const realtimeGateway = { emitToUser: jest.fn() };
    const usersService = { findById: jest.fn().mockResolvedValue({ id: 'owner-1', fcmToken: 'tok' }) };
    const ordersService = { findByIdOrThrow: jest.fn().mockResolvedValue({ id: 'ride-1', driverId: 'courier-1' }) };
    const settingsService = {
      getDeliveryFee: jest.fn().mockResolvedValue(7000),
      getMaxCashVendorOrder: jest.fn().mockResolvedValue(0),
    };
    const promotionsService = {
      activeForVendor: jest.fn().mockResolvedValue([promotion()]),
      activeByVendor: jest.fn().mockResolvedValue(new Map([['rest-1', [promotion()]]])),
    };
    const promoCodesService = {
      validate: jest.fn().mockResolvedValue({ promoCodeId: 'pc-1', discountAmount: 5300, finalAmount: 0 }),
      claimForVendorOrder: jest.fn().mockResolvedValue(undefined),
      releaseForVendorOrder: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = { notifyVendorOrderCancelled: jest.fn().mockResolvedValue(undefined) };

    const service = new FoodService(
      restaurantRepo as never,
      categoryRepo as never,
      dishRepo as never,
      orderRepo as never,
      transactionRepo as never,
      realtimeGateway as never,
      usersService as never,
      ordersService as never,
      {} as never,
      {} as never,
      settingsService as never,
      undefined,
      promotionsService as never,
      promoCodesService as never,
      notificationsService as never,
    );
    return {
      service,
      orderRepo,
      transactionRepo,
      realtimeGateway,
      promoCodesService,
      promotionsService,
      notificationsService,
      restaurantRepo,
    };
  }

  const orderDto = {
    restaurantId: 'rest-1',
    items: [
      { dishId: 'd1', qty: 2 },
      { dishId: 'd2', qty: 1 },
    ],
    deliveryAddress: 'Navoiy 5',
    deliveryLat: 41.03,
    deliveryLng: 70.15,
  };

  describe('createOrder', () => {
    it('prices with the promotion first, then the promo code (platform-funded)', async () => {
      const { service, promoCodesService } = build();

      const order = await service.createOrder('cust-1', '+998901112233', {
        ...orderDto,
        promoCode: 'osh10',
        addressDetails: { entrance: ' 2 ', floor: '4', courierNote: "Qo'ng'iroq qiling" },
      });

      // d1: 30 000 −20% = 24 000 ×2; d2: 5 000 → items 53 000, delivery 7 000.
      expect(order.items[0]).toMatchObject({ dishId: 'd1', price: 24000, unitPrice: 30000, discountAmount: 6000 });
      expect(order.items[1]).toMatchObject({ dishId: 'd2', price: 5000, unitPrice: 5000, discountAmount: 0 });
      expect(order.promotionDiscount).toBe(12000);
      expect(order.totalPrice).toBe(60000);
      expect(promoCodesService.validate).toHaveBeenCalledWith('osh10', 'cust-1', 53000, {
        serviceType: ServiceType.FOOD,
      });
      expect(order.promoCode).toBe('OSH10');
      expect(order.promoDiscount).toBe(5300);
      expect(order.payableTotal).toBe(54700);
      expect(order.canCancel).toBe(true);
      expect(order.addressDetails).toEqual({ entrance: '2', floor: '4', courierNote: "Qo'ng'iroq qiling" });
      expect(promoCodesService.claimForVendorOrder).toHaveBeenCalledWith('pc-1', 'cust-1', {
        kind: 'food',
        id: order.id,
      });
    });

    it('promo discount never exceeds the goods total', async () => {
      const { service, promoCodesService } = build();
      promoCodesService.validate.mockResolvedValue({ promoCodeId: 'pc-1', discountAmount: 999999, finalAmount: 0 });
      const order = await service.createOrder('cust-1', null, { ...orderDto, promoCode: 'BIG' });
      expect(order.promoDiscount).toBe(53000);
      expect(order.payableTotal).toBe(7000);
    });

    it('an invalid / not-applicable code rejects the order and nothing is claimed', async () => {
      const { service, promoCodesService, orderRepo } = build();
      promoCodesService.validate.mockRejectedValue(new BadRequestException('nope'));
      await expect(service.createOrder('cust-1', null, { ...orderDto, promoCode: 'X' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(promoCodesService.claimForVendorOrder).not.toHaveBeenCalled();
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('without a promo code: promoCode null, promoDiscount 0, addressDetails null', async () => {
      const { service, promoCodesService } = build();
      const order = await service.createOrder('cust-1', null, orderDto);
      expect(order).toMatchObject({ promoCode: null, promoCodeId: null, promoDiscount: 0, addressDetails: null });
      expect(promoCodesService.validate).not.toHaveBeenCalled();
    });

    it('releases the claimed promo use when saving the order fails', async () => {
      const { service, promoCodesService, orderRepo } = build();
      orderRepo.save.mockRejectedValue(new Error('db down'));
      await expect(service.createOrder('cust-1', null, { ...orderDto, promoCode: 'OSH10' })).rejects.toThrow(
        'db down',
      );
      expect(promoCodesService.releaseForVendorOrder).toHaveBeenCalledWith(
        'pc-1',
        'cust-1',
        expect.objectContaining({ kind: 'food' }),
      );
    });
  });

  describe('cancelByCustomer', () => {
    const newOrder = {
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      status: FoodOrderStatus.NEW,
      items: [],
      totalPrice: 60000,
      promoDiscount: 5300,
      promoCodeId: 'pc-1',
      deliveryOrderId: null,
    };

    it('cancels a NEW order, frees the promo code and tells the restaurant', async () => {
      const { service, orderRepo, promoCodesService, realtimeGateway, notificationsService } = build(newOrder);

      const result = await service.cancelByCustomer('cust-1', 'fo-1', '  Adashib buyurtma berdim ');

      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 'fo-1', customerId: 'cust-1', status: FoodOrderStatus.NEW },
        expect.objectContaining({
          status: FoodOrderStatus.CANCELLED,
          cancelledBy: 'customer',
          cancelReason: 'Adashib buyurtma berdim',
        }),
      );
      expect(result).toMatchObject({
        status: FoodOrderStatus.CANCELLED,
        cancelledBy: 'customer',
        cancelReason: 'Adashib buyurtma berdim',
        canCancel: false,
      });
      expect(promoCodesService.releaseForVendorOrder).toHaveBeenCalledWith('pc-1', 'cust-1', {
        kind: 'food',
        id: 'fo-1',
      });
      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('owner-1', 'food:order:cancelled', {
        orderId: 'fo-1',
        cancelledBy: 'customer',
        cancelReason: 'Adashib buyurtma berdim',
      });
      expect(notificationsService.notifyVendorOrderCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'owner-1' }),
        'food',
        'fo-1',
        'Adashib buyurtma berdim',
      );
    });

    it('409 ORDER_CANCEL_NOT_ALLOWED once the restaurant accepted', async () => {
      const { service, orderRepo } = build({ ...newOrder, status: FoodOrderStatus.PREPARING });
      const err = await service.cancelByCustomer('cust-1', 'fo-1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({ code: 'ORDER_CANCEL_NOT_ALLOWED' });
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('409 when the restaurant accepts in the same instant (conditional write lost)', async () => {
      const { service, orderRepo, promoCodesService } = build(newOrder);
      orderRepo.update.mockResolvedValue({ affected: 0 });
      await expect(service.cancelByCustomer('cust-1', 'fo-1')).rejects.toBeInstanceOf(ConflictException);
      expect(promoCodesService.releaseForVendorOrder).not.toHaveBeenCalled();
    });

    it("404 for someone else's order", async () => {
      const { service } = build();
      await expect(service.cancelByCustomer('cust-1', 'fo-x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('acceptOrder is a conditional NEW → PREPARING write (cannot resurrect a cancelled order)', async () => {
    const { service, orderRepo } = build({
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      status: FoodOrderStatus.NEW,
      items: [],
      totalPrice: 1,
    });
    orderRepo.update.mockResolvedValue({ affected: 0 });
    await expect(service.acceptOrder('rest-1', 'fo-1')).rejects.toBeInstanceOf(ConflictException);
    expect(orderRepo.update).toHaveBeenCalledWith(
      { id: 'fo-1', status: FoodOrderStatus.NEW },
      { status: FoodOrderStatus.PREPARING },
    );
  });

  it('rejectOrder marks cancelledBy=vendor and frees the promo code', async () => {
    const { service, promoCodesService } = build({
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      status: FoodOrderStatus.NEW,
      items: [],
      totalPrice: 1,
      promoCodeId: 'pc-1',
    });
    const result = await service.rejectOrder('rest-1', 'fo-1', 'Osh tugadi');
    expect(result).toMatchObject({ status: FoodOrderStatus.CANCELLED, cancelledBy: 'vendor', canCancel: false });
    expect(promoCodesService.releaseForVendorOrder).toHaveBeenCalledWith('pc-1', 'cust-1', { kind: 'food', id: 'fo-1' });
  });

  it('vendor dish list carries finalPrice/discount too (panel shows the active promotion)', async () => {
    const { service } = build();
    const list = await service.listDishes('rest-1');
    expect(list[0]).toMatchObject({ id: 'd1', finalPrice: 24000, discount: expect.objectContaining({ discountValue: 20 }) });
    expect(list[1]).toMatchObject({ id: 'd2', finalPrice: 5000, discount: null });
  });

  describe('storefront', () => {
    it('restaurant list carries activePromotion (strongest) or null', async () => {
      const { service } = build();
      const list = await service.listActiveRestaurants();
      expect(list[0].activePromotion).toEqual({ title: 'Osh −20%', discountType: 'percent', discountValue: 20 });
      expect(list[1].activePromotion).toBeNull();
    });

    it('restaurant detail: categories with itemCount (no empty ones), dish finalPrice/discount, promotions', async () => {
      const { service } = build();
      const detail = await service.getRestaurantDetail('rest-1');

      expect(detail.categories).toEqual([
        { id: 'c1', name: 'Taomlar', sortOrder: 1, itemCount: 1 },
        { id: 'c2', name: 'Non', sortOrder: 2, itemCount: 1 },
      ]);
      expect(detail.dishes[0]).toMatchObject({
        id: 'd1',
        categoryId: 'c1',
        price: 30000,
        finalPrice: 24000,
        discount: { title: 'Osh −20%', discountType: 'percent', discountValue: 20 },
      });
      expect(detail.dishes[1]).toMatchObject({ id: 'd2', price: 5000, finalPrice: 5000, discount: null });
      expect(detail.restaurant.promotions).toHaveLength(1);
      expect(detail.restaurant.activePromotion).toEqual(
        expect.objectContaining({ discountType: 'percent', discountValue: 20 }),
      );
      expect(detail.promotions).toHaveLength(1);
    });
  });

  describe('promo compensation on delivery (cash, courier collected less)', () => {
    it('credits the courier the promo discount; commission is still on totalPrice', async () => {
      const ready = {
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        status: FoodOrderStatus.READY,
        items: [],
        totalPrice: 60000,
        promoDiscount: 5300,
        paymentMethod: FoodPaymentMethod.CASH,
        deliveryOrderId: null,
      };
      const { service, transactionRepo } = build(ready);

      await service.advanceOrder('rest-1', 'fo-1'); // self-delivered → vendor collected

      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 6000, type: TransactionType.DEBIT, externalId: 'food_order_commission_fo-1' }),
      );
      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-1',
          amount: 5300,
          type: TransactionType.CREDIT,
          externalId: 'food_order_promo_fo-1',
        }),
      );
    });

    it('no compensation row on a card order', async () => {
      const { service, transactionRepo } = build({
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        status: FoodOrderStatus.READY,
        items: [],
        totalPrice: 60000,
        promoDiscount: 5300,
        paymentMethod: FoodPaymentMethod.CARD,
        deliveryOrderId: null,
      });
      await service.advanceOrder('rest-1', 'fo-1');
      expect(transactionRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ externalId: 'food_order_promo_fo-1' }),
      );
    });
  });
});
