import { BadRequestException } from '@nestjs/common';
import { FoodService } from './food.service';
import { FoodOrder, FoodOrderStatus, FoodPaymentMethod } from '../../database/entities/food-order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';

/**
 * Coverage for the platform-commission settlement FoodService now performs
 * when a food order reaches DELIVERED (previously: Restaurant.commissionRate
 * was only used for a read-only reports endpoint, never actually settled).
 * See market.service.settlement.spec.ts for the full CASH-vs-CARD rationale
 * this mirrors.
 */
describe('FoodService - restaurant earnings settlement on delivery', () => {
  let orderRepo: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock };
  let restaurantRepo: { findOneOrFail: jest.Mock };
  let transactionRepo: { save: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock };
  let fiscalReceipts: { recordForVendorOrder: jest.Mock };
  let service: FoodService;

  const restaurant = {
    id: 'restaurant-1',
    ownerUserId: 'restaurant-owner-1',
    commissionRate: 15,
  } as Restaurant;

  const readyOrder = (overrides: Partial<FoodOrder> = {}): FoodOrder =>
    ({
      id: 'food-order-1',
      restaurantId: 'restaurant-1',
      customerId: 'customer-1',
      status: FoodOrderStatus.READY,
      // Tovar 70 000 + yetkazish 10 000 = 80 000.
      items: [
        { dishId: 'd1', name: 'Osh', qty: 2, price: 30000, prepMinutes: 10 },
        { dishId: 'd2', name: 'Non', qty: 2, price: 5000, prepMinutes: 1 },
      ],
      totalPrice: 80000,
      paymentMethod: FoodPaymentMethod.CASH,
      deliveryOrderId: null,
      ...overrides,
    }) as FoodOrder;

  beforeEach(() => {
    orderRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((order) => Promise.resolve(order)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    restaurantRepo = { findOneOrFail: jest.fn().mockResolvedValue(restaurant) };
    transactionRepo = { save: jest.fn().mockImplementation((tx) => Promise.resolve({ id: 'tx-1', ...tx })) };
    realtimeGateway = { emitToUser: jest.fn() };
    fiscalReceipts = { recordForVendorOrder: jest.fn().mockResolvedValue(null) };

    service = new FoodService(
      restaurantRepo as never,
      {} as never, // categoryRepo — unused by advanceOrder
      {} as never, // dishRepo — unused by advanceOrder
      orderRepo as never,
      transactionRepo as never,
      realtimeGateway as never,
      {} as never, // usersService — unused by advanceOrder
      {} as never, // ordersService — unused when deliveryOrderId is null
      {} as never, // matchingService — unused by advanceOrder
      {} as never, // tariffsService — unused by advanceOrder
      {} as never, // settingsService — only used when creating an order
      undefined, // deliveryEvents
      undefined, // promotionsService
      undefined, // promoCodesService
      undefined, // notificationsService
      fiscalReceipts as never,
    );
  });

  it('books only a commission DEBIT for a CASH order (no gross CREDIT)', async () => {
    orderRepo.findOne.mockResolvedValue(readyOrder({ paymentMethod: FoodPaymentMethod.CASH }));

    await service.advanceOrder('restaurant-1', 'food-order-1');

    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'restaurant-owner-1',
        orderId: null,
        amount: 10500, // 15% of the 70 000 items — never of the 10 000 delivery fee
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.CASH,
        status: TransactionStatus.COMPLETED,
        externalId: 'food_order_commission_food-order-1',
      }),
    );
  });

  it("hamyon orqali hisoblangan buyurtmada komissiya QAYTA yozilmaydi (olib ketishda yozilgan)", async () => {
    orderRepo.findOne.mockResolvedValue(
      readyOrder({ paymentMethod: FoodPaymentMethod.CASH, vendorWalletSettledAt: new Date() }),
    );

    await service.advanceOrder('restaurant-1', 'food-order-1');

    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it("o'z kuryeri (self-delivery) CARD: sotuvchiga tovar + yetkazish haqi, komissiya faqat tovardan", async () => {
    orderRepo.findOne.mockResolvedValue(readyOrder({ paymentMethod: FoodPaymentMethod.CARD }));

    await service.advanceOrder('restaurant-1', 'food-order-1');

    expect(transactionRepo.save).toHaveBeenCalledTimes(2);
    expect(transactionRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'restaurant-owner-1',
        amount: 80000, // yetkazish haqi sotuvchining o'z daromadi
        type: TransactionType.CREDIT,
        paymentMethod: PaymentMethod.CARD,
        externalId: 'food_order_food-order-1',
      }),
    );
    expect(transactionRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'restaurant-owner-1',
        amount: 10500,
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.CARD,
        externalId: 'food_order_commission_food-order-1',
      }),
    );
  });

  it('skips settlement entirely when the commission rounds to zero', async () => {
    restaurantRepo.findOneOrFail.mockResolvedValue({ ...restaurant, commissionRate: 0 });
    orderRepo.findOne.mockResolvedValue(readyOrder());

    await service.advanceOrder('restaurant-1', 'food-order-1');

    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it('0% komissiyada ham CARD buyurtma sotuvchiga kreditlanadi (faqat komissiya qatori yo‘q)', async () => {
    restaurantRepo.findOneOrFail.mockResolvedValue({ ...restaurant, commissionRate: 0 });
    orderRepo.findOne.mockResolvedValue(readyOrder({ paymentMethod: FoodPaymentMethod.CARD }));

    await service.advanceOrder('restaurant-1', 'food-order-1');

    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 80000, type: TransactionType.CREDIT, externalId: 'food_order_food-order-1' }),
    );
  });

  it("o'zi yetkazgan buyurtmaga sotuvchi fiskal cheki BIR MARTA yoziladi", async () => {
    orderRepo.findOne.mockResolvedValue(readyOrder());

    await service.advanceOrder('restaurant-1', 'food-order-1');

    expect(fiscalReceipts.recordForVendorOrder).toHaveBeenCalledTimes(1);
    expect(fiscalReceipts.recordForVendorOrder).toHaveBeenCalledWith('food', 'food-order-1');
  });

  it("qo'lda 'yetkazildi' poygani yutqazsa (409) — chek ham, komissiya ham yo'q", async () => {
    orderRepo.findOne.mockResolvedValue(readyOrder());
    orderRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.advanceOrder('restaurant-1', 'food-order-1')).rejects.toThrow();

    expect(fiscalReceipts.recordForVendorOrder).not.toHaveBeenCalled();
    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it("platforma kuryeri chaqirilgan buyurtmani sotuvchi 'yetkazildi' qila olmaydi", async () => {
    // Kuryer topilmagan (safar bekor) bo'lsa ham: yetkazildi faqat kuryer
    // topshirganda yoki dispetcher kuryer safarini yakunlaganda.
    orderRepo.findOne.mockResolvedValue(readyOrder({ deliveryOrderId: 'ride-1' }));

    await expect(service.advanceOrder('restaurant-1', 'food-order-1')).rejects.toBeInstanceOf(BadRequestException);

    expect(orderRepo.update).not.toHaveBeenCalled();
    expect(transactionRepo.save).not.toHaveBeenCalled();
  });
});
