import { Repository } from 'typeorm';
import { PaymentMethod } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';

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
    .andWhere('t.orderId IS NOT NULL')
    .getRawOne<{ debt: string }>();

  return parseFloat(result?.debt ?? '0');
}
