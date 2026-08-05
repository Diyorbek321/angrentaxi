// Platform-wide analytics for the admin/manager panels: the live dashboard
// tile counters and the date-ranged reports page (revenue chart, top drivers,
// user growth). Purely aggregate reads — no order state is ever touched here.
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { DriversService } from '../drivers/drivers.service';

// Server-side ceiling on the reports date range. Every query in getReports scans
// `orders` across [from, to] — including a per-day GROUP BY for the revenue chart
// and a three-table JOIN for the top-drivers list — so an unbounded range lets any
// manager turn one request into a full-table scan. A year covers the widest preset
// the admin panel offers; anything larger belongs in an offline export.
export const MAX_REPORT_RANGE_DAYS = 366;

// Top-drivers list size. Kept as a named constant so the SQL LIMIT and the
// documented contract stay in step.
const TOP_DRIVERS_LIMIT = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class OrdersStatsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly driversService: DriversService,
  ) {}

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      ordersToday,
      completedToday,
      totalUsers,
      activeDrivers,
      onlineDrivers,
      pendingDriverApprovals,
    ] = await Promise.all([
      this.orderRepository.count(),
      // Was comparing createdAt to exact midnight (an equality match that never
      // hits a real timestamp) — always returned 0. Needs a >= range instead.
      this.orderRepository
        .createQueryBuilder('o')
        .where('o.created_at >= :d', { d: today })
        .getCount(),
      this.orderRepository.createQueryBuilder('o')
        .where('o.status = :s', { s: 'completed' })
        .andWhere('o.created_at >= :d', { d: today })
        .getCount(),
      this.orderRepository.manager.getRepository('users').count(),
      this.driversService.countAll(),
      this.driversService.countOnline(),
      this.driversService.countPending(),
    ]);

    const revenueResult = await this.orderRepository.createQueryBuilder('o')
      .select('SUM(o.final_price)', 'total')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.created_at >= :d', { d: today })
      .getRawOne<{ total: string }>();

    const avgPriceResult = await this.orderRepository.createQueryBuilder('o')
      .select('AVG(o.final_price)', 'avg')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.created_at >= :d', { d: today })
      .getRawOne<{ avg: string }>();

    const cancelledToday = await this.orderRepository.createQueryBuilder('o')
      .where('o.status = :s', { s: 'cancelled' })
      .andWhere('o.created_at >= :d', { d: today })
      .getCount();

    const newCustomersToday = await this.orderRepository.manager
      .getRepository('users')
      .createQueryBuilder('u')
      .where('u.role = :r', { r: 'passenger' })
      .andWhere('u.created_at >= :d', { d: today })
      .getCount();

    return {
      totalUsers,
      totalOrders,
      ordersToday,
      completedToday,
      revenueToday: parseFloat(revenueResult?.total ?? '0') || 0,
      avgTripPriceToday: Math.round(parseFloat(avgPriceResult?.avg ?? '0') || 0),
      cancellationRateToday: ordersToday > 0 ? Math.round((cancelledToday / ordersToday) * 1000) / 10 : 0,
      newCustomersToday,
      activeDrivers,
      onlineDrivers,
      pendingDriverApprovals,
    };
  }

  /**
   * Date-ranged reports for the admin/manager panels.
   *
   * The range is validated here rather than left to the caller: `from`/`to`
   * arrive as raw query strings, and an unparseable or inverted pair used to
   * degrade silently (an Invalid Date compares false against everything, so
   * every aggregate came back as zero) while an over-wide one scanned the whole
   * orders table. Both now fail loudly with a 400.
   */
  async getReports(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException(
        'Invalid report range: "from" and "to" must be valid dates (YYYY-MM-DD)',
      );
    }

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    if (toDate.getTime() < fromDate.getTime()) {
      throw new BadRequestException('Invalid report range: "to" must not be earlier than "from"');
    }

    const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
    if (rangeDays > MAX_REPORT_RANGE_DAYS) {
      throw new BadRequestException(
        `Report range is limited to ${MAX_REPORT_RANGE_DAYS} days (requested ${rangeDays})`,
      );
    }

    const [
      totalOrdersInRange,
      statsResult,
      chartResult,
      topDriversResult,
      totalDriversResult,
      activeDriversResult,
      newUsersResult,
    ] = await Promise.all([
        this.orderRepository
          .createQueryBuilder('o')
          .where('o.created_at >= :from', { from: fromDate })
          .andWhere('o.created_at <= :to', { to: toDate })
          .getCount(),
        this.orderRepository
          .createQueryBuilder('o')
          .select('SUM(o.final_price)', 'revenue')
          .addSelect('COUNT(o.id)', 'cnt')
          .where('o.status = :s', { s: 'completed' })
          .andWhere('o.created_at >= :from', { from: fromDate })
          .andWhere('o.created_at <= :to', { to: toDate })
          .getRawOne<{ revenue: string; cnt: string }>(),
        this.orderRepository
          .createQueryBuilder('o')
          .select('DATE(o.created_at)', 'date')
          .addSelect('SUM(o.final_price)', 'revenue')
          .addSelect('COUNT(o.id)', 'orders')
          .where('o.status = :s', { s: 'completed' })
          .andWhere('o.created_at >= :from', { from: fromDate })
          .andWhere('o.created_at <= :to', { to: toDate })
          .groupBy('date')
          .orderBy('date', 'ASC')
          .getRawMany<{ date: string; revenue: string; orders: string }>(),
        this.orderRepository.manager.query(
          `SELECT d.id, u.first_name, u.last_name, u.phone,
                  COUNT(o.id)::int as total_trips,
                  COALESCE(SUM(o.final_price), 0)::float as total_revenue,
                  d.rating
           FROM orders o
           JOIN users u ON u.id = o.driver_id
           JOIN drivers d ON d.user_id = o.driver_id
           WHERE o.status = 'completed'
             AND o.created_at >= $1 AND o.created_at <= $2
           GROUP BY d.id, u.first_name, u.last_name, u.phone, d.rating
           ORDER BY total_revenue DESC
           LIMIT ${TOP_DRIVERS_LIMIT}`,
          [fromDate, toDate],
        ) as Promise<Array<{ id: string; first_name: string; last_name: string; phone: string; total_trips: number; total_revenue: number; rating: number }>>,
        this.orderRepository.manager.query(
          `SELECT COUNT(*)::int as cnt FROM drivers`,
        ) as Promise<Array<{ cnt: number }>>,
        // "Active" = actually drove in the reported range, i.e. distinct
        // drivers with at least one completed order. This used to report the
        // completed-order count instead, which is a different quantity
        // entirely and read far too high whenever drivers took several trips.
        this.orderRepository.manager.query(
          `SELECT COUNT(DISTINCT o.driver_id)::int as cnt
             FROM orders o
            WHERE o.status = 'completed'
              AND o.driver_id IS NOT NULL
              AND o.created_at >= $1 AND o.created_at <= $2`,
          [fromDate, toDate],
        ) as Promise<Array<{ cnt: number }>>,
        this.orderRepository.manager.query(
          `SELECT COUNT(*)::int as cnt FROM users WHERE created_at >= $1 AND created_at <= $2`,
          [fromDate, toDate],
        ) as Promise<Array<{ cnt: number }>>,
      ]);

    const totalRevenue = parseFloat(statsResult?.revenue ?? '0') || 0;
    const completedOrders = parseInt(statsResult?.cnt ?? '0', 10) || 0;

    return {
      stats: {
        totalRevenue,
        totalOrders: totalOrdersInRange,
        avgOrderValue: completedOrders > 0 ? totalRevenue / completedOrders : 0,
        totalDrivers: totalDriversResult[0]?.cnt ?? 0,
        activeDrivers: activeDriversResult[0]?.cnt ?? 0,
        newUsers: newUsersResult[0]?.cnt ?? 0,
      },
      revenueChart: chartResult.map((row) => ({
        date: row.date,
        revenue: parseFloat(row.revenue ?? '0') || 0,
        orders: parseInt(row.orders ?? '0', 10) || 0,
      })),
      topDrivers: topDriversResult.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        totalTrips: row.total_trips,
        totalRevenue: row.total_revenue,
        rating: parseFloat(String(row.rating)) || 0,
      })),
    };
  }
}
