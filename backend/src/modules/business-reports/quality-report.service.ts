import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DriverAtRisk, LowRating, QualitySnapshot } from './quality-report.types';
import { ReportPeriod } from './report-period';
import { LOCAL, LOCAL_NOW, PERSON_NAME, RIDE_SERVICE_TYPES, TZ } from './report-sql';

/** ≤ shu yulduz — past baho. */
const LOW_SCORE = 3;
/** Haydovchi yo'lovchiga qo'ygan ≤ shu baho — muammoli yo'lovchi. */
const LOW_PASSENGER_SCORE = 2;
/** Haydovchining oxirgi shuncha bahosi olinadi... */
const RISK_RECENT_RATINGS = 20;
/** ...kamida shuncha bo'lsa baholanadi... */
const RISK_MIN_RATINGS = 5;
/** ...o'rtachasi shundan past bo'lsa — xavf ostida. */
const RISK_AVERAGE = 4.5;
const LIST_LIMIT = 10;

/** Operator (menejer/admin) xabari; qolgani — foydalanuvchi. */
const OPERATOR_ROLES = `('manager', 'admin')`;

type Row = Record<string, number | string | null>;

/**
 * Sifat va qo'llab-quvvatlash surati (`quality-report.types.ts`).
 *
 * Vaqt ustunlari: `ratings`, `support_*`, `sos_alerts` — `timestamp`
 * (Toshkent mahalliy), `lost_item_reports` — `timestamptz`.
 */
@Injectable()
export class QualityReportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async snapshot(period: ReportPeriod): Promise<QualitySnapshot> {
    const params = [period.from, period.to];
    const [ratings, lowList, atRisk, support, sos, lost] = await Promise.all([
      this.one(
        `SELECT
           (COUNT(*) FILTER (WHERE r.from_role = 'passenger'))::int AS count,
           ROUND(AVG(r.score) FILTER (WHERE r.from_role = 'passenger'), 2)::float8 AS average,
           (COUNT(*) FILTER (WHERE r.from_role = 'passenger' AND r.score <= ${LOW_SCORE}))::int AS low,
           (COUNT(*) FILTER (WHERE r.from_role = 'driver' AND r.score <= ${LOW_PASSENGER_SCORE}))::int AS low_passenger,
           (SELECT COUNT(*)::int FROM orders
             WHERE status = 'completed' AND service_type IN ${RIDE_SERVICE_TYPES}
               AND ${LOCAL('completed_at')}) AS completed_rides
         FROM ratings r
         WHERE ${LOCAL('r.created_at')}`,
        params,
      ),
      this.dataSource.query(
        `SELECT r.order_id AS "orderId", r.to_user_id AS "driverUserId", ${PERSON_NAME('u')} AS "driverName",
                r.score, NULLIF(TRIM(r.comment), '') AS comment,
                to_char(r.created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
           FROM ratings r
           JOIN users u ON u.id = r.to_user_id
          WHERE r.from_role = 'passenger' AND r.score <= ${LOW_SCORE} AND ${LOCAL('r.created_at')}
          ORDER BY r.score ASC, r.created_at DESC
          LIMIT ${LIST_LIMIT}`,
        params,
      ) as Promise<LowRating[]>,
      // Hozirgi holat: faol haydovchilarning oxirgi 20 bahosi.
      this.dataSource.query(
        `SELECT u.id AS "driverUserId", ${PERSON_NAME('u')} AS name, u.phone,
                ROUND(AVG(x.score), 2)::float8 AS "recentAvg", COUNT(*)::int AS "recentCount"
           FROM users u
           CROSS JOIN LATERAL (
             SELECT r.score FROM ratings r
              WHERE r.to_user_id = u.id AND r.from_role = 'passenger'
              ORDER BY r.created_at DESC
              LIMIT ${RISK_RECENT_RATINGS}
           ) x
          WHERE u.role = 'driver' AND u.status = 'active'
          GROUP BY u.id
         HAVING COUNT(*) >= ${RISK_MIN_RATINGS} AND AVG(x.score) < ${RISK_AVERAGE}
          ORDER BY "recentAvg" ASC
          LIMIT ${LIST_LIMIT}`,
      ) as Promise<DriverAtRisk[]>,
      this.one(
        `WITH first_reply AS (
           SELECT t.id, t.created_at,
                  (SELECT MIN(m.created_at) FROM support_messages m
                    WHERE m.thread_id = t.id AND m.sender_role IN ${OPERATOR_ROLES}) AS replied_at
             FROM support_threads t
            WHERE ${LOCAL('t.created_at')}
         ),
         last_msg AS (
           SELECT DISTINCT ON (m.thread_id) m.thread_id, m.sender_role, m.created_at
             FROM support_messages m
             JOIN support_threads t ON t.id = m.thread_id AND t.status = 'open'
            ORDER BY m.thread_id, m.created_at DESC
         )
         SELECT
           (SELECT COUNT(*)::int FROM first_reply) AS opened,
           (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
                     ORDER BY EXTRACT(EPOCH FROM replied_at - created_at) / 60))::int
              FROM first_reply WHERE replied_at IS NOT NULL) AS median_first_response_min,
           (SELECT COUNT(*)::int FROM support_threads WHERE status = 'open') AS open_now,
           (SELECT COUNT(*)::int FROM last_msg WHERE sender_role NOT IN ${OPERATOR_ROLES}) AS unanswered,
           (SELECT FLOOR(EXTRACT(EPOCH FROM ${LOCAL_NOW} - MIN(created_at)) / 3600)::int
              FROM last_msg WHERE sender_role NOT IN ${OPERATOR_ROLES}) AS oldest_unanswered_hours`,
        params,
      ),
      this.one(
        `SELECT
           (COUNT(*) FILTER (WHERE ${LOCAL('created_at')}))::int AS in_period,
           (COUNT(*) FILTER (WHERE status = 'active'))::int AS active,
           FLOOR(EXTRACT(EPOCH FROM ${LOCAL_NOW} - MIN(created_at) FILTER (WHERE status = 'active')) / 60)::int
             AS oldest_active_minutes
         FROM sos_alerts`,
        params,
      ),
      this.one(
        `SELECT
           (COUNT(*) FILTER (WHERE ${TZ('created_at')}))::int AS reported,
           (COUNT(*) FILTER (WHERE status = 'open'))::int AS open,
           FLOOR(EXTRACT(EPOCH FROM now() - MIN(created_at) FILTER (WHERE status = 'open')) / 3600)::int
             AS oldest_open_hours
         FROM lost_item_reports`,
        params,
      ),
    ]);

    return {
      period,
      ratings: {
        count: num(ratings.count),
        average: ratings.average === null ? null : num(ratings.average),
        low: num(ratings.low),
        completedRides: num(ratings.completed_rides),
        lowPassengerRatings: num(ratings.low_passenger),
        lowList,
      },
      driversAtRisk: atRisk,
      support: {
        openedInPeriod: num(support.opened),
        medianFirstResponseMin: nullable(support.median_first_response_min),
        openNow: num(support.open_now),
        unanswered: num(support.unanswered),
        oldestUnansweredHours: nullable(support.oldest_unanswered_hours),
      },
      sos: {
        inPeriod: num(sos.in_period),
        active: num(sos.active),
        oldestActiveMinutes: nullable(sos.oldest_active_minutes),
      },
      lostItems: {
        reportedInPeriod: num(lost.reported),
        open: num(lost.open),
        oldestOpenHours: nullable(lost.oldest_open_hours),
      },
    };
  }

  private async one(sql: string, params: string[]): Promise<Row> {
    const rows = (await this.dataSource.query(sql, params)) as Row[];
    return rows[0];
  }
}

const num = (value: number | string | null): number => Number(value ?? 0);
const nullable = (value: number | string | null): number | null => (value === null ? null : Number(value));
