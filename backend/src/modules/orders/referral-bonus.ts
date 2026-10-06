import { Repository } from 'typeorm';
import { Order, PaymentMethod } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';

/** Taklif qilgan va taklif qilingan yo'lovchiga beriladigan bonus, so'm. */
export const REFERRAL_BONUS_AMOUNT = 5000;

/**
 * Shubhali deb ushlab qolingan safar menejer tomonidan tasdiqlanganda
 * referal bonusini beradi (`OrderFraudService.review`).
 *
 * Faqat quyidagi holatda: yo'lovchi kimdir orqali kelgan, bonus hali
 * berilmagan va shu safar uning BIRINCHI hisobga olinadigan (rad etilmagan)
 * safari. Oddiy oqim — `orders-completion.service.ts` dagi referal bloki.
 */
export async function creditReferralBonus(
  orderRepository: Repository<Order>,
  passengerId: string,
  orderId: string,
): Promise<boolean> {
  const [user] = (await orderRepository.query(
    `SELECT referred_by_user_id FROM users WHERE id = $1`,
    [passengerId],
  )) as Array<{ referred_by_user_id: string | null }>;
  const referrerId = user?.referred_by_user_id;
  if (!referrerId) return false;

  const [already] = (await orderRepository.query(
    `SELECT 1 FROM transactions WHERE user_id = $1 AND external_id LIKE 'referral_bonus_passenger_%' LIMIT 1`,
    [passengerId],
  )) as unknown[];
  if (already) return false;

  const [first] = (await orderRepository.query(
    `SELECT id FROM orders
      WHERE passenger_id = $1 AND status = 'completed'
        AND (fraud_review IS NULL OR fraud_review = 'approved')
      ORDER BY completed_at ASC LIMIT 1`,
    [passengerId],
  )) as Array<{ id: string }>;
  if (first?.id !== orderId) return false;

  const transactions = orderRepository.manager.getRepository(Transaction);
  for (const [userId, tag] of [
    [passengerId, 'passenger'],
    [referrerId, 'referrer'],
  ] as const) {
    await transactions.save({
      userId,
      orderId,
      amount: REFERRAL_BONUS_AMOUNT,
      type: TransactionType.CREDIT,
      paymentMethod: PaymentMethod.WALLET,
      status: TransactionStatus.COMPLETED,
      externalId: `referral_bonus_${tag}_${orderId}`,
    });
  }
  return true;
}
