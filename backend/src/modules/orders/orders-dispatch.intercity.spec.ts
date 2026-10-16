import { OrdersDispatchService } from './orders-dispatch.service';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';

/**
 * Shaharlararo band umumiy buyurtma yo'llarini CHETLAB o'ta olmasligi kerak:
 * `PATCH /orders/:id/cancel` o'rindiq hisobini (seats_taken), kech bekor
 * qilish/kelmaslik belgilarini bilmaydi — qatnovda "arvoh" joy qolardi.
 * Qayta biriktirish esa bandni qatnov egasidan boshqa haydovchiga berib,
 * qatnov va band bir-biridan ajralib qolardi.
 */
describe('OrdersDispatchService — shaharlararo bandlar umumiy yo\'ldan o\'tmaydi', () => {
  function build(order: Record<string, unknown>) {
    const statusTransition = { updateOrderStatusAtomic: jest.fn(async () => undefined) };
    const queryService = { findByIdOrThrow: jest.fn(async () => order) };
    const driversService = {
      findByIdOrThrow: jest.fn(async () => ({ id: 'dp-2', userId: 'driver-2', isOnline: true })),
      findByUserId: jest.fn(async () => null),
    };
    const service = new OrdersDispatchService(
      { manager: { transaction: jest.fn() } } as never,
      { emitToUser: jest.fn(), emitToManagers: jest.fn() } as never,
      { notifyOrderCancelled: jest.fn() } as never,
      { findById: jest.fn(async () => null) } as never,
      driversService as never,
      queryService as never,
      statusTransition as never,
    );
    return { service, statusTransition, driversService };
  }

  const intercity = {
    id: 'order-1',
    status: OrderStatus.SCHEDULED,
    serviceType: ServiceType.INTERCITY,
    intercityTripId: 'trip-1',
    passengerId: 'pax-1',
    driverId: 'driver-1',
  };

  describe('cancelOrder', () => {
    it.each([
      ['yo\'lovchi', 'pax-1', UserRole.PASSENGER],
      ['haydovchi', 'driver-1', UserRole.DRIVER],
      ['menejer', 'manager-1', UserRole.MANAGER],
    ])('%s ham — 400 INTERCITY_USE_INTERCITY_ENDPOINT, holat o\'zgarmaydi', async (_who, userId, role) => {
      const { service, statusTransition } = build(intercity);
      await expect(service.cancelOrder(userId, role, 'order-1', 'x')).rejects.toMatchObject({
        response: { code: 'INTERCITY_USE_INTERCITY_ENDPOINT' },
      });
      expect(statusTransition.updateOrderStatusAtomic).not.toHaveBeenCalled();
    });

    it('taksi buyurtmasi — avvalgidek bekor qilinadi (regressiya)', async () => {
      const { service, statusTransition } = build({ ...intercity, serviceType: ServiceType.TAXI, intercityTripId: null });
      await service.cancelOrder('pax-1', UserRole.PASSENGER, 'order-1', 'x');
      expect(statusTransition.updateOrderStatusAtomic).toHaveBeenCalled();
    });
  });

  describe('reassignDriver', () => {
    it('shaharlararo band — 400 INTERCITY_USE_INTERCITY_ENDPOINT, haydovchi qidirilmaydi', async () => {
      const { service, driversService } = build({ ...intercity, status: OrderStatus.ACCEPTED });
      await expect(service.reassignDriver('order-1', 'dp-2', 'manager-1', 'sabab')).rejects.toMatchObject({
        response: { code: 'INTERCITY_USE_INTERCITY_ENDPOINT' },
      });
      expect(driversService.findByIdOrThrow).not.toHaveBeenCalled();
    });
  });
});
