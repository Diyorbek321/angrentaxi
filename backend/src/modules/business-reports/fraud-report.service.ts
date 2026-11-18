import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FraudSnapshot, SuspiciousDriver, SuspiciousPair } from './fraud-report.types';
import { ReportPeriod } from './report-period';
import { LOCAL, LOCAL_NOW, PERSON_NAME, RIDE_SERVICE_TYPES } from './report-sql';

/** Haydovchi belgilanadi: shuncha qabuldan... */
const DRIVER_MIN_ACCEPTED = 5;
/** ...shuncha ulushi bekor bo'lsa, */
const DRIVER_CANCEL_RATE = 0.3;
/** yoki shuncha marta yetib kelgach bekor qilingan bo'lsa. */
const DRIVER_ARRIVED_CANCELS = 3;

/** Juftlik shuncha kun ichida... */
const PAIR_WINDOW_DAYS = 30;
/** ...shuncha marta qabul qilinib bekor bo'lsa — belgilanadi. */
const PAIR_MIN_CANCELS = 2;

/** "Yo'qolgan doimiy mijoz": oxirgi shuncha kun ilovada birga yurmagan, */
const LOST_SILENT_DAYS = 14;
/** undan oldingi shuncha kunda */
const LOST_HISTORY_DAYS = 30;
/** kamida shuncha marta birga yurgan. */
const LOST_MIN_TRIPS = 3;

const LIST_LIMIT = 20;

/** Juftlik so'rovlari: `p` — yo'lovchi, `d` — haydovchi (`users`). */
const PAIR_JOINS = `JOIN users p ON p.id = o.passenger_id JOIN users d ON d.id = o.driver_id`;
const PAIR_GROUP = `o.passenger_id, o.driver_id, p.id, d.id`;
const PAIR_COLUMNS = `o.passenger_id AS "passengerId", ${PERSON_NAME('p')} AS "passengerName", p.phone AS "passengerPhone",
                o.driver_id AS "driverUserId", ${PERSON_NAME('d')} AS "driverName", d.phone AS "driverPhone"`;

type Row = Record<string, number | string | null>;

/**
 * Antifrod surati (`fraud-report.types.ts`). Davrdagi bekor qilishlar
 * `created_at` bo'yicha; juftlik oynalari esa davr OXIRIGA (`$2`) nisbatan.
 *
 * ⚠️ `orders.driver_id` — haydovchining `users.id` si.
 */
@Injectable()
export class FraudReportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async snapshot(period: ReportPeriod): Promise<FraudSnapshot> {
    const params = [period.from, period.to];
    const [cancellations, drivers, cancelPairs, lostRegulars, review] = await Promise.all([
      this.one(
        `SELECT
           COUNT(*)::int AS after_accept,
           (COUNT(*) FILTER (WHERE arrived_at IS NOT NULL))::int AS after_arrival,
           (COUNT(*) FILTER (WHERE arrived_at IS NOT NULL AND cancelled_by = 'driver'))::int AS after_arrival_driver,
           (COUNT(*) FILTER (WHERE arrived_at IS NOT NULL AND cancelled_by = 'passenger'))::int AS after_arrival_passenger
         FROM orders
         WHERE status = 'cancelled' AND driver_id IS NOT NULL
           AND service_type IN ${RIDE_SERVICE_TYPES} AND ${LOCAL('created_at')}`,
        params,
      ),
      this.dataSource.query(
        `SELECT o.driver_id AS "driverUserId", ${PERSON_NAME('u')} AS name, u.phone,
                COUNT(*)::int AS accepted,
                (COUNT(*) FILTER (WHERE o.status = 'cancelled'))::int AS "cancelledAfterAccept",
                (COUNT(*) FILTER (WHERE o.status = 'cancelled' AND o.arrived_at IS NOT NULL))::int AS "cancelledAfterArrival"
           FROM orders o
           JOIN users u ON u.id = o.driver_id
          WHERE o.driver_id IS NOT NULL AND o.service_type IN ${RIDE_SERVICE_TYPES}
            AND ${LOCAL('o.created_at')}
          GROUP BY o.driver_id, u.id
         HAVING (COUNT(*) >= ${DRIVER_MIN_ACCEPTED}
                 AND COUNT(*) FILTER (WHERE o.status = 'cancelled') >= ${DRIVER_CANCEL_RATE} * COUNT(*))
             OR COUNT(*) FILTER (WHERE o.status = 'cancelled' AND o.arrived_at IS NOT NULL) >= ${DRIVER_ARRIVED_CANCELS}
          ORDER BY "cancelledAfterArrival" DESC, "cancelledAfterAccept" DESC
          LIMIT ${LIST_LIMIT}`,
        params,
      ) as Promise<SuspiciousDriver[]>,
      this.dataSource.query(
        `SELECT ${PAIR_COLUMNS},
                (COUNT(*) FILTER (WHERE o.status = 'cancelled'))::int AS "cancelledTogether",
                (COUNT(*) FILTER (WHERE o.status = 'completed'))::int AS "completedTogether",
                ($1::date - (MAX(o.completed_at))::date)::int AS "daysSinceLastTrip"
           FROM orders o ${PAIR_JOINS}
          WHERE o.driver_id IS NOT NULL AND o.service_type IN ${RIDE_SERVICE_TYPES}
            AND o.created_at < $1::timestamp
            AND o.created_at >= $1::timestamp - INTERVAL '${PAIR_WINDOW_DAYS} days'
          GROUP BY ${PAIR_GROUP}
         HAVING COUNT(*) FILTER (WHERE o.status = 'cancelled') >= ${PAIR_MIN_CANCELS}
          ORDER BY "cancelledTogether" DESC
          LIMIT ${LIST_LIMIT}`,
        [period.to],
      ) as Promise<SuspiciousPair[]>,
      this.dataSource.query(
        `SELECT ${PAIR_COLUMNS},
                0 AS "cancelledTogether",
                COUNT(*)::int AS "completedTogether",
                ($1::date - (MAX(o.completed_at))::date)::int AS "daysSinceLastTrip"
           FROM orders o ${PAIR_JOINS}
          WHERE o.status = 'completed' AND o.service_type IN ${RIDE_SERVICE_TYPES}
            AND o.completed_at < $1::timestamp - INTERVAL '${LOST_SILENT_DAYS} days'
            AND o.completed_at >= $1::timestamp - INTERVAL '${LOST_SILENT_DAYS + LOST_HISTORY_DAYS} days'
            -- yo'lovchi oxirgi 14 kunda ilovada HECH KIM bilan yurmagan
            AND NOT EXISTS (
              SELECT 1 FROM orders x
               WHERE x.passenger_id = o.passenger_id AND x.status = 'completed'
                 AND x.completed_at >= $1::timestamp - INTERVAL '${LOST_SILENT_DAYS} days'
                 AND x.completed_at < $1::timestamp)
            -- haydovchi esa shu 14 kunda boshqalar bilan ishlagan
            AND EXISTS (
              SELECT 1 FROM orders y
               WHERE y.driver_id = o.driver_id AND y.status = 'completed'
                 AND y.completed_at >= $1::timestamp - INTERVAL '${LOST_SILENT_DAYS} days'
                 AND y.completed_at < $1::timestamp)
          GROUP BY ${PAIR_GROUP}
         HAVING COUNT(*) >= ${LOST_MIN_TRIPS}
          ORDER BY "completedTogether" DESC
          LIMIT ${LIST_LIMIT}`,
        [period.to],
      ) as Promise<SuspiciousPair[]>,
      this.one(
        `SELECT
           (SELECT COUNT(*)::int FROM orders
             WHERE fraud_review IS NOT NULL AND ${LOCAL('completed_at')}) AS flagged,
           (SELECT COUNT(*)::int FROM orders WHERE fraud_review = 'pending') AS pending,
           (SELECT FLOOR(EXTRACT(EPOCH FROM ${LOCAL_NOW} - MIN(completed_at)) / 3600)::int
              FROM orders WHERE fraud_review = 'pending') AS oldest_hours`,
        params,
      ),
    ]);

    return {
      period,
      cancellations: {
        afterAccept: num(cancellations.after_accept),
        afterArrival: num(cancellations.after_arrival),
        afterArrivalByDriver: num(cancellations.after_arrival_driver),
        afterArrivalByPassenger: num(cancellations.after_arrival_passenger),
      },
      drivers,
      cancelPairs,
      lostRegulars,
      selfOrderReview: {
        flaggedInPeriod: num(review.flagged),
        pending: num(review.pending),
        oldestPendingHours: review.oldest_hours === null ? null : num(review.oldest_hours),
      },
    };
  }

  private async one(sql: string, params: string[]): Promise<Row> {
    const rows = (await this.dataSource.query(sql, params)) as Row[];
    return rows[0];
  }
}

const num = (value: number | string | null): number => Number(value ?? 0);
