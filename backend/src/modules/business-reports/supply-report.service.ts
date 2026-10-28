import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NO_DRIVERS_CANCEL_REASON } from '../matching/matching.constants';
import { DriverBrief, ShortageHour, SupplySnapshot } from './supply-report.types';
import { ReportPeriod } from './report-period';

/** `orders.driver_id` — haydovchining `users.id` si (drivers.id EMAS). */
/** Davr chegarasi — `timestamp` ustunlarda Toshkent mahalliy vaqti (finance-report.service.ts). */
const LOCAL = (col: string) => `${col} >= $1::timestamp AND ${col} < $2::timestamp`;

/** Yo'lovchi safarlari; ovqat/market kuryer bosqichlari kirmaydi. */
const RIDE_SERVICE_TYPES = `('taxi', 'cargo', 'parcel', 'intercity')`;

/** Shuncha kun safar qilmasa — "ketib qolayotgan". */
const CHURN_AFTER_DAYS = 7;
/** Bundan oldin ishlagan haydovchi allaqachon ketgan — ro'yxatga kirmaydi. */
const CHURN_LOOKBACK_DAYS = 60;
const CHURN_LIST_LIMIT = 20;
const TOP_LIMIT = 5;
const SHORTAGE_HOURS_LIMIT = 3;

/** "Ali V." — familiyadan faqat bosh harf. */
const DRIVER_NAME = `COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' ||
  COALESCE(LEFT(u.last_name, 1) || '.', '')), ''), 'Ismsiz')`;

type Row = Record<string, number | string | null>;

@Injectable()
export class SupplyReportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async snapshot(period: ReportPeriod): Promise<SupplySnapshot> {
    const params = [period.from, period.to];
    const [drivers, activity, demand, hours, queue, churning, top] = await Promise.all([
      this.one(
        `SELECT
           (COUNT(*) FILTER (WHERE u.status = 'active'))::int AS approved,
           (COUNT(*) FILTER (WHERE u.status = 'pending'))::int AS pending_approval,
           (COUNT(*) FILTER (WHERE u.status = 'blocked'))::int AS blocked,
           (COUNT(*) FILTER (WHERE u.status = 'active' AND d.is_online))::int AS online_now,
           (COUNT(*) FILTER (WHERE u.status = 'active' AND d.balance < 0))::int AS negative_balance,
           (SELECT COUNT(*)::int FROM users WHERE role = 'driver' AND ${LOCAL('created_at')}) AS new_registrations
         FROM drivers d JOIN users u ON u.id = d.user_id`,
        params,
      ),
      this.one(
        `SELECT COUNT(DISTINCT driver_id)::int AS active_drivers, COUNT(*)::int AS completed_rides
           FROM orders
          WHERE status = 'completed' AND service_type IN ${RIDE_SERVICE_TYPES} AND ${LOCAL('completed_at')}`,
        params,
      ),
      // Buyurtmalar yaratilgan kuni bo'yicha (kogorta): bajarilish = shu
      // buyurtmalarning qanchasi tugatildi.
      this.one(
        `SELECT
           COUNT(*)::int AS orders,
           (COUNT(*) FILTER (WHERE status = 'completed'))::int AS completed,
           (COUNT(*) FILTER (WHERE status = 'cancelled' AND cancel_reason = $3))::int AS no_driver,
           (COUNT(*) FILTER (WHERE status = 'cancelled' AND driver_id IS NULL
                               AND cancel_reason IS DISTINCT FROM $3))::int AS gave_up
         FROM orders
         WHERE service_type IN ${RIDE_SERVICE_TYPES} AND status <> 'scheduled' AND ${LOCAL('created_at')}`,
        [...params, NO_DRIVERS_CANCEL_REASON],
      ),
      this.dataSource.query(
        `SELECT EXTRACT(HOUR FROM created_at)::int AS hour,
                COUNT(*)::int AS orders,
                (COUNT(*) FILTER (WHERE status = 'cancelled' AND driver_id IS NULL))::int AS unmet
           FROM orders
          WHERE service_type IN ${RIDE_SERVICE_TYPES} AND status <> 'scheduled' AND ${LOCAL('created_at')}
          GROUP BY 1
         HAVING COUNT(*) FILTER (WHERE status = 'cancelled' AND driver_id IS NULL) > 0
          ORDER BY unmet DESC, orders DESC
          LIMIT ${SHORTAGE_HOURS_LIMIT}`,
        params,
      ) as Promise<ShortageHour[]>,
      this.one(
        `SELECT COUNT(*)::int AS kyc_pending,
                FLOOR(EXTRACT(EPOCH FROM now() - MIN(submitted_at)) / 3600)::int AS kyc_oldest_hours
           FROM driver_verification_submissions
          WHERE review_status = 'pending'`,
        [],
      ),
      // Davr oxiriga nisbatan: 7+ kun ishlamagan, lekin 60 kun ichida ishlagan.
      this.dataSource.query(
        `SELECT d.id AS "driverId", ${DRIVER_NAME} AS name, u.phone,
                ($1::date - MAX(o.completed_at)::date)::int AS "daysSinceLastRide",
                COUNT(*)::int AS rides
           FROM orders o
           JOIN users u ON u.id = o.driver_id
           JOIN drivers d ON d.user_id = u.id
          WHERE o.status = 'completed' AND u.status = 'active'
            AND o.completed_at < $1::timestamp
            AND o.completed_at >= $1::timestamp - INTERVAL '${CHURN_LOOKBACK_DAYS} days'
          GROUP BY d.id, u.id
         HAVING MAX(o.completed_at) < $1::timestamp - INTERVAL '${CHURN_AFTER_DAYS} days'
          ORDER BY rides DESC
          LIMIT ${CHURN_LIST_LIMIT}`,
        [period.to],
      ) as Promise<DriverBrief[]>,
      this.dataSource.query(
        `SELECT d.id AS "driverId", ${DRIVER_NAME} AS name, u.phone,
                ($2::date - MAX(o.completed_at)::date - 1)::int AS "daysSinceLastRide",
                COUNT(*)::int AS rides
           FROM orders o
           JOIN users u ON u.id = o.driver_id
           JOIN drivers d ON d.user_id = u.id
          WHERE o.status = 'completed' AND o.service_type IN ${RIDE_SERVICE_TYPES}
            AND ${LOCAL('o.completed_at')}
          GROUP BY d.id, u.id
          ORDER BY rides DESC
          LIMIT ${TOP_LIMIT}`,
        params,
      ) as Promise<DriverBrief[]>,
    ]);

    return {
      period,
      drivers: {
        approved: num(drivers.approved),
        pendingApproval: num(drivers.pending_approval),
        blocked: num(drivers.blocked),
        onlineNow: num(drivers.online_now),
        negativeBalance: num(drivers.negative_balance),
        newRegistrations: num(drivers.new_registrations),
      },
      activity: {
        activeDrivers: num(activity.active_drivers),
        completedRides: num(activity.completed_rides),
      },
      demand: {
        orders: num(demand.orders),
        completed: num(demand.completed),
        noDriverFound: num(demand.no_driver),
        passengerGaveUp: num(demand.gave_up),
        shortageHours: hours,
      },
      queue: {
        kycPending: num(queue.kyc_pending),
        kycOldestHours: queue.kyc_oldest_hours === null ? null : num(queue.kyc_oldest_hours),
      },
      churning,
      topDrivers: top,
    };
  }

  private async one(sql: string, params: string[]): Promise<Row> {
    const rows = (await this.dataSource.query(sql, params)) as Row[];
    return rows[0];
  }
}

const num = (value: number | string | null): number => Number(value ?? 0);
