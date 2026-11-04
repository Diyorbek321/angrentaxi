import { HttpException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ERROR_CODES, codedBadRequest } from '../../common/errors/coded-error';
import { PaymentMethod } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';

/** Yo'lovchiga hodisa jarimasi — PENDING hamyon DEBIT'i: `incident_penalty_<auditLogId>`. */
export const INCIDENT_PENALTY_LEDGER_PREFIX = 'incident_penalty_';

/**
 * Yo'lovchi qarzi qatori — bir ta'rif, darvoza ham, yopish ham shundan.
 * Buyurtmaga bog'langan hamyon DEBIT'i yoki hodisa jarimasi (u buyurtmaga
 * bog'lanmaydi — chek va karta to'lovi qidiruvi buyurtmaning "oxirgi DEBIT"
 * iga tayanadi). Haydovchining `commission`/`tax_withholding` PENDING
 * oyoqlari ham hamyon usulida bo'ladi — ular yo'lovchi qarzi EMAS.
 */
export const PASSENGER_DEBT_ROW_SQL = (a: string): string =>
  `((${a}order_id IS NOT NULL AND (${a}external_id IS NULL OR ${a}external_id NOT IN ('commission', 'tax_withholding'))) ` +
  `OR ${a}external_id LIKE '${INCIDENT_PENALTY_LEDGER_PREFIX}%')`;

/**
 * Yangi buyurtma qarz sababli rad etildi. Matn eski APK uchun o'zgarmaydi,
 * yangi ilova `code` va `details.amount` bo'yicha qarz oynasini ochadi.
 */
export function walletDebtBlockedError(debt: number): HttpException {
  return codedBadRequest(
    ERROR_CODES.walletDebtOutstanding,
    `You have an unpaid balance of ${debt} so'm from a previous trip. ` +
      'Please top up your wallet before ordering again.',
    { details: { amount: debt } },
  );
}

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
    .andWhere(PASSENGER_DEBT_ROW_SQL('t.'))
    .getRawOne<{ debt: string }>();

  return parseFloat(result?.debt ?? '0');
}
