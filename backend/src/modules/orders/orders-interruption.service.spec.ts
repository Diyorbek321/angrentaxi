import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';
import { OrdersInterruptionService } from './orders-interruption.service';

describe('OrdersInterruptionService (INCIDENT-POLICY §5)', () => {
  function build(orderOverrides: Record<string, unknown> = {}, trackRows: unknown[] = []) {
    const order = {
      id: 'o1',
      status: OrderStatus.IN_PROGRESS,
      serviceType: ServiceType.TAXI,
      intercityTripId: null,
      driverId: 'drv',
      passengerId: 'pax',
      isMetered: false,
      pickup: { lat: 41.0, lng: 70.0 },
      ...orderOverrides,
    };
    const orders = {
      query: jest.fn(async (sql: string) => (sql.includes('trip_track_points') ? trackRows : [])),
    };
    const completion = { completeTrip: jest.fn(async () => ({ ...order, status: OrderStatus.COMPLETED, finalPrice: 9000 })) };
    const drivers = { getLastLocationByUserId: jest.fn(async () => null) };
    const realtime = { emitToUser: jest.fn() };
    const audit = { record: jest.fn(async () => ({ id: 'a' })) };
    const signals = { onTripInterrupted: jest.fn(async () => undefined) };
    const service = new OrdersInterruptionService(
      orders as never,
      { findByIdOrThrow: jest.fn(async () => order) } as never,
      completion as never,
      drivers as never,
      realtime as never,
      audit as never,
      signals as never,
    );
    return { service, orders, completion, realtime, audit, signals, drivers };
  }

  it("haydovchi: shu nuqtagacha (to'g'ri chiziq) yakunlanadi, manzil yangilanadi, yo'lovchiga joy", async () => {
    const ctx = build();
    const result = await ctx.service.interrupt('o1', { id: 'drv', role: UserRole.DRIVER }, { reason: 'breakdown', lat: 41.01, lng: 70.0 });
    expect(ctx.completion.completeTrip).toHaveBeenCalledWith('drv', 'o1', undefined, {
      byDispatcher: false,
      interruption: { reason: 'breakdown', distanceKm: expect.closeTo(1.11, 1) },
    });
    expect(ctx.orders.query).toHaveBeenCalledWith(expect.stringContaining('dropoff_location'), ['o1', 70.0, 41.01]);
    expect(ctx.realtime.emitToUser).toHaveBeenCalledWith(
      'pax',
      'order:interrupted',
      expect.objectContaining({ resumeFrom: { lat: 41.01, lng: 70.0 }, finalPrice: 9000 }),
    );
    expect(result.resumeFrom).toEqual({ lat: 41.01, lng: 70.0 });
    expect(ctx.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'order.interrupted', targetId: 'o1' }));
    expect(ctx.signals.onTripInterrupted).not.toHaveBeenCalled();
  });

  it('avariya — xavfsizlik hodisasi; menejer uzsa haydovchiga ham xabar', async () => {
    const ctx = build({}, [{ lat: 41.02, lng: 70.0 }]);
    await ctx.service.interrupt('o1', { id: 'mgr', role: UserRole.MANAGER }, { reason: 'accident', note: 'urildi' });
    expect(ctx.signals.onTripInterrupted).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'o1', byRole: 'manager', note: 'urildi' }));
    expect(ctx.completion.completeTrip).toHaveBeenCalledWith('drv', 'o1', undefined, expect.objectContaining({ byDispatcher: true }));
    expect(ctx.realtime.emitToUser).toHaveBeenCalledWith('drv', 'order:interrupted', expect.anything());
  });

  it("taksometrda manzil yangilanmaydi (yakunlash o'zi qiladi); joy yo'q — 0 km", async () => {
    const ctx = build({ isMetered: true });
    await ctx.service.interrupt('o1', { id: 'drv', role: UserRole.DRIVER }, { reason: 'other' });
    expect(ctx.orders.query).not.toHaveBeenCalledWith(expect.stringContaining('dropoff_location'), expect.anything());
    expect(ctx.completion.completeTrip).toHaveBeenCalledWith('drv', 'o1', undefined, expect.objectContaining({
      interruption: { reason: 'other', distanceKm: 0 },
    }));
  });

  it("boshlanmagan safar, yetkazish, begona haydovchi — rad", async () => {
    await expect(build({ status: OrderStatus.ARRIVED }).service.interrupt('o1', { id: 'drv', role: UserRole.DRIVER }, { reason: 'other' })).rejects.toThrow(BadRequestException);
    await expect(build({ serviceType: ServiceType.FOOD }).service.interrupt('o1', { id: 'drv', role: UserRole.DRIVER }, { reason: 'other' })).rejects.toThrow(BadRequestException);
    await expect(build().service.interrupt('o1', { id: 'x', role: UserRole.DRIVER }, { reason: 'other' })).rejects.toThrow(ForbiddenException);
  });
});
