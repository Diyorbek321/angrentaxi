import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';
import { OrdersDispatchService } from './orders-dispatch.service';

/**
 * Qidiruv paytidagi bekor qilish va qo'lda biriktirish matching navbatini
 * yopadi: taklifni ko'rib turgan haydovchi (order.driverId hali null!)
 * ekranidan taklif olinadi. Qo'lda biriktirishda yangi haydovchi bo'sh
 * bo'lishi shart.
 */
describe('OrdersDispatchService — matching navbati bilan muvofiqlik', () => {
  function build(status: OrderStatus, opts: { activeOrdersOfNewDriver?: number } = {}) {
    const order = { id: 'ride-1', status, driverId: null, passengerId: 'p-1' };
    const updated = { ...order, status: OrderStatus.CANCELLED };
    const manager = {
      query: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(opts.activeOrdersOfNewDriver ?? 0),
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
    const matching = { cancelSearch: jest.fn().mockResolvedValue(undefined) };
    const statusTransition = { updateOrderStatusAtomic: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdersDispatchService(
      { manager: { transaction: async (cb: (m: unknown) => unknown) => cb(manager) } } as never,
      { emitToUser: jest.fn(), emitToManagers: jest.fn() } as never,
      { notifyOrderAccepted: jest.fn(), notifyOrderCancelled: jest.fn() } as never,
      { findById: jest.fn(async () => null) } as never,
      {
        findByIdOrThrow: jest.fn(async () => ({ id: 'dp-2', userId: 'driver-2', isOnline: true })),
        findByUserId: jest.fn(async () => null),
      } as never,
      { findByIdOrThrow: jest.fn().mockResolvedValueOnce(order).mockResolvedValue(updated) } as never,
      statusTransition as never,
      undefined,
      matching as never,
    );
    return { service, matching, manager };
  }

  it.each([OrderStatus.CREATED, OrderStatus.SEARCHING])(
    '%s buyurtmani yo‘lovchi bekor qilsa — matching navbati yopiladi (taklif egasiga xabar)',
    async (status) => {
      const { service, matching } = build(status);

      await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1', 'changed my mind');

      expect(matching.cancelSearch).toHaveBeenCalledWith('ride-1', 'changed my mind');
    },
  );

  it('ACCEPTED buyurtmada matching navbatiga tegilmaydi', async () => {
    const { service, matching } = build(OrderStatus.ACCEPTED);

    await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1');

    expect(matching.cancelSearch).not.toHaveBeenCalled();
  });

  it('qo‘lda biriktirish: yangi haydovchida faol buyurtma bo‘lsa — 409', async () => {
    const { service } = build(OrderStatus.SEARCHING, { activeOrdersOfNewDriver: 1 });

    await expect(service.reassignDriver('ride-1', 'dp-2', 'manager-1', 'test')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('qidiruvdagi buyurtmani qo‘lda biriktirish taklifni yopadi, yangi haydovchiga "bekor" yubormaydi', async () => {
    const { service, matching } = build(OrderStatus.SEARCHING);

    await service.reassignDriver('ride-1', 'dp-2', 'manager-1', 'test');

    expect(matching.cancelSearch).toHaveBeenCalledWith('ride-1', 'Assigned by dispatcher', 'driver-2');
  });
});
