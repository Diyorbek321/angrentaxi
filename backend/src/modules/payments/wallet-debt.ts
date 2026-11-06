import { EntityManager } from 'typeorm';
import { PASSENGER_DEBT_ROW_SQL, INCIDENT_PENALTY_LEDGER_PREFIX } from '../orders/outstanding-wallet-debt';
import { TAXI_FEE_CHARGE_PREFIX } from '../orders/taxi-cancel-policy';

/** Qarz nimadan paydo bo'lgan — ilova va panel matni shu kodga tayanadi. */
export type WalletDebtReason =
  /** Hamyon yetmagan safar. */
  | 'ride_shortfall'
  /** Rad etilgan naqd yetkazish: yetkazish + qaytarish haqi. */
  | 'delivery_refused'
  /** Kech bekor qilish jarimasi. */
  | 'late_cancel'
  /** "Yo'lovchi chiqmadi" jarimasi. */
  | 'no_show'
  /** Hodisa jarimasi. */
  | 'incident_penalty';

export interface WalletDebtItem {
  /** Qarz DEBIT qatori. */
  id: string;
  amount: number;
  reason: WalletDebtReason;
  orderId: string | null;
  createdAt: Date;
}

/** Yopish uchun ichki shakl: haydovchi oyoqlarini ochish uchun buyurtma haydovchisi. */
export interface OpenWalletDebt extends WalletDebtItem {
  driverUserId: string | null;
}

interface DebtRow {
  id: string;
  amount: string;
  order_id: string | null;
  external_id: string | null;
  created_at: Date;
  driver_id: string | null;
  cancelled_by: string | null;
  delivery_failed_at: Date | null;
}

export function walletDebtReason(row: Pick<DebtRow, 'external_id' | 'cancelled_by' | 'delivery_failed_at'>): WalletDebtReason {
  const tag = row.external_id ?? '';
  if (tag.startsWith(INCIDENT_PENALTY_LEDGER_PREFIX)) return 'incident_penalty';
  if (tag.startsWith(TAXI_FEE_CHARGE_PREFIX)) return row.cancelled_by === 'driver' ? 'no_show' : 'late_cancel';
  return row.delivery_failed_at ? 'delivery_refused' : 'ride_shortfall';
}

/**
 * Yo'lovchining ochiq qarzlari — eng eskisi birinchi. `manager` tranzaksiyada
 * bo'lsa, chaqiruvchi avval hamyonni qulflaydi. `order_id` food/market ham
 * bo'lishi mumkin (tashqi kalit yo'q) — shuning uchun LEFT JOIN.
 */
export async function listOpenWalletDebts(
  manager: Pick<EntityManager, 'query'>,
  userId: string,
): Promise<OpenWalletDebt[]> {
  const rows = (await manager.query(
    `SELECT t.id, t.amount, t.order_id, t.external_id, t.created_at,
            o.driver_id, o.cancelled_by, o.delivery_failed_at
       FROM transactions t
       LEFT JOIN orders o ON o.id = t.order_id
      WHERE t.user_id = $1
        AND t.type = 'debit'
        AND t.status = 'pending'
        AND t.payment_method = 'wallet'
        AND ${PASSENGER_DEBT_ROW_SQL('t.')}
      ORDER BY t.created_at ASC, t.id ASC`,
    [userId],
  )) as DebtRow[];
  return rows.map((row) => ({
    id: row.id,
    amount: parseFloat(row.amount),
    reason: walletDebtReason(row),
    orderId: row.order_id,
    createdAt: row.created_at,
    driverUserId: row.driver_id,
  }));
}

/** Buyurtmada yana ochiq yo'lovchi qarzi bormi — bo'lsa haydovchi oyoqlari ochilmaydi. */
export async function orderHasOpenDebt(
  manager: Pick<EntityManager, 'query'>,
  userId: string,
  orderId: string,
): Promise<boolean> {
  const rows = (await manager.query(
    `SELECT 1 FROM transactions t
      WHERE t.user_id = $1 AND t.order_id = $2
        AND t.type = 'debit' AND t.status = 'pending' AND t.payment_method = 'wallet'
        AND ${PASSENGER_DEBT_ROW_SQL('t.')}
      LIMIT 1`,
    [userId, orderId],
  )) as unknown[];
  return rows.length > 0;
}
