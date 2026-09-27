import { ConflictException } from '@nestjs/common';
import { FoodService } from './food.service';
import { FoodOrder, FoodOrderStatus, FoodPaymentMethod } from '../../database/entities/food-order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { OrderStatus, PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import { DeliveryEventsService } from '../delivery/delivery-events.service';

/**
 * The courier ride and the food order used to be two unconnected records: a
 * delivered ride left the food order at "ready", and a ride that found no
 * courier was cancelled with nobody told. These tests pin the bridge.
 */
describe('FoodService — courier delivery bridge', () => {
  const restaurant = {
    id: 'restaurant-1',
    name: 'Osh Markazi',
    phone: '+998901112233',
    ownerUserId: 'owner-1',
    commissionRate: 10,
    lat: 41.02,
    lng: 70.14,
  } as Restaurant;

  const order = (overrides: Partial<FoodOrder> = {}): FoodOrder =>
    ({
      id: 'food-1',
      restaurantId: restaurant.id,
      customerId: 'customer-1',
      customerPhone: '+998907778899',
      status: FoodOrderStatus.READY,
      items: [
        { dishId: 'd1', name: 'Osh', qty: 2, price: 30000, prepMinutes: 10 },
        { dishId: 'd2', name: 'Non', qty: 1, price: 5000, prepMinutes: 1 },
      ],
      totalPrice: 75000,
      paymentMethod: FoodPaymentMethod.CASH,
      deliveryLat: 41.03,
      deliveryLng: 70.15,
      deliveryAddress: 'Navoiy 5',
      deliveryOrderId: 'ride-1',
      ...overrides,
    }) as FoodOrder;

  function build(current: FoodOrder) {
    const events = new DeliveryEventsService();
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation(async (o) => o),
    };
    const restaurantRepo = {
      findOne: jest.fn().mockResolvedValue(restaurant),
      findOneOrFail: jest.fn().mockResolvedValue(restaurant),
    };
    const transactionRepo = { save: jest.fn().mockImplementation(async (t) => t) };
    const realtimeGateway = { emitToUser: jest.fn() };
    const ordersService = {
      create: jest.fn().mockResolvedValue({ id: 'ride-2' }),
      findByIdOrThrow: jest.fn(),
    };
    const matchingService = { startSearch: jest.fn().mockResolvedValue(undefined) };
    const tariffsService = { findAll: jest.fn().mockResolvedValue([{ id: 'tariff-food' }]) };

    const service = new FoodService(
      restaurantRepo as never,
      {} as never,
      {} as never,
      orderRepo as never,
      transactionRepo as never,
      realtimeGateway as never,
      {} as never,
      ordersService as never,
      matchingService as never,
      tariffsService as never,
      {} as never,
      events,
    );
    service.onModuleInit();
    return { service, events, orderRepo, transactionRepo, realtimeGateway, ordersService, matchingService };
  }

  const ride = (id = 'ride-1') => ({ id, details: { foodOrderId: 'food-1' } });

  it('marks the food order delivered and settles the restaurant when the courier completes', async () => {
    const { events, orderRepo, transactionRepo, realtimeGateway } = build(order());

    await events.publish(ride(), 'delivered');

    expect(orderRepo.update).toHaveBeenCalledWith(
      { id: 'food-1', status: FoodOrderStatus.READY },
      { status: FoodOrderStatus.DELIVERED },
    );
    // Cash order: only the commission debit (7 500 = 10% of 75 000).
    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ amount: 7500 }));
    expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('customer-1', 'food:order:status', {
      orderId: 'food-1',
      status: FoodOrderStatus.DELIVERED,
    });
  });

  it('does not settle twice when the restaurant already marked it delivered', async () => {
    const { events, orderRepo, transactionRepo } = build(order());
    orderRepo.update.mockResolvedValueOnce({ affected: 0 });

    await events.publish(ride(), 'delivered');

    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it('ignores late events from a ride that was replaced by a re-dispatch', async () => {
    const { events, orderRepo, realtimeGateway } = build(order({ deliveryOrderId: 'ride-2' }));

    await events.publish(ride('ride-1'), 'delivered');
    await events.publish(ride('ride-1'), 'cancelled');

    expect(orderRepo.update).not.toHaveBeenCalled();
    expect(realtimeGateway.emitToUser).not.toHaveBeenCalled();
  });

  it('tells the restaurant when no courier was found', async () => {
    const { events, realtimeGateway } = build(order());

    await events.publish(ride(), 'cancelled');

    expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('owner-1', 'food:delivery:failed', {
      orderId: 'food-1',
    });
  });

  it('forwards courier progress to the customer', async () => {
    const { events, realtimeGateway } = build(order());

    await events.publish(ride(), 'picked_up');

    expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('customer-1', 'food:order:courier', {
      orderId: 'food-1',
      stage: 'picked_up',
    });
  });

  describe('redispatchDelivery', () => {
    it('sends a new courier once the previous ride was cancelled', async () => {
      const { service, ordersService, matchingService, orderRepo } = build(order());
      ordersService.findByIdOrThrow
        .mockResolvedValueOnce({ id: 'ride-1', status: OrderStatus.CANCELLED })
        // withDelivery() reads the new ride back.
        .mockResolvedValueOnce({ id: 'ride-2', status: OrderStatus.SEARCHING });

      await service.redispatchDelivery(restaurant.id, 'food-1');

      expect(ordersService.create).toHaveBeenCalledWith(
        'customer-1',
        expect.objectContaining({
          serviceType: ServiceType.FOOD,
          paymentMethod: PaymentMethod.CASH,
          details: {
            foodOrderId: 'food-1',
            vendorName: 'Osh Markazi',
            vendorPhone: '+998901112233',
            customerPhone: '+998907778899',
            itemsCount: 3,
            // Cash order: the courier collects the full total at the door.
            collectCash: 75000,
          },
        }),
        // 75 000 total − 65 000 of food = the 10 000 delivery fee the
        // customer saw at checkout; the ride is priced at exactly that.
        { agreedFare: 10000 },
      );
      expect(matchingService.startSearch).toHaveBeenCalledWith('ride-2');
      expect(orderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ deliveryOrderId: 'ride-2' }));
    });

    it('refuses while a courier ride is still live', async () => {
      const { service, ordersService } = build(order());
      ordersService.findByIdOrThrow.mockResolvedValueOnce({ id: 'ride-1', status: OrderStatus.ACCEPTED });

      await expect(service.redispatchDelivery(restaurant.id, 'food-1')).rejects.toThrow(
        ConflictException,
      );
      expect(ordersService.create).not.toHaveBeenCalled();
    });

    it('tells a card-paid courier there is nothing to collect', async () => {
      const { service, ordersService } = build(
        order({ paymentMethod: FoodPaymentMethod.CARD, deliveryOrderId: null }),
      );
      ordersService.findByIdOrThrow.mockResolvedValue({ id: 'ride-2', status: OrderStatus.SEARCHING });

      await service.redispatchDelivery(restaurant.id, 'food-1');

      expect(ordersService.create.mock.calls[0][1].details.collectCash).toBe(0);
      // Paid online: the ride is not a cash ride either.
      expect(ordersService.create.mock.calls[0][1].paymentMethod).toBe(PaymentMethod.CARD);
    });
  });
});
