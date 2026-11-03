import { Repository } from 'typeorm';
import { PaymentMethod } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';

/** Yo'lovchiga hodisa jarimasi — PENDING hamyon DEBIT'i: `incident_penalty_<auditLogId>`. */
export const INCIDENT_PENALTY_LEDGER_PREFIX = 'incident_penalty_';

/**
 * Yo'lovchining oldingi safarlardan to'lanmay qolgan hamyon qarzi (so'm).
 *
 * Yangi safar qarz bor ekan berilmaydi. Bitta joyda, chunki bu darvoza
 * har bir yo'lovchi safari yaratiladigan yo'lda bir xil bo'lishi kerak —
 * oddiy buyurtma (`OrdersCreationService`) ham, shaharlararo band ham
 * (`IntercityBookingsService`). Ikki nusxa vaqt o'tib ajralib ketardi.
 */
export async function outstandingWalletDebt(
  transactions: Repository<Transaction>,
  passengerId: string,
): Promise<number> {
  const result = await transactions
    .createQueryBuilder('t')
    .select('COALESCE(SUM(t.amount), 0)', 'debt')
    .where('t.userId = :passengerId', { passengerId })
    .andWhere('t.type = :type', { type: TransactionType.DEBIT })
    .andWhere('t.status = :status', { status: TransactionStatus.PENDING })
    .andWhere('t.paymentMethod = :method', { method: PaymentMethod.WALLET })
    // Hodisa jarimasi (INCIDENT-POLICY §3) buyurtmaga bog'lanmaydi — chek va
    // karta to'lovi qidiruvi buyurtmaning "oxirgi DEBIT" iga tayanadi.
    .andWhere("(t.orderId IS NOT NULL OR t.externalId LIKE :penalty)", { penalty: `${INCIDENT_PENALTY_LEDGER_PREFIX}%` })
    .getRawOne<{ debt: string }>();

  return parseFloat(result?.debt ?? '0');
}
