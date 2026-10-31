import { ConflictException } from '@nestjs/common';
import { OrderStatusTransitionService } from './order-status-transition.service';
import { Order, OrderStatus } from '../../database/entities/order.entity';

/**
 * A driver holds at most one live ride. Before this guard the accept endpoint
 * only checked the ORDER's state, so a driver already on a trip could accept
 * a second (and third) order — reproduced against the running backend, where
 * one driver ended up with three ACCEPTED orders at once.
 */
describe('OrderStatusTransitionService.acceptForDriver', () => {
  let calls: string[];
  let activeCount: number;
  let affected: number;
  let queryBuilder: Record<string, jest.Mock>;
  let service: OrderStatusTransitionService;

  beforeEach(() => {
    calls = [];
    activeCount = 0;
    affected = 1;
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => {
        calls.push('update');
        return { affected };
      }),
    };
    const manager = {
      query: jest.fn(async (sql: string) => {
        calls.push(sql.includes('pg_advisory_xact_lock') ? 'lock' : sql);
        return [];
      }),
      count: jest.fn(async () => {
        calls.push('count');
        return activeCount;
      }),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    const orderRepository = {
      manager: { transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) },
    };
    service = new OrderStatusTransitionService(orderRepository as never);
  });

  it('refuses a driver who already has an active order, without touching the order', async () => {
    activeCount = 1;

    await expect(service.acceptForDriver('order-2', 'driver-1')).rejects.toBeInstanceOf(ConflictException);
    expect(calls).not.toContain('update');
  });

  it('locks on the driver BEFORE checking, so two simultaneous accepts cannot both pass', async () => {
    await service.acceptForDriver('order-1', 'driver-1');

    expect(calls).toEqual(['lock', 'count', 'update']);
  });

  it('assigns the driver when they are free and the order is still searching', async () => {
    await service.acceptForDriver('order-1', 'driver-1');

    expect(queryBuilder.update).toHaveBeenCalledWith(Order);
    expect(queryBuilder.set).toHaveBeenCalledWith({ driverId: 'driver-1', status: OrderStatus.ACCEPTED });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('status IN (:...expectedStatuses)', {
      expectedStatuses: [OrderStatus.SEARCHING],
    });
  });

  it('still rejects the loser when another driver took the order first', async () => {
    affected = 0;

    await expect(service.acceptForDriver('order-1', 'driver-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
