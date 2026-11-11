import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '../../database/entities/order.entity';
import { OrdersLifecycleService } from './orders-lifecycle.service';

/**
 * Haydovchi faqat O'ZIGA taklif qilingan buyurtmani qabul qila oladi.
 *
 * Ilgari `acceptOrder` faqat "SEARCHING va haydovchisi yo'q" ni tekshirardi:
 * buyurtma ID sini bilgan har qanday haydovchi (yoki taklifi boshqasiga
 * o'tib ketgan haydovchi) uni tortib olardi — navbat, radius va ETA
 * tartibi chetlab o'tilardi.
 */
describe('OrdersLifecycleService.acceptOrder — taklif darvozasi', () => {
  const order = { id: 'ride-1', status: OrderStatus.SEARCHING, driverId: null, passengerId: 'p-1' };

  function build(isOfferedTo: jest.Mock) {
    const acceptForDriver = jest.fn().mockResolvedValue(undefined);
    const service = new OrdersLifecycleService(
      {} as never,
      {} as never,
      { emitToUser: jest.fn(), emitToManagers: jest.fn() } as never,
      { notifyOrderAccepted: jest.fn() } as never,
      { findById: jest.fn().mockResolvedValue(null) } as never,
      { findByUserId: jest.fn().mockResolvedValue(null) } as never,
      { findByIdOrThrow: jest.fn().mockResolvedValue(order) } as never,
      { acceptForDriver } as never,
      undefined,
      undefined,
      undefined,
      { isOfferedTo } as never,
    );
    return { service, acceptForDriver };
  }

  it('taklif qilinmagan haydovchi — 409 va buyurtma biriktirilmaydi', async () => {
    const isOfferedTo = jest.fn().mockResolvedValue(false);
    const { service, acceptForDriver } = build(isOfferedTo);

    await expect(service.acceptOrder('stranger', 'ride-1')).rejects.toBeInstanceOf(ConflictException);
    expect(isOfferedTo).toHaveBeenCalledWith('stranger', 'ride-1');
    expect(acceptForDriver).not.toHaveBeenCalled();
  });

  it('taklif qilingan haydovchi — qabul qilinadi', async () => {
    const { service, acceptForDriver } = build(jest.fn().mockResolvedValue(true));

    await service.acceptOrder('driver-a', 'ride-1');

    expect(acceptForDriver).toHaveBeenCalledWith('ride-1', 'driver-a');
  });
});
