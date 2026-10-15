import { OrdersDispatchService } from './orders-dispatch.service';
import { OrderStatus } from '../../database/entities/order.entity';

/**
 * Qayta biriktirish kuryer safarida `reassigned` hodisasini oldingi kuryer
 * bilan e'lon qiladi — u sotuvchiga hamyondan to'lagan bo'lsa, o'tkazma
 * teskari qilinadi (docs/LEGAL-COMPLIANCE.md §19).
 */
describe('OrdersDispatchService.reassignDriver — kuryer safari hodisasi', () => {
  function build(previousDriverId: string | null) {
    const order = {
      id: 'ride-1',
      status: OrderStatus.ARRIVED,
      driverId: previousDriverId,
      passengerId: 'customer-1',
      details: { foodOrderId: 'fo-1' },
    };
    const updated = { ...order, driverId: 'driver-2', status: OrderStatus.ACCEPTED };
    const manager = {
      createQueryBuilder: () => {
        const qb = {
          update: () => qb,
          set: () => qb,
          where: () => qb,
          andWhere: () => qb,
          execute: async () => ({ affected: 1 }),
        };
        return qb;
      },
      save: jest.fn(),
    };
    const dispatchOverrideRepository = { manager: { transaction: async (cb: (m: unknown) => unknown) => cb(manager) } };
    const queryService = {
      findByIdOrThrow: jest.fn().mockResolvedValueOnce(order).mockResolvedValueOnce(updated),
    };
    const driversService = {
      findByIdOrThrow: jest.fn(async () => ({ id: 'dp-2', userId: 'driver-2', isOnline: true })),
      findByUserId: jest.fn(async () => null),
    };
    const deliveryEvents = { publish: jest.fn() };
    const service = new OrdersDispatchService(
      dispatchOverrideRepository as never,
      { emitToUser: jest.fn(), emitToManagers: jest.fn() } as never,
      { notifyOrderAccepted: jest.fn() } as never,
      { findById: jest.fn(async () => null) } as never,
      driversService as never,
      queryService as never,
      {} as never,
      deliveryEvents as never,
    );
    return { service, deliveryEvents, updated };
  }

  it("oldingi kuryer bo'lsa — 'reassigned' + previousCourierUserId", async () => {
    const { service, deliveryEvents, updated } = build('driver-1');
    await service.reassignDriver('ride-1', 'dp-2', 'manager-1', 'kuryer javob bermadi');
    expect(deliveryEvents.publish).toHaveBeenCalledWith(updated, 'reassigned', {
      previousCourierUserId: 'driver-1',
    });
  });

  it("oldin hech kim biriktirilmagan bo'lsa — hodisa yo'q", async () => {
    const { service, deliveryEvents } = build(null);
    await service.reassignDriver('ride-1', 'dp-2', 'manager-1', 'qo\'lda');
    expect(deliveryEvents.publish).not.toHaveBeenCalled();
  });
});
