// The single conditional-write primitive every order state transition goes
// through. Extracted into its own provider because both the driver-facing
// lifecycle service (accept/arrived/start) and the dispatcher service
// (reassign/cancel) need it, and neither should own the other.
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Order, OrderStatus } from '../../database/entities/order.entity';

@Injectable()
export class OrderStatusTransitionService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Atomically applies a status transition, guarding the write with a
   * `WHERE id = :id AND status IN (:...expectedStatuses)` clause so the
   * update only lands if the order is still in a state the caller already
   * validated. This closes the TOCTOU race where two concurrent requests
   * (e.g. two drivers accepting the same order) both pass the in-app status
   * check before either write lands — only the first conditional update
   * affects a row; the second affects zero rows and must be rejected rather
   * than silently overwriting the first.
   *
   * Throws ConflictException if no row matched (order was already moved to
   * a different status by a concurrent request).
   *
   * [parameters] binds named placeholders used inside a raw SQL expression
   * passed in `updateData` (TypeORM lets a value be `() => 'SQL'`). It exists
   * for writes that must read the row's CURRENT value to decide the new one —
   * `arrived_at = COALESCE("arrived_at", :arrivedAt)` in
   * `OrdersLifecycleService.driverArrived`, which must never overwrite an
   * already-recorded arrival because the waiting charge is measured from it.
   *
   * ⚠️ The value is still bound as a parameter rather than inlined, so the
   * pg driver serialises the JS `Date` exactly the way it serialises every
   * other timestamp this app writes (`trips.start_time`, `completed_at`).
   * A SQL-side `NOW()` would be read back against a different clock when the
   * database and the Node process disagree on the timezone, and the waiting
   * minutes are the difference between those two timestamps.
   */
  async updateOrderStatusAtomic(
    orderId: string,
    expectedStatus: OrderStatus | OrderStatus[],
    updateData: QueryDeepPartialEntity<Order>,
    parameters?: ObjectLiteral,
  ): Promise<void> {
    const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

    const query = this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set(updateData)
      .where('id = :id', { id: orderId })
      .andWhere('status IN (:...expectedStatuses)', { expectedStatuses });

    if (parameters) {
      query.setParameters(parameters);
    }

    const result = await query.execute();

    if (!result.affected) {
      throw new ConflictException('Order is no longer in the expected state');
    }
  }
}
