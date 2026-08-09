import { EntityManager, Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';

/**
 * Wallet balance = completed credits minus completed debits.
 *
 * PENDING rows are deliberately excluded: an uncollected card charge or an
 * unpaid wallet debt is a receivable, not money the user can spend. The result
 * is clamped at 0 so a negative aggregate never reads as spendable credit.
 *
 * Shared by every caller that touches a balance so they all compute it the
 * same way from the same query — `PaymentsService.getWalletBalance` (outside a
 * transaction), `PaymentsService.requestWithdrawal` and
 * `OrdersCompletionService.completeTrip` (both inside a locked transaction,
 * using a manager-scoped repository bound to that transaction's connection).
 */
export async function computeWalletBalance(
  transactionRepo: Repository<Transaction>,
  userId: string,
): Promise<number> {
  const result = await transactionRepo
    .createQueryBuilder('t')
    .select(
      `SUM(CASE WHEN t.type = 'credit' AND t.status = 'completed' THEN t.amount ELSE 0 END) -
       SUM(CASE WHEN t.type = 'debit' AND t.status = 'completed' THEN t.amount ELSE 0 END)`,
      'balance',
    )
    .where('t.userId = :userId', { userId })
    .getRawOne<{ balance: string }>();

  const balance = parseFloat(result?.balance ?? '0');

  return Math.max(0, balance);
}

/**
 * Serializes all balance arithmetic for one user within the calling
 * transaction.
 *
 * Balance is a computed aggregate over a variable number of rows, not a single
 * row a `SELECT ... FOR UPDATE` could pin (a user with no transactions has no
 * row to lock at all). A Postgres advisory lock keyed on the user's UUID gives
 * the serialization instead: a second concurrent call for the same user blocks
 * until the first transaction commits or rolls back, then re-reads the updated
 * balance. Different users hash to different keys and never contend. The
 * `_xact_` variant releases automatically at commit/rollback, so there is no
 * unlock call and no way to leak the lock.
 *
 * Callers must recompute the balance *after* acquiring the lock — a value read
 * beforehand may already be stale.
 */
export async function lockWalletForUpdate(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
}
