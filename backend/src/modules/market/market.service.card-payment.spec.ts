import { MarketService } from './market.service';
import {
  MarketOrder,
  MarketOrderDeliveryMode,
  MarketOrderStatus,
  MarketPaymentMethod,
} from '../../database/entities/market-order.entity';
import { ProductStatus } from '../../database/entities/product.entity';
import { TransactionStatus } from '../../database/entities/transaction.entity';
import { CARD_PAYMENT_PENDING_MESSAGE } from '../delivery/vendor-card-payment';

/** Kartali buyurtma — to'lovdan oldin sotuvchiga ketmaydi (docs/INCIDENT-POLICY.md §1). */
describe('MarketService — kartali buyurtma to\'lovi', () => {
  const store = { id: 's1', ownerUserId: 'owner-1', commissionRate: 10, deliveryMode: 'platform' };
  const product = { id: 'p1', storeId: 's1', name: 'Televizor', price: 250000, stock: 3, status: ProductStatus.ACTIVE };

  const order = (overrides: Partial<MarketOrder> = {}): MarketOrder =>
    ({
      id: 'mo-1',
      storeId: 's1',
      customerId: 'c1',
      status: MarketOrderStatus.NEW,
      items: [{ productId: 'p1', name: 'Televizor', qty: 1, price: 250000 }],
      totalPrice: 257000,
      paymentMethod: MarketPaymentMethod.CARD,
      deliveryOrderId: null,
      promoCodeId: null,
      ...overrides,
    }) as MarketOrder;

  function build(opts: { paid?: boolean; cardAvailable?: boolean; stored?: MarketOrder } = {}) {
    const stored = opts.stored ?? order();
    const productRepo = {
      find: jest.fn().mockResolvedValue([{ ...product }]),
      findOne: jest.fn().mockResolvedValue({ ...product }),
      save: jest.fn(async (p) => p),
    };
    const movementRepo = { create: jest.fn((m) => m), save: jest.fn(async (m) => m) };
    const orderRepo = {
      create: jest.fn((o) => o),
      save: jest.fn(async (o) => ({ id: 'mo-1', ...o })),
      findOne: jest.fn().mockResolvedValue(stored),
      find: jest.fn().mockResolvedValue([stored]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
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
    const service = new MarketService(
      { findOne: jest.fn().mockResolvedValue(store), findOneOrFail: jest.fn().mockResolvedValue(store) } as never,
      {} as never,
      productRepo as never,
      movementRepo as never,
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
    return { service, orderRepo, productRepo, transactionRepo, promoCodesService, notificationsService };
  }

  const dto = (paymentMethod: MarketPaymentMethod) => ({
    storeId: 's1',
    items: [{ productId: 'p1', qty: 1 }],
    deliveryAddress: 'Angren',
    deliveryLat: 41,
    deliveryLng: 70,
    paymentMethod,
    deliveryMode: MarketOrderDeliveryMode.PLATFORM,
  });

  it("karta yo'q: 257 000 kartali ham, naqd ham — buyurtma berib bo'lmaydi, zaxira o'zgarmaydi", async () => {
    for (const method of [MarketPaymentMethod.CARD, MarketPaymentMethod.CASH]) {
      const { service, orderRepo, productRepo } = build({ cardAvailable: false });
      await expect(service.createOrder('c1', null, dto(method) as never)).rejects.toThrow(
        /karta orqali to'lov esa hozircha mavjud emas/,
      );
      expect(productRepo.save).not.toHaveBeenCalled();
      expect(orderRepo.save).not.toHaveBeenCalled();
    }
  });

  it("karta mavjud: kartali buyurtma paymentPending: true", async () => {
    const { service } = build();
    const created = await service.createOrder('c1', null, dto(MarketPaymentMethod.CARD) as never);
    expect(created.paymentPending).toBe(true);
  });

  it("to'lanmagan kartali buyurtmani yig'ishga olib bo'lmaydi", async () => {
    const { service, orderRepo } = build();
    await expect(service.advanceOrder('s1', 'mo-1')).rejects.toThrow(CARD_PAYMENT_PENDING_MESSAGE);
    expect(orderRepo.update).not.toHaveBeenCalled();
  });

  it("to'langan — yig'ishga o'tadi; ro'yxatda paymentPending", async () => {
    const paid = build({ paid: true });
    await expect(paid.service.advanceOrder('s1', 'mo-1')).resolves.toMatchObject({
      status: MarketOrderStatus.PACKING,
      paymentPending: false,
    });
    const unpaid = build();
    await expect(unpaid.service.listOrders('s1')).resolves.toEqual([
      expect.objectContaining({ id: 'mo-1', paymentPending: true }),
    ]);
  });

  it("to'lanmagan kartali buyurtma yetkazilsa — sotuvchiga tushum yozilmaydi", async () => {
    const { service, transactionRepo } = build();
    await (service as unknown as { settleDelivered: (s: unknown, o: MarketOrder) => Promise<void> }).settleDelivered(
      store,
      order({ status: MarketOrderStatus.DELIVERED }),
    );
    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it("muddat: bekor, zaxira qaytadi, promokod bo'shaydi, to'lov yopiladi, mijozga push", async () => {
    const { service, orderRepo, productRepo, transactionRepo, promoCodesService, notificationsService } = build({
      stored: order({ promoCodeId: 'pc-1' }),
    });
    await expect(service.expireUnpaidCardOrders(new Date())).resolves.toBe(1);
    expect(transactionRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'mo-1', status: TransactionStatus.PENDING }),
      { status: TransactionStatus.FAILED },
    );
    expect(orderRepo.update).toHaveBeenCalledWith(
      { id: 'mo-1', status: MarketOrderStatus.NEW },
      expect.objectContaining({ status: MarketOrderStatus.CANCELLED, cancelledBy: 'system' }),
    );
    expect(productRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', stock: 4 }));
    expect(promoCodesService.releaseForVendorOrder).toHaveBeenCalledWith('pc-1', 'c1', { kind: 'market', id: 'mo-1' });
    expect(notificationsService.notifyUserIds).toHaveBeenCalledWith(
      ['c1'],
      expect.any(Function),
      'market_order_payment_expired',
      { orderId: 'mo-1' },
    );
  });

  it("muddat: to'langan buyurtma qoladi", async () => {
    const { service, orderRepo } = build({ paid: true });
    await expect(service.expireUnpaidCardOrders(new Date())).resolves.toBe(0);
    expect(orderRepo.update).not.toHaveBeenCalled();
  });
});
