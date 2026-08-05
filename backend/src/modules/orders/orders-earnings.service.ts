// Driver-facing earnings aggregates (GET /orders/earnings/*): today's gross
// revenue, and the today / last-7-days / last-30-days gross-commission-net
// breakdown. Read-only analytics over the orders + transactions ledger — it
// never computes commission itself, only sums what completion already booked.
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { DriverEarningsBreakdown, DriverEarningsPeriod } from './orders.types';

@Injectable()
export class OrdersEarningsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getDriverEarningsToday(driverId: string): Promise<{ today: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const revenueResult = await this.orderRepository
      .createQueryBuilder('o')
      .select('SUM(o.final_price)', 'total')
      .where('o.driver_id = :driverId', { driverId })
      .andWhere('o.status = :s', { s: 'completed' })
      .andWhere('o.created_at >= :d', { d: today })
      .getRawOne<{ total: string }>();

    return { today: parseFloat(revenueResult?.total ?? '0') || 0 };
  }

  async getDriverEarningsBreakdown(driverId: string): Promise<DriverEarningsBreakdown> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // "This week" = last 7 days including today; "this month" = last 30 days
    // including today (rolling windows, not calendar week/month).
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const startOfMonth = new Date(startOfToday);
    startOfMonth.setDate(startOfMonth.getDate() - 29);

    const [today, week, month] = await Promise.all([
      this.getDriverEarningsForPeriod(driverId, startOfToday),
      this.getDriverEarningsForPeriod(driverId, startOfWeek),
      this.getDriverEarningsForPeriod(driverId, startOfMonth),
    ]);

    return { today, week, month };
  }

  private async getDriverEarningsForPeriod(
    driverId: string,
    from: Date,
  ): Promise<DriverEarningsPeriod> {
    // Commission per trip is already computed and persisted as a DEBIT
    // transaction at completion time (see completeTrip), so sum that ledger
    // entry directly rather than recomputing from the driver's current
    // commission rate (which may have changed since the trip happened).
    const result = await this.orderRepository
      .createQueryBuilder('o')
      .leftJoin(
        Transaction,
        't',
        't.order_id = o.id AND t.user_id = o.driver_id AND t.external_id = :commissionExternalId',
        { commissionExternalId: 'commission' },
      )
      .select('COALESCE(SUM(COALESCE(o.final_price, o.estimated_price)), 0)', 'gross')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'commission')
      .addSelect('COUNT(DISTINCT o.id)', 'trips')
      .where('o.driver_id = :driverId', { driverId })
      .andWhere('o.status = :s', { s: OrderStatus.COMPLETED })
      .andWhere('o.created_at >= :from', { from })
      .getRawOne<{ gross: string; commission: string; trips: string }>();

    const gross = parseFloat(result?.gross ?? '0') || 0;
    const commission = parseFloat(result?.commission ?? '0') || 0;
    const trips = parseInt(result?.trips ?? '0', 10) || 0;

    return { gross, commission, net: gross - commission, trips };
  }
}
