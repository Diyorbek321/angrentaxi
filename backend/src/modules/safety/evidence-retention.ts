/**
 * Dalillarni saqlash muddati (docs/INCIDENT-POLICY.md §6) — SQL bo'laklari.
 *
 * ⚠️ MUDDAT SQL `now()` DAN, JS `Date` DAN EMAS. `trip_messages.created_at`
 * va `sos_alerts.created_at` — `timestamp` (mintaqasiz), qiymati bazaning
 * `now()` idan yoziladi; JS sanasini parametr qilish Node mintaqasida
 * (UTC+5) talqin qilinib, chegarani 5 soatga surardi (02e002a darsi:
 * mock testlar buni ko'rmaydi — lokal bazada sinaladi).
 */
export const RETENTION_BATCH_SIZE = 1000;
/** Bir ishga tushishda bitta jadvaldan ko'pi bilan shuncha bo'lak — cron osilib qolmasin. */
export const RETENTION_MAX_BATCHES = 200;

/** `$1` — kunlar soni. Ochiq yoki yaqinda yopilgan hodisaga bog'langan taksi/kuryer safarlari. */
export const PROTECTED_ORDERS_CTE = `
  protected_incidents AS (
    SELECT i.order_vertical, i.order_id FROM incidents i
     WHERE i.order_id IS NOT NULL
       AND (i.status IN ('open', 'investigating') OR i.resolved_at >= now() - make_interval(days => $1::int))
  ),
  protected AS (
    SELECT order_id AS id FROM protected_incidents WHERE order_vertical = 'taxi'
    UNION
    SELECT f.delivery_order_id FROM food_orders f
      JOIN protected_incidents p ON p.order_vertical = 'food' AND p.order_id = f.id
     WHERE f.delivery_order_id IS NOT NULL
    UNION
    SELECT m.delivery_order_id FROM market_orders m
      JOIN protected_incidents p ON p.order_vertical = 'market' AND p.order_id = m.id
     WHERE m.delivery_order_id IS NOT NULL
  )`;

export interface RetentionTable {
  /** Jadval nomi (hisobot kaliti ham). */
  table: 'trip_track_points' | 'trip_messages' | 'sos_alerts' | 'order_call_logs';
  timeColumn: 'recorded_at' | 'created_at';
  /** Qo'shimcha shart (masalan faol SOS o'chirilmaydi). */
  extraWhere?: string;
}

export const RETENTION_TABLES: readonly RetentionTable[] = [
  { table: 'trip_track_points', timeColumn: 'recorded_at' },
  { table: 'trip_messages', timeColumn: 'created_at' },
  // Hali yopilmagan SOS — o'chirilmaydi (kimdir uni ko'rib chiqishi kerak).
  { table: 'sos_alerts', timeColumn: 'created_at', extraWhere: `status <> 'active'` },
  { table: 'order_call_logs', timeColumn: 'created_at' },
];

/**
 * Bitta bo'lak: `$1` kun, `$2` bo'lak hajmi. O'chirilgan qatorlar soni
 * `deleted` ustunida (CTE — drayver UPDATE/DELETE shaklini emas, SELECT
 * qatorini qaytaradi).
 */
export function batchDeleteSql(t: RetentionTable): string {
  const extra = t.extraWhere ? `AND ${t.extraWhere}` : '';
  return `
    WITH ${PROTECTED_ORDERS_CTE},
    victims AS (
      SELECT id FROM ${t.table}
       WHERE ${t.timeColumn} < now() - make_interval(days => $1::int)
         ${extra}
         AND order_id NOT IN (SELECT id FROM protected WHERE id IS NOT NULL)
       LIMIT $2
    ),
    gone AS (
      DELETE FROM ${t.table} WHERE id IN (SELECT id FROM victims) RETURNING 1
    )
    SELECT COUNT(*)::int AS deleted FROM gone`;
}

/**
 * Fotolari o'chiriladigan hodisalar: yopilgan (resolved/rejected) va
 * yopilganiga muddat o'tgan (yopilmagan bo'lsa — yaratilganiga). `$1` kun, `$2` limit.
 */
export const EXPIRED_INCIDENT_PHOTOS_SQL = `
  SELECT id, photo_keys FROM incidents
   WHERE jsonb_array_length(photo_keys) > 0
     AND status IN ('resolved', 'rejected')
     AND COALESCE(resolved_at, created_at) < now() - make_interval(days => $1::int)
   ORDER BY created_at
   LIMIT $2`;

/** Ulashish havolalari — muddati allaqachon tugagan, uzoq saqlashga sabab yo'q. */
export const OLD_SHARE_LINKS_SQL = `
  WITH gone AS (
    DELETE FROM trip_share_links WHERE created_at < now() - make_interval(days => $1::int) RETURNING 1
  ) SELECT COUNT(*)::int AS deleted FROM gone`;
