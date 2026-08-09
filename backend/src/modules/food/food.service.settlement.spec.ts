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
  let orderRepo: { findOne: jest.Mock; save: jest.Mock };
  let restaurantRepo: { findOneOrFail: jest.Mock };
  let transactionRepo: { save: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock };
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
      items: [],
      totalPrice: 80000,
      paymentMethod: FoodPaymentMethod.CASH,
      deliveryOrderId: null,
      ...overrides,
    }) as FoodOrder;

  beforeEach(() => {
    orderRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((order) => Promise.resolve(order)),
    };
    restaurantRepo = { findOneOrFail: jest.fn().mockResolvedValue(restaurant) };
    transactionRepo = { save: jest.fn().mockImplementation((tx) => Promise.resolve({ id: 'tx-1', ...tx })) };
    realtimeGateway = { emitToUser: jest.fn() };

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
        amount: 12000, // 15% of 80,000
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.CASH,
        status: TransactionStatus.COMPLETED,
        externalId: 'food_order_commission_food-order-1',
      }),
    );
  });

  it('books a gross CREDIT plus a commission DEBIT for a CARD order', async () => {
    orderRepo.findOne.mockResolvedValue(readyOrder({ paymentMethod: FoodPaymentMethod.CARD }));

    await service.advanceOrder('restaurant-1', 'food-order-1');

    expect(transactionRepo.save).toHaveBeenCalledTimes(2);
    expect(transactionRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'restaurant-owner-1',
        amount: 80000,
        type: TransactionType.CREDIT,
        paymentMethod: PaymentMethod.CARD,
        externalId: 'food_order_food-order-1',
      }),
    );
    expect(transactionRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'restaurant-owner-1',
        amount: 12000,
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
});
