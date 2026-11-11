import type { EntityManager } from 'typeorm';

/**
 * `users.suspended_until` yozuvlari — har doim chaqiruvchining
 * tranzaksiyasi ichida (natija + audit bilan bitta commit).
 */
type Query = Pick<EntityManager, 'query'>;

function firstRow<T>(result: unknown): T | undefined {
  if (!Array.isArray(result) || result.length === 0) return undefined;
  const head: unknown = result[0];
  if (Array.isArray(head)) return head[0] as T | undefined;
  return head as T;
}

/**
 * To'xtatadi: mavjud uzunroq to'xtatish QISQARTIRILMAYDI (GREATEST). Amaldagi
 * tugash vaqtini qaytaradi.
 */
export async function applySuspension(manager: Query, userId: string, until: Date, reason: string): Promise<Date> {
  const rows = await manager.query(
    `UPDATE users
        SET suspended_until = GREATEST(COALESCE(suspended_until, $2::timestamptz), $2::timestamptz),
            suspension_reason = $3
      WHERE id = $1
  RETURNING suspended_until`,
    [userId, until, reason.slice(0, 300)],
  );
  const row = firstRow<{ suspended_until: Date | string }>(rows);
  return row ? new Date(row.suspended_until) : until;
}

/**
 * Shu hodisa qo'ygan to'xtatishni olib tashlaydi — faqat keyin boshqa
 * (uzunroq) to'xtatish qo'yilmagan bo'lsa (`suspended_until <= until`).
 * Olib tashlandimi — `true`.
 */
export async function liftSuspension(manager: Query, userId: string, until: Date): Promise<boolean> {
  const rows = await manager.query(
    `UPDATE users SET suspended_until = NULL, suspension_reason = NULL
      WHERE id = $1 AND suspended_until IS NOT NULL AND suspended_until <= $2::timestamptz + interval '1 second'
  RETURNING id`,
    [userId, until],
  );
  return firstRow<{ id: string }>(rows) !== undefined;
}
