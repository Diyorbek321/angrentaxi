import { OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';
import { OrdersDispatchService } from './orders-dispatch.service';
import { OrdersLifecycleService } from './orders-lifecycle.service';

/**
 * "Buyurtma → haydovchi" zanjiri auditi (2026-10-31), buyurtma tomoni:
 *   1. Yo'lovchi bekor qilgan lahzada haydovchi qabul qilsa, haydovchiga
 *      xabar bormasdi — u bekor bo'lgan safarda qolib ketardi.
 *   2. Qabul yozilgandan KEYINGI xabarnoma xatosi haydovchiga 500 qaytarardi,
 *      holbuki safar unga allaqachon biriktirilgan edi.
 */
describe('Buyurtma zanjiri — bekor/qabul poygalari', () => {
  describe('1. bekor qilish va qabul bir lahzada', () => {
    function buildCancel(fresh: { status: OrderStatus; driverId: string | null }) {
      // Bekor qilish buyurtmani qidiruv paytida o'qiydi (driverId = null) ...
      const stale = { id: 'ride-1', status: OrderStatus.SEARCHING, driverId: null, passengerId: 'p-1' };
      // ... atomik yozuvdan keyingi o'qishda esa haydovchi allaqachon bor.
      const afterCancel = { ...stale, ...fresh, status: OrderStatus.CANCELLED };
      const realtime = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
      const notifications = { notifyOrderCancelled: jest.fn().mockResolvedValue(undefined) };
      const users = { findById: jest.fn(async (id: string) => ({ id })) };
      const drivers = { findByUserId: jest.fn(async (userId: string) => ({ id: `row-${userId}`, userId })) };
      const service = new OrdersDispatchService(
        {} as never,
        realtime as never,
        notifications as never,
        users as never,
        drivers as never,
        { findByIdOrThrow: jest.fn().mockResolvedValueOnce(stale).mockResolvedValue(afterCancel) } as never,
        { updateOrderStatusAtomic: jest.fn().mockResolvedValue(undefined) } as never,
        undefined,
        { cancelSearch: jest.fn().mockResolvedValue(undefined) } as never,
      );
      return { service, realtime, notifications, drivers };
    }

    it('shu orada qabul qilgan haydovchi order:cancelled va push oladi', async () => {
      const { service, realtime, notifications } = buildCancel({
        status: OrderStatus.ACCEPTED,
        driverId: 'driver-9',
      });

      await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1', 'changed my mind');

      expect(realtime.emitToUser).toHaveBeenCalledWith(
        'driver-9',
        'order:cancelled',
        expect.objectContaining({ orderId: 'ride-1' }),
      );
      expect(notifications.notifyOrderCancelled).toHaveBeenCalledWith(
        { id: 'driver-9' },
        expect.objectContaining({ id: 'ride-1' }),
        'changed my mind',
      );
    });

    it('dispetcher paneliga haydovchi yana bo‘sh deb ko‘rsatiladi', async () => {
      const { service, realtime } = buildCancel({ status: OrderStatus.ACCEPTED, driverId: 'driver-9' });

      await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1');

      expect(realtime.emitToManagers).toHaveBeenCalledWith('driver:status_changed', {
        driverId: 'row-driver-9',
        status: 'online',
      });
    });

    it('hech kim qabul qilmagan bo‘lsa — hech qaysi haydovchiga yuborilmaydi', async () => {
      const { service, realtime } = buildCancel({ status: OrderStatus.SEARCHING, driverId: null });

      await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1');

      const driverEmits = realtime.emitToUser.mock.calls.filter(([userId]) => userId !== 'p-1');
      expect(driverEmits).toEqual([]);
    });
  });

  describe('2. qabul yozilgandan keyingi xatolar haydovchiga 500 bermaydi', () => {
    const order = { id: 'ride-1', status: OrderStatus.SEARCHING, driverId: null, passengerId: 'p-1' };
    const accepted = { ...order, status: OrderStatus.ACCEPTED, driverId: 'driver-a' };

    function buildAccept(overrides: { notifyOrderAccepted?: jest.Mock; publish?: jest.Mock }) {
      const acceptForDriver = jest.fn().mockResolvedValue(undefined);
      const service = new OrdersLifecycleService(
        {} as never,
        {} as never,
        { emitToUser: jest.fn(), emitToManagers: jest.fn() } as never,
        { notifyOrderAccepted: overrides.notifyOrderAccepted ?? jest.fn() } as never,
        { findById: jest.fn().mockResolvedValue({ id: 'p-1' }) } as never,
        { findByUserId: jest.fn().mockResolvedValue({ id: 'row-a', userId: 'driver-a' }) } as never,
        { findByIdOrThrow: jest.fn().mockResolvedValueOnce(order).mockResolvedValue(accepted) } as never,
        { acceptForDriver } as never,
        { publish: overrides.publish ?? jest.fn() } as never,
        undefined,
        undefined,
        { isOfferedTo: jest.fn().mockResolvedValue(true) } as never,
      );
      return { service, acceptForDriver };
    }

    it('push xatosi — qabul baribir muvaffaqiyatli qaytadi', async () => {
      const { service, acceptForDriver } = buildAccept({
        notifyOrderAccepted: jest.fn().mockRejectedValue(new Error('FCM down')),
      });

      await expect(service.acceptOrder('driver-a', 'ride-1')).resolves.toEqual(accepted);
      expect(acceptForDriver).toHaveBeenCalledWith('ride-1', 'driver-a');
    });

    it('delivery event xatosi — qabul baribir muvaffaqiyatli qaytadi', async () => {
      const { service } = buildAccept({ publish: jest.fn().mockRejectedValue(new Error('bus down')) });

      await expect(service.acceptOrder('driver-a', 'ride-1')).resolves.toEqual(accepted);
    });
  });
});
