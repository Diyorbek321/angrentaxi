import { BadRequestException } from '@nestjs/common';
import { MarketService } from './market.service';
import {
  MarketOrder,
  MarketOrderStatus,
  MarketPaymentMethod,
} from '../../database/entities/market-order.entity';
import { Store } from '../../database/entities/store.entity';
import { TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { DeliveryEventsService } from '../delivery/delivery-events.service';

/**
 * Coverage for the platform-commission settlement MarketService now performs
 * when a market order reaches DELIVERED (previously: no wallet/ledger effect
 * at all). Mirrors OrdersService.completeTrip's driver payout, with one
 * deliberate asymmetry: a CASH order does NOT book a gross CREDIT leg,
 * because the store already collected that cash directly — booking it would
 * let PaymentsService.computeBalance (used by requestWithdrawal) show a net
 * payout the store could withdraw on top of cash it already has in hand. A
 * CARD order books both legs since the platform actually holds the funds.
 */
describe('MarketService - store earnings settlement on delivery', () => {
  let orderRepo: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock };
  let storeRepo: { findOneOrFail: jest.Mock };
  let transactionRepo: { save: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock };
  let fiscalReceipts: { recordForVendorOrder: jest.Mock };
  let events: DeliveryEventsService;
  let service: MarketService;

  const store = {
    id: 'store-1',
    ownerUserId: 'store-owner-1',
    commissionRate: 10,
  } as Store;

  const shippedOrder = (overrides: Partial<MarketOrder> = {}): MarketOrder =>
    ({
      id: 'market-order-1',
      storeId: 'store-1',
      customerId: 'customer-1',
      status: MarketOrderStatus.SHIPPED,
      // Tovar 90 000 + yetkazish 10 000 = 100 000.
      items: [{ productId: 'p1', name: 'Sut', qty: 6, price: 15000, packed: true }],
      totalPrice: 100000,
      paymentMethod: MarketPaymentMethod.CASH,
      deliveryOrderId: null,
      ...overrides,
    }) as MarketOrder;

  beforeEach(() => {
    orderRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((order) => Promise.resolve(order)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    storeRepo = { findOneOrFail: jest.fn().mockResolvedValue(store) };
    transactionRepo = { save: jest.fn().mockImplementation((tx) => Promise.resolve({ id: 'tx-1', ...tx })) };
    realtimeGateway = { emitToUser: jest.fn() };
    fiscalReceipts = { recordForVendorOrder: jest.fn().mockResolvedValue(null) };
    events = new DeliveryEventsService();

    service = new MarketService(
      storeRepo as never,
      {} as never, // categoryRepo — unused by advanceOrder
      {} as never, // productRepo — unused by advanceOrder
      {} as never, // movementRepo — unused by advanceOrder
      orderRepo as never,
      transactionRepo as never,
      realtimeGateway as never,
      {} as never, // usersService — unused by advanceOrder
      {} as never, // ordersService — unused when deliveryOrderId is null
      {} as never, // matchingService — unused by advanceOrder
      {} as never, // tariffsService — unused by advanceOrder
      {} as never, // settingsService — only used when creating an order
      events,
      undefined, // promotionsService
      undefined, // promoCodesService
      undefined, // notificationsService
      fiscalReceipts as never,
    );
    service.onModuleInit();
  });

  it('books only a commission DEBIT for a CASH order (no gross CREDIT)', async () => {
    orderRepo.findOne.mockResolvedValue(shippedOrder({ paymentMethod: MarketPaymentMethod.CASH }));

    await service.advanceOrder('store-1', 'market-order-1');

    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'store-owner-1',
        orderId: null,
        amount: 9000, // 10% of the 90 000 goods — never of the 10 000 delivery fee
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.CASH,
        status: TransactionStatus.COMPLETED,
        externalId: 'market_order_commission_market-order-1',
      }),
    );
  });

  it("hamyon orqali hisoblangan buyurtmada komissiya QAYTA yozilmaydi (olib ketishda yozilgan)", async () => {
    orderRepo.findOne.mockResolvedValue(
      shippedOrder({ paymentMethod: MarketPaymentMethod.CASH, vendorWalletSettledAt: new Date() }),
    );

    await service.advanceOrder('store-1', 'market-order-1');

    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it("o'z kuryeri (self-delivery) CARD: do'konga tovar + yetkazish haqi, komissiya faqat tovardan", async () => {
    orderRepo.findOne.mockResolvedValue(shippedOrder({ paymentMethod: MarketPaymentMethod.CARD }));

    await service.advanceOrder('store-1', 'market-order-1');

    expect(transactionRepo.save).toHaveBeenCalledTimes(2);
    expect(transactionRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'store-owner-1',
        amount: 100000,
        type: TransactionType.CREDIT,
        paymentMethod: PaymentMethod.CARD,
        externalId: 'market_order_market-order-1',
      }),
    );
    expect(transactionRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'store-owner-1',
        amount: 9000,
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.CARD,
        externalId: 'market_order_commission_market-order-1',
      }),
    );
  });

  it('skips settlement entirely when the commission rounds to zero', async () => {
    storeRepo.findOneOrFail.mockResolvedValue({ ...store, commissionRate: 0 });
    orderRepo.findOne.mockResolvedValue(shippedOrder());

    await service.advanceOrder('store-1', 'market-order-1');

    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it('0% komissiyada ham CARD buyurtma do‘konga kreditlanadi (faqat komissiya qatori yo‘q)', async () => {
    storeRepo.findOneOrFail.mockResolvedValue({ ...store, commissionRate: 0 });
    orderRepo.findOne.mockResolvedValue(shippedOrder({ paymentMethod: MarketPaymentMethod.CARD }));

    await service.advanceOrder('store-1', 'market-order-1');

    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100000, type: TransactionType.CREDIT, externalId: 'market_order_market-order-1' }),
    );
  });

  it("o'zi yetkazgan buyurtmaga do'kon fiskal cheki BIR MARTA yoziladi", async () => {
    orderRepo.findOne.mockResolvedValue(shippedOrder());

    await service.advanceOrder('store-1', 'market-order-1');

    expect(fiscalReceipts.recordForVendorOrder).toHaveBeenCalledTimes(1);
    expect(fiscalReceipts.recordForVendorOrder).toHaveBeenCalledWith('market', 'market-order-1');
  });

  it('platforma kuryeri CARD: do‘konga faqat tovar (90 000) − komissiya; yetkazish haqi kuryerniki', async () => {
    orderRepo.findOne.mockResolvedValue(
      shippedOrder({ paymentMethod: MarketPaymentMethod.CARD, deliveryOrderId: 'ride-1' }),
    );

    await events.publish({ id: 'ride-1', details: { marketOrderId: 'market-order-1' } }, 'delivered');

    expect(transactionRepo.save).toHaveBeenCalledTimes(2);
    expect(transactionRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ amount: 90000, type: TransactionType.CREDIT, externalId: 'market_order_market-order-1' }),
    );
    expect(transactionRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ amount: 9000, type: TransactionType.DEBIT }),
    );
    // Kuryer yetkazgan buyurtma cheki FiscalReceiptsService obunasidan.
    expect(fiscalReceipts.recordForVendorOrder).not.toHaveBeenCalled();
  });

  it("platforma kuryeri chaqirilgan buyurtmani sotuvchi 'yetkazildi' qila olmaydi", async () => {
    // Kuryer topilmagan (safar bekor) bo'lsa ham: yetkazildi faqat kuryer
    // topshirganda yoki dispetcher kuryer safarini yakunlaganda.
    orderRepo.findOne.mockResolvedValue(shippedOrder({ deliveryOrderId: 'ride-1' }));

    await expect(service.advanceOrder('store-1', 'market-order-1')).rejects.toBeInstanceOf(BadRequestException);

    expect(orderRepo.update).not.toHaveBeenCalled();
    expect(transactionRepo.save).not.toHaveBeenCalled();
  });
});
