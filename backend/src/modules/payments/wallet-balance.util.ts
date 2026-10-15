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

/**
 * Bir nechta foydalanuvchining daftar qoldig'i — BITTA guruhlangan so'rovda
 * (masalan, matching'da nomzod kuryerlarni filtrlash). Formula
 * `computeWalletBalance` bilan AYNAN bir xil; qatori yo'q foydalanuvchi — 0.
 */
export async function computeWalletBalances(
  manager: Pick<EntityManager, 'query'>,
  userIds: readonly string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>(userIds.map((id) => [id, 0]));
  if (userIds.length === 0) return result;
  const rows = (await manager.query(
    `SELECT user_id,
            COALESCE(SUM(CASE WHEN type = 'credit' AND status = 'completed' THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type = 'debit' AND status = 'completed' THEN amount ELSE 0 END), 0) AS balance
       FROM transactions
      WHERE user_id = ANY($1)
      GROUP BY user_id`,
    [userIds],
  )) as Array<{ user_id: string; balance: string }> | undefined;
  for (const row of rows ?? []) {
    result.set(row.user_id, parseFloat(row.balance) || 0);
  }
  return result;
}

export interface DriverBalanceSync {
  /** `drivers.id`; foydalanuvchi haydovchi bo'lmasa `null` (no-op). */
  driverId: string | null;
  /** Daftar qoldig'i (= ustunning yangi qiymati). */
  balance: number;
  /** Shu yozuv haydovchini oflayn qildimi (daftar manfiyga tushdi). */
  wentOffline: boolean;
}

/**
 * `drivers.balance` ustunini DAFTARDAN qayta yozadi — chaqiruvchining
 * tranzaksiyasi ichida, daftar qatorlari yozilgandan KEYIN.
 *
 * ⚠️ YAGONA HAQIQAT MANBAI — DAFTAR. Ustun endi faqat kesh: ilgari
 * `balance = balance + delta` qilinardi, yechish va sotuvchiga hamyon
 * o'tkazmasi esa ustunga umuman tegmasdi, ya'ni ikkalasi ajralib ketardi.
 * Endi har bir pul harakati (safar, smena, soliq, to'ldirish, o'tkazma,
 * yechish) shu funksiyani chaqiradi va ustun daftarga teng bo'ladi.
 * Avtomatik oflayn qilish ham daftar bo'yicha (onlayn darvoza bilan bir
 * xil qoida: qoldiq < 0).
 *
 * Redis'ga TEGMAYDI — chaqiruvchi commit'dan keyin `wentOffline` bo'yicha
 * `DriversService.takeOfflineInRedis` ni chaqiradi.
 */
export async function syncDriverBalanceColumn(
  manager: Pick<EntityManager, 'query'>,
  userId: string,
): Promise<DriverBalanceSync> {
  const rows = (await manager.query(
    `WITH ledger AS (
       SELECT COALESCE(SUM(CASE WHEN type = 'credit' AND status = 'completed' THEN amount ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN type = 'debit' AND status = 'completed' THEN amount ELSE 0 END), 0) AS balance
         FROM transactions WHERE user_id = $1
     ), prev AS (
       SELECT id, is_online FROM drivers WHERE user_id = $1 FOR UPDATE
     )
     UPDATE drivers d
        SET balance = ledger.balance,
            is_online = CASE WHEN ledger.balance < 0 THEN false ELSE d.is_online END
       FROM ledger, prev
      WHERE d.id = prev.id
  RETURNING d.id AS driver_id, d.balance AS balance, d.is_online AS is_online, prev.is_online AS was_online`,
    [userId],
  )) as unknown;
  const row = firstReturnedRow<{ driver_id: string; balance: string; is_online: boolean; was_online: boolean }>(rows);
  if (!row) return { driverId: null, balance: 0, wentOffline: false };
  return {
    driverId: row.driver_id,
    balance: parseFloat(row.balance) || 0,
    wentOffline: row.was_online === true && row.is_online === false,
  };
}

/**
 * TypeORM'ning postgres drayveri UPDATE/DELETE uchun `[rows, rowCount]`
 * qaytaradi, SELECT uchun esa `rows`. Ikkala shaklni ham o'qiydi.
 */
function firstReturnedRow<T>(result: unknown): T | undefined {
  if (!Array.isArray(result) || result.length === 0) return undefined;
  const head: unknown = result[0];
  if (Array.isArray(head)) return head[0] as T | undefined;
  return head as T;
}

export interface WithdrawableBalance {
  /** Yechib olish mumkin: `max(0, balance − held)`. */
  available: number;
  /** Ushlab turilgan: oxirgi `holdDays` kunda `paid` bo'lgan karta to'ldirishlari. */
  held: number;
}

/**
 * Yechib olish mumkin bo'lgan qoldiq (security review #3a): karta orqali
 * to'ldirilgan pul `holdDays` kun SARFLANADI (komissiya, smena, sotuvchiga
 * o'tkazma), lekin YECHIB OLINMAYDI — chargeback/bekor qilish oynasi.
 * Bekor qilingan to'ldirish (`cancelled`) hisobga olinmaydi — u allaqachon
 * teskari DEBIT bilan qaytarilgan.
 *
 * Yechish oqimida `lockWalletForUpdate` dan KEYIN chaqiriladi.
 */
export async function computeWithdrawableBalance(
  manager: Pick<EntityManager, 'query'>,
  userId: string,
  balance: number,
  holdDays: number,
  now: Date = new Date(),
): Promise<WithdrawableBalance> {
  if (!Number.isFinite(holdDays) || holdDays <= 0) {
    return { available: Math.max(0, balance), held: 0 };
  }
  const since = new Date(now.getTime() - holdDays * 24 * 60 * 60 * 1000);
  const rows = (await manager.query(
    `SELECT COALESCE(SUM(amount), 0) AS held
       FROM wallet_topups
      WHERE user_id = $1 AND status = 'paid' AND paid_at > $2`,
    [userId, since],
  )) as Array<{ held: string }> | undefined;
  const held = parseFloat(rows?.[0]?.held ?? '0') || 0;
  return { available: Math.max(0, balance - held), held };
}

/**
 * Bir nechta foydalanuvchi hamyonini qulflaydi — DOIMO id bo'yicha saralangan
 * tartibda (security review #3b/#9). Ikki tranzaksiya bir xil juftlikni
 * teskari tartibda qulflab, bir-birini kutib qolmasligi (deadlock) uchun
 * sotuvchi bilan hisob-kitobning HAR bir yo'li shu funksiyadan foydalanadi:
 * avval hamyonlar, keyin buyurtma qatori.
 */
export async function lockWalletsForUpdate(
  manager: EntityManager,
  userIds: ReadonlyArray<string | null | undefined>,
): Promise<string[]> {
  const ordered = [...new Set(userIds.filter((id): id is string => typeof id === 'string' && id !== ''))].sort();
  for (const userId of ordered) {
    await lockWalletForUpdate(manager, userId);
  }
  return ordered;
}
