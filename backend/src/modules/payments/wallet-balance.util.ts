import { EntityManager, Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';

/**
 * Hamyon balansi = tugallangan kirim − tugallangan chiqim. ISHORALI.
 *
 * PENDING qatorlar ATAYLAB hisobga olinmaydi: yig'ilmagan karta to'lovi yoki
 * to'lanmagan hamyon qarzi — bu qarzdorlik, sarflash mumkin bo'lgan pul emas.
 *
 * ⚠️ NEGA MANFIY BO'LA OLADI. Ilgari natija 0 ga qirqilardi va shu sabab
 * haydovchining platformaga QARZI ko'rinmasdi: naqd safarning komissiyasi
 * daftarda turardi, balans esa 0 deb o'qilardi. Endi haydovchi uchun bitta
 * hisob bor va u manfiy bo'lishi mumkin — bu "platformaga shuncha qarzdorsan"
 * degani (onlayn chiqish shu bilan bloklanadi).
 *
 * Sarflashdan oldin tekshiradigan chaqiruvchi `computeSpendableBalance` ni
 * ishlatadi — manfiy qoldiq hech qachon "sarflasa bo'ladigan kredit" bo'lib
 * o'qilmasligi kerak.
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

  return parseFloat(result?.balance ?? '0');
}

/**
 * Sarflash mumkin bo'lgan qoldiq — hech qachon manfiy emas.
 *
 * ⚠️ Aynan shu funksiya "hamyondan to'lay olasanmi?" savoliga javob beradi.
 * Ishorali balansni to'g'ridan-to'g'ri solishtirish manfiy qoldiqli
 * foydalanuvchini ham "to'lovga qurbi yetadi" deb o'tkazib yuborishi mumkin
 * edi (masalan −5000 >= −10000).
 */
export async function computeSpendableBalance(
  transactionRepo: Repository<Transaction>,
  userId: string,
): Promise<number> {
  return Math.max(0, await computeWalletBalance(transactionRepo, userId));
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
