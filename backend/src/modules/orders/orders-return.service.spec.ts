import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeliveryFailureReason, Order, OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { DEFAULT_DELIVERY_INCIDENT_SETTINGS } from '../settings/delivery-incident-settings';
import { AUDIT_ACTIONS } from '../audit/audit-log.service';
import { OrdersReturnService } from './orders-return.service';
import { stuckReasonsOf } from './stuck-deliveries';

const RIDE = 'ride-1';
const COURIER = 'courier-1';
const CUSTOMER = 'customer-1';
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

function build(order: Partial<Order> = {}, distanceMeters = 50) {
  let current = {
    id: RIDE,
    status: OrderStatus.IN_PROGRESS,
    serviceType: ServiceType.FOOD,
    driverId: COURIER,
    passengerId: CUSTOMER,
    dropoffArrivedAt: null,
    deliveryFailedAt: null,
    details: { foodOrderId: 'food-1' },
    tariff: { freeWaitMinutes: 3, waitingPricePerMinute: 500 },
    ...order,
  } as unknown as Order;
  const execute = jest.fn(async () => {
    current = { ...current, dropoffArrivedAt: current.dropoffArrivedAt ?? new Date() };
    return { affected: 1 };
  });
  const qb = { update: () => qb, set: () => qb, where: () => qb, andWhere: () => qb, setParameters: () => qb, execute };
  const orderRepository = {
    createQueryBuilder: jest.fn(() => qb),
    query: jest.fn(async (): Promise<unknown[]> => [{ distance_meters: distanceMeters }]),
    update: jest.fn(async (_where: unknown, data: Partial<Order>) => {
      current = { ...current, ...data };
      return { affected: 1 };
    }),
  };
  const completeTrip = jest.fn(async () => ({ ...current, status: OrderStatus.COMPLETED, finalPrice: 12000 }));
  const record = jest.fn();
  const publish = jest.fn();
  const emitToUser = jest.fn();
  const notifyUserIds = jest.fn();
  const service = new OrdersReturnService(
    orderRepository as never,
    { findByIdOrThrow: jest.fn(async () => current) } as never,
    { completeTrip } as never,
    { getDeliveryIncidentSettings: jest.fn(async () => DEFAULT_DELIVERY_INCIDENT_SETTINGS) } as never,
    { emitToUser, emitToManagers: jest.fn() } as never,
    { notifyUserIds } as never,
    { publish } as never,
    { record } as never,
  );
  return { service, orderRepository, completeTrip, record, publish, emitToUser, notifyUserIds };
}

describe('OrdersReturnService', () => {
  describe('markDropoffArrived', () => {
    it('manzil yaqinida — yoziladi, mijozga realtime + push', async () => {
      const { service, emitToUser, publish, notifyUserIds } = build();
      const result = await service.markDropoffArrived(COURIER, RIDE);
      expect(result.dropoffArrivedAt).toBeInstanceOf(Date);
      expect(emitToUser).toHaveBeenCalledWith(
        CUSTOMER,
        'order:dropoff_arrived',
        expect.objectContaining({ freeWaitMinutes: 5, waitingPricePerMinute: 500 }),
      );
      expect(publish).toHaveBeenCalledWith(expect.anything(), 'dropoff_arrived');
      expect(notifyUserIds).toHaveBeenCalledWith([CUSTOMER], expect.any(Function), 'courier_at_door', { orderId: RIDE });
    });

    it('uzoqda — rad (kutish haqini erta boshlab bo\'lmaydi)', async () => {
      const { service } = build({}, 1200);
      await expect(service.markDropoffArrived(COURIER, RIDE)).rejects.toThrow(/500 m/);
    });

    it('boshqa kuryer — 403', async () => {
      const { service } = build();
      await expect(service.markDropoffArrived('other', RIDE)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markDeliveryFailed', () => {
    it('kuryer: bepul kutish tugagach — qaytarish yo\'li', async () => {
      const { service, orderRepository, publish } = build({ dropoffArrivedAt: minutesAgo(6) });
      const result = await service.markDeliveryFailed({ userId: COURIER, byManager: false }, RIDE, 'customer_absent');
      expect(result.deliveryFailedAt).toBeInstanceOf(Date);
      expect(result.deliveryFailureReason).toBe(DeliveryFailureReason.CUSTOMER_ABSENT);
      expect(orderRepository.update.mock.calls[0][0]).toMatchObject({ id: RIDE, status: OrderStatus.IN_PROGRESS });
      expect(publish).toHaveBeenCalledWith(expect.anything(), 'delivery_failed', { failureReason: 'customer_absent' });
    });

    it('kuryer: kutish tugamagan — rad', async () => {
      const { service } = build({ dropoffArrivedAt: minutesAgo(2) });
      await expect(
        service.markDeliveryFailed({ userId: COURIER, byManager: false }, RIDE, 'customer_absent'),
      ).rejects.toThrow(/kuting/);
    });

    it("noto'g'ri sabab — rad", async () => {
      const { service } = build({ dropoffArrivedAt: minutesAgo(9) });
      await expect(service.markDeliveryFailed({ userId: COURIER, byManager: false }, RIDE, 'tired')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('dispetcher: izohsiz — rad; izoh bilan — audit', async () => {
      const { service, record } = build();
      await expect(
        service.markDeliveryFailed({ userId: 'mgr', byManager: true, note: ' ' }, RIDE, 'unreachable'),
      ).rejects.toThrow(/Izoh majburiy/);
      await service.markDeliveryFailed({ userId: 'mgr', byManager: true, note: "Qo'ng'iroqqa javob yo'q" }, RIDE, 'unreachable');
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AUDIT_ACTIONS.deliveryMarkFailed, actorUserId: 'mgr', targetId: RIDE }),
      );
    });
  });

  describe('confirmReturned', () => {
    const failed = { deliveryFailedAt: minutesAgo(10) };

    it('sotuvchi tasdiqlaydi → returned bilan yakunlanadi', async () => {
      const { service, completeTrip } = build(failed);
      await service.confirmReturned(RIDE, { kind: 'vendor', userId: 'owner' });
      expect(completeTrip).toHaveBeenCalledWith(COURIER, RIDE, undefined, { byDispatcher: true, returned: true });
    });

    it('qaytarilmayotgan safar — rad', async () => {
      const { service, completeTrip } = build();
      await expect(service.confirmReturned(RIDE, { kind: 'vendor', userId: 'owner' })).rejects.toThrow(/qaytarilmayapti/);
      expect(completeTrip).not.toHaveBeenCalled();
    });

    it('posilka: faqat yuboruvchi', async () => {
      const parcel = { ...failed, serviceType: ServiceType.PARCEL, details: {} };
      await expect(build(parcel).service.confirmReturned(RIDE, { kind: 'sender', userId: 'stranger' })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(build(parcel).service.confirmReturned(RIDE, { kind: 'sender', userId: CUSTOMER })).resolves.toBeDefined();
      // Ovqat safarini "yuboruvchi" sifatida tasdiqlab bo'lmaydi.
      await expect(build(failed).service.confirmReturned(RIDE, { kind: 'sender', userId: CUSTOMER })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('dispetcher — izoh majburiy, audit', async () => {
      const { service, record } = build(failed);
      await expect(service.confirmReturned(RIDE, { kind: 'manager', userId: 'mgr', note: '' })).rejects.toThrow(/Izoh/);
      await service.confirmReturned(RIDE, { kind: 'manager', userId: 'mgr', note: 'Sotuvchi tasdiqladi' });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AUDIT_ACTIONS.deliveryConfirmReturned, note: 'Sotuvchi tasdiqladi' }),
      );
    });
  });

  describe('osilib qolgan yetkazish', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    const row = (over: Record<string, unknown>) =>
      ({
        id: 'r', status: 'in_progress', service_type: 'food', driver_id: 'c', driver_first_name: 'Ali',
        driver_last_name: null, driver_phone: '+998', pickup_address: null, dropoff_address: null,
        delivery_failed_at: null, start_time: new Date(now.getTime() - 30 * 60_000),
        location_updated_at: new Date(now.getTime() - 60_000), ...over,
      }) as never;

    it('sabablar: uzoq va eski joylashuv', () => {
      const s = DEFAULT_DELIVERY_INCIDENT_SETTINGS;
      expect(stuckReasonsOf(row({}), now, s)).toEqual([]);
      expect(stuckReasonsOf(row({ start_time: new Date(now.getTime() - 61 * 60_000) }), now, s)).toEqual(['too_long']);
      expect(stuckReasonsOf(row({ location_updated_at: new Date(now.getTime() - 11 * 60_000) }), now, s)).toEqual([
        'stale_location',
      ]);
      expect(stuckReasonsOf(row({ location_updated_at: null }), now, s)).toEqual(['stale_location']);
      // ACCEPTED da "uzoq" sanalmaydi (safar hali boshlanmagan).
      expect(stuckReasonsOf(row({ status: 'accepted', start_time: null }), now, s)).toEqual([]);
    });

    it('cron — bir marta belgilaydi va dispetcherga yuboradi', async () => {
      const { service, orderRepository } = build();
      orderRepository.query.mockResolvedValueOnce([
        { ...(row({ location_updated_at: null }) as object), start_time: new Date() },
      ]);
      const managers = (service as unknown as { realtimeGateway: { emitToManagers: jest.Mock } }).realtimeGateway;
      await expect(service.flagStuckDeliveries()).resolves.toBe(1);
      expect(managers.emitToManagers).toHaveBeenCalledWith('delivery:stuck', expect.objectContaining({ reasons: ['stale_location'] }));
    });
  });
});
