import { BadRequestException } from '@nestjs/common';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { OrdersLifecycleService } from './orders-lifecycle.service';

/**
 * Shaharlararo band alohida boshlanmaydi: yo'lovchilar qatnov jo'naganda
 * (`IntercityLifecycleService.depart`) BIRGA yo'lga chiqadi. Aks holda band
 * jo'nashdan oldin yakunlanib, qatnov `boarding` da qotib qolardi.
 * Taksi safari xulqi o'zgarmaydi — ikkinchi test shuni qulflaydi.
 */
describe('OrdersLifecycleService.startTrip — shaharlararo band', () => {
  function build(order: Record<string, unknown>) {
    const updateOrderStatusAtomic = jest.fn(async () => undefined);
    const tripRepository = { save: jest.fn(async () => ({})) };
    const service = new OrdersLifecycleService(
      {} as never,
      tripRepository as never,
      { emitToUser: jest.fn(), emitToManagers: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { findByIdOrThrow: jest.fn().mockResolvedValue(order) } as never,
      { updateOrderStatusAtomic } as never,
    );
    return { service, updateOrderStatusAtomic, tripRepository };
  }

  it("intercity band — 400, holat o'zgarmaydi", async () => {
    const { service, updateOrderStatusAtomic } = build({
      id: 'order-1',
      status: OrderStatus.ARRIVED,
      driverId: 'driver-1',
      passengerId: 'pax-1',
      serviceType: ServiceType.INTERCITY,
      intercityTripId: 'trip-1',
    });
    await expect(service.startTrip('driver-1', 'order-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(updateOrderStatusAtomic).not.toHaveBeenCalled();
  });

  it('taksi safari — avvalgidek boshlanadi (regressiya)', async () => {
    const { service, updateOrderStatusAtomic, tripRepository } = build({
      id: 'order-2',
      status: OrderStatus.ARRIVED,
      driverId: 'driver-1',
      passengerId: 'pax-1',
      serviceType: ServiceType.TAXI,
      intercityTripId: null,
      isMetered: false,
    });
    await service.startTrip('driver-1', 'order-2');
    expect(updateOrderStatusAtomic).toHaveBeenCalledWith('order-2', OrderStatus.ARRIVED, {
      status: OrderStatus.IN_PROGRESS,
    });
    expect(tripRepository.save).toHaveBeenCalled();
  });
});
