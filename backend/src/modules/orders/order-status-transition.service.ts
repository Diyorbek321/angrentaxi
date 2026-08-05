// The single conditional-write primitive every order state transition goes
// through. Extracted into its own provider because both the driver-facing
// lifecycle service (accept/arrived/start) and the dispatcher service
// (reassign/cancel) need it, and neither should own the other.
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
   */
  async updateOrderStatusAtomic(
    orderId: string,
    expectedStatus: OrderStatus | OrderStatus[],
    updateData: QueryDeepPartialEntity<Order>,
  ): Promise<void> {
    const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

    const result = await this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set(updateData)
      .where('id = :id', { id: orderId })
      .andWhere('status IN (:...expectedStatuses)', { expectedStatuses })
      .execute();

    if (!result.affected) {
      throw new ConflictException('Order is no longer in the expected state');
    }
  }
}
