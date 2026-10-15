import { ConflictException } from '@nestjs/common';
import { MarketService } from './market.service';
import {
  MarketOrder,
  MarketOrderDeliveryMode,
  MarketOrderStatus,
  MarketPaymentMethod,
} from '../../database/entities/market-order.entity';
import { Store, StoreDeliveryMode } from '../../database/entities/store.entity';
import { ProductStatus } from '../../database/entities/product.entity';
import {
  Promotion,
  PromotionDiscountType,
  PromotionScope,
  PromotionVendorType,
} from '../../database/entities/promotion.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { TransactionType } from '../../database/entities/transaction.entity';

/** docs/specs/food-market-ux-v5.md — market tomoni. */
describe('MarketService — UX v5', () => {
  const store = {
    id: 'store-1',
    name: 'Bozorcha',
    ownerUserId: 'owner-1',
    commissionRate: 10,
    deliveryMode: StoreDeliveryMode.PLATFORM,
    lat: 41,
    lng: 70,
  } as Store;

  const promotion = {
    id: 'promo-m',
    vendorType: PromotionVendorType.STORE,
    vendorId: 'store-1',
    title: 'Sut −1000',
    description: null,
    discountType: PromotionDiscountType.FIXED,
    discountValue: 1000,
    scope: PromotionScope.CATEGORY,
    categoryIds: ['cat-milk'],
    itemIds: [],
    minOrderAmount: null,
    startsAt: new Date('2026-10-01'),
    endsAt: null,
    isActive: true,
  } as unknown as Promotion;

  const products = () => [
    { id: 'p1', name: 'Sut', price: 12000, stock: 10, status: ProductStatus.ACTIVE, categoryId: 'cat-milk' },
    { id: 'p2', name: 'Non', price: 4000, stock: 5, status: ProductStatus.ACTIVE, categoryId: null },
  ];

  function build(stored?: Partial<MarketOrder>) {
    const productRows = products();
    const orderRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn().mockResolvedValue(stored ? ({ id: 'mo-1', ...stored } as MarketOrder) : null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const storeRepo = {
      findOne: jest.fn().mockResolvedValue(store),
      findOneOrFail: jest.fn().mockResolvedValue(store),
      find: jest.fn().mockResolvedValue([store]),
    };
    const productRepo = {
      find: jest.fn().mockResolvedValue(productRows),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => productRows.find((p) => p.id === where.id)),
      save: jest.fn(async (x) => x),
    };
    const movementRepo = { create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
    const categoryRepo = { find: jest.fn().mockResolvedValue([]) };
    const transactionRepo = { save: jest.fn(async (t) => t) };
    const realtimeGateway = { emitToUser: jest.fn() };
    const usersService = { findById: jest.fn().mockResolvedValue({ id: 'owner-1' }) };
    const ordersService = { findByIdOrThrow: jest.fn().mockResolvedValue({ id: 'ride-1', driverId: 'courier-1' }) };
    const settingsService = {
      getDeliveryFee: jest.fn().mockResolvedValue(7000),
      getMaxCashVendorOrder: jest.fn().mockResolvedValue(0),
    };
    const promotionsService = {
      activeForVendor: jest.fn().mockResolvedValue([promotion]),
      activeByVendor: jest.fn().mockResolvedValue(new Map([['store-1', [promotion]]])),
    };
    const promoCodesService = {
      validate: jest.fn().mockResolvedValue({ promoCodeId: 'pc-1', discountAmount: 3000, finalAmount: 0 }),
      claimForVendorOrder: jest.fn().mockResolvedValue(undefined),
      releaseForVendorOrder: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = { notifyVendorOrderCancelled: jest.fn().mockResolvedValue(undefined) };
    const service = new MarketService(
      storeRepo as never,
      categoryRepo as never,
      productRepo as never,
      movementRepo as never,
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
    return { service, orderRepo, productRepo, movementRepo, transactionRepo, realtimeGateway, promoCodesService };
  }

  it('createOrder: promotion then promo code, address details, stock taken', async () => {
    const { service, promoCodesService, productRepo } = build();
    const order = await service.createOrder('cust-1', null, {
      storeId: 'store-1',
      items: [
        { productId: 'p1', qty: 2 },
        { productId: 'p2', qty: 1 },
      ],
      deliveryAddress: 'Navoiy 5',
      deliveryLat: 41,
      deliveryLng: 70,
      promoCode: 'bozor',
      addressDetails: { apartment: '12', intercom: '12K' },
    });
    expect(order.items[0]).toMatchObject({ productId: 'p1', price: 11000, unitPrice: 12000, discountAmount: 1000 });
    expect(order.promotionDiscount).toBe(2000);
    expect(order.totalPrice).toBe(26000 + 7000);
    expect(promoCodesService.validate).toHaveBeenCalledWith('bozor', 'cust-1', 26000, { serviceType: ServiceType.MARKET });
    expect(order).toMatchObject({ promoCode: 'BOZOR', promoDiscount: 3000, payableTotal: 30000, canCancel: true });
    expect(order.addressDetails).toEqual({ apartment: '12', intercom: '12K' });
    expect(promoCodesService.claimForVendorOrder).toHaveBeenCalledWith('pc-1', 'cust-1', { kind: 'market', id: order.id });
    expect(productRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', stock: 8 }));
  });

  it('cancelByCustomer: NEW → cancelled, stock returned, promo freed, vendor event', async () => {
    const { service, productRepo, promoCodesService, realtimeGateway } = build({
      customerId: 'cust-1',
      storeId: 'store-1',
      status: MarketOrderStatus.NEW,
      items: [{ productId: 'p1', name: 'Sut', qty: 2, price: 11000, packed: false }],
      totalPrice: 29000,
      promoCodeId: 'pc-1',
      deliveryOrderId: null,
    });
    const result = await service.cancelByCustomer('cust-1', 'mo-1', 'Kerak emas');
    expect(result).toMatchObject({ status: MarketOrderStatus.CANCELLED, cancelledBy: 'customer', canCancel: false });
    expect(productRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', stock: 12 }));
    expect(promoCodesService.releaseForVendorOrder).toHaveBeenCalledWith('pc-1', 'cust-1', { kind: 'market', id: 'mo-1' });
    expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('owner-1', 'market:order:cancelled', {
      orderId: 'mo-1',
      cancelledBy: 'customer',
      cancelReason: 'Kerak emas',
    });
  });

  it('cancelByCustomer: 409 ORDER_CANCEL_NOT_ALLOWED after packing started', async () => {
    const { service } = build({ customerId: 'cust-1', storeId: 'store-1', status: MarketOrderStatus.PACKING, items: [] });
    const err = await service.cancelByCustomer('cust-1', 'mo-1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'ORDER_CANCEL_NOT_ALLOWED' });
  });

  it('advance NEW → PACKING is conditional (a cancelled order cannot be packed)', async () => {
    const { service, orderRepo } = build({ customerId: 'cust-1', storeId: 'store-1', status: MarketOrderStatus.NEW, items: [] });
    orderRepo.update.mockResolvedValue({ affected: 0 });
    await expect(service.advanceOrder('store-1', 'mo-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('storefront detail + vendor list carry finalPrice/discount; store list carries activePromotion', async () => {
    const { service } = build();
    const detail = await service.getStoreDetail('store-1');
    expect(detail.products[0]).toMatchObject({ id: 'p1', price: 12000, finalPrice: 11000, discount: { title: 'Sut −1000' } });
    expect(detail.products[1]).toMatchObject({ id: 'p2', finalPrice: 4000, discount: null });
    expect(detail.store.promotions).toHaveLength(1);
    const vendorList = await service.listProducts('store-1');
    expect(vendorList[0]).toMatchObject({ finalPrice: 11000 });
    const stores = await service.listActiveStores();
    expect(stores[0].activePromotion).toEqual({ title: 'Sut −1000', discountType: 'fixed', discountValue: 1000 });
  });

  it('self-delivered cash order: the store (who collected the cash) is credited the promo discount', async () => {
    const { service, transactionRepo } = build({
      customerId: 'cust-1',
      storeId: 'store-1',
      status: MarketOrderStatus.SHIPPED,
      deliveryMode: MarketOrderDeliveryMode.SELF,
      items: [],
      totalPrice: 33000,
      promoDiscount: 3000,
      paymentMethod: MarketPaymentMethod.CASH,
      deliveryOrderId: null,
    });
    await service.advanceOrder('store-1', 'mo-1');
    expect(transactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner-1', amount: 3000, type: TransactionType.CREDIT, externalId: 'market_order_promo_mo-1' }),
    );
  });
});
