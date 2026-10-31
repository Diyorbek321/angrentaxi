import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../../database/entities/order.entity';
import { OrdersLifecycleService } from './orders-lifecycle.service';

/**
 * Hamyon rejimida kuryer naqd ovqat/market buyurtmasini faqat hamyonida
 * tovar summasi bo'lsa qabul qiladi (`VendorCashService.assertCanAccept`).
 * Tekshiruv buyurtma biriktirilishidan OLDIN — rad etilsa holat o'zgarmaydi.
 */
describe('OrdersLifecycleService.acceptOrder — sotuvchi hamyon darvozasi', () => {
  const order = {
    id: 'ride-1',
    status: OrderStatus.SEARCHING,
    driverId: null,
    passengerId: 'customer-1',
    details: { foodOrderId: 'fo-1', payVendor: 145000 },
  };

  function build(assertCanAccept: jest.Mock) {
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
      { assertCanAccept } as never,
    );
    return { service, acceptForDriver };
  }

  it('balans yetmasa — 400 va buyurtma biriktirilmaydi', async () => {
    const { service, acceptForDriver } = build(
      jest.fn().mockRejectedValue(new BadRequestException("Hamyonda mablag' yetarli emas")),
    );
    await expect(service.acceptOrder('courier-1', 'ride-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(acceptForDriver).not.toHaveBeenCalled();
  });

  it('yetarli — odatdagidek qabul qilinadi', async () => {
    const assertCanAccept = jest.fn().mockResolvedValue(undefined);
    const { service, acceptForDriver } = build(assertCanAccept);
    await service.acceptOrder('courier-1', 'ride-1');
    expect(assertCanAccept).toHaveBeenCalledWith('courier-1', order);
    expect(acceptForDriver).toHaveBeenCalledWith('ride-1', 'courier-1');
  });
});
