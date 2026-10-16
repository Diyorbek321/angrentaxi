import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Order } from './order.entity';
import { PaymentMethod } from './order.entity';
import { DriverBonusRule } from './driver-bonus-rule.entity';

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/**
 * `externalId` qiymati — chaqim (tips) daftar qatorlarini belgilaydi.
 *
 * NEGA KONSTANTA: chaqim yo'lovchining hamyonidan AYNI SHU buyurtma uchun
 * ikkinchi DEBIT qatorini yozadi va u yo'l haqidan KEYIN yaratiladi. Buyurtma
 * bo'yicha "eng oxirgi DEBIT" ni izlaydigan har bir joy (chek, karta
 * callback'i) endi yo'l haqi o'rniga chaqimni topib olardi. Belgi bitta
 * joyda turishi shart — aks holda satrni bir joyda o'zgartirib, filtrlarni
 * jimgina buzib qo'yish mumkin.
 */
export const TIP_LEDGER_TAG = 'tip';

/**
 * Haydovchiga chaqimning to'lovchi BONUSIDAN qoplangan qismi (CREDIT).
 *
 * NEGA ALOHIDA BELGI: bonus pul yechib olinmaydi (docs/LEGAL-COMPLIANCE.md).
 * Yo'lovchi to'ldira olmaydi, ya'ni uning hamyoni amalda bonus — u bonusni
 * chaqim qilib haydovchiga bersa va bu oddiy `'tip'` bo'lib yozilsa, bonus
 * naqd pulga aylanardi. Bu qator `computeWithdrawableBalance` da bonus deb
 * sanaladi. To'lovchi tomoni o'zgarmaydi — bitta `'tip'` DEBIT.
 */
export const TIP_BONUS_LEDGER_TAG = 'tip_bonus';

/**
 * Hamyon bilan to'langan safarda yo'l haqining yo'lovchi BONUSIDAN qoplangan
 * qismi — haydovchiga CREDIT. `TIP_BONUS_LEDGER_TAG` bilan bir xil sabab:
 * aks holda "soxta yo'lovchini taklif qilish → bonus → hamyon bilan safar →
 * naqd yechish" yo'li ochiq qolardi. Hamyon harakati o'zgarmaydi, faqat
 * yechib olish huquqi (`computeWithdrawableBalance` bonus deb sanaydi).
 */
export const FARE_BONUS_LEDGER_TAG = 'fare_bonus';

/**
 * Yuqoridagining yo'lovchi tomoni: hamyon bilan to'langan safar DEBIT'ining
 * BONUSDAN qoplangan qismi alohida qator. U bonus hisobini kamaytiradi
 * (`BONUS_CONSUMING_DEBIT_SQL`); aks holda sarflangan bonus hisobda qolib,
 * keyingi haqiqiy pulli safarda haydovchi daromadini `fare_bonus` qilib
 * qulflardi. Hamyon qoldig'i uchun oddiy DEBIT — jami o'zgarmaydi.
 */
export const FARE_BONUS_SPEND_LEDGER_TAG = 'fare_bonus_spend';

// Read-path indexes.
// - user_id + created_at: PaymentsService.getTransactionHistory (paginated,
//   newest-first) and computeBalance / the referral bonus SUM, which both
//   aggregate a single user's whole ledger via the user_id prefix. `type` and
//   `status` deliberately get no index of their own: they are two- and
//   four-value columns that are never filtered without user_id, so the
//   user_id partition is already small enough to filter in memory.
// - order_id: the per-order commission/charge lookup in chargeForOrder and
//   the earnings-breakdown join on t.order_id.
// - external_id: the payment-webhook idempotency lookup (findOne by
//   externalId) — a full scan of the ledger on every webhook otherwise.
@Index('idx_transactions_user_id_created_at', ['userId', 'createdAt'])
@Index('idx_transactions_order_id', ['orderId'])
@Index('idx_transactions_external_id', ['externalId'])
// Soliq ushlab qolish bir buyurtmaga bir marta (migratsiya 025). Entity'da
// e'lon qilingan — aks holda dev'dagi `synchronize` qisman indeksni
// "begona" deb o'chirib yuborardi (012 dagi indeks shunday yo'qolgan).
@Index('uq_transactions_tax_withholding_order', ['orderId', 'userId'], {
  unique: true,
  where: "external_id = 'tax_withholding'",
})
// Sotuvchi bilan hamyon orqali hisob-kitob — har bir qator (kuryer DEBIT,
// sotuvchi CREDIT) buyurtmaga bir marta (migratsiya 026). Entity'da e'lon
// qilingan — yuqoridagi soliq indeksi bilan bir xil sabab.
@Index('uq_transactions_vendor_settlement', ['externalId'], {
  unique: true,
  where: "external_id LIKE 'vendor_settlement_%'",
})
// Hamyonni to'ldirish (CREDIT `wallet_topup_<id>`, teskari DEBIT
// `wallet_topup_reversal_<id>`) va smena qaytarimi (`shift_pass_refund_<id>`)
// — har biri bir marta (migratsiya 027).
@Index('uq_transactions_wallet_topup', ['externalId'], {
  unique: true,
  where: "external_id LIKE 'wallet_topup_%' OR external_id LIKE 'shift_pass_refund_%'",
})
// Karta qaytarimida haydovchi/sotuvchi ulushini qaytarib olish
// (`refund_clawback_driver_<id>` / `refund_clawback_vendor_<id>`) — bir marta
// (migratsiya 029, docs §23).
@Index('uq_transactions_refund_clawback', ['externalId'], {
  unique: true,
  where: "external_id LIKE 'refund_clawback_%'",
})
// Yechish qaytarimi (`withdrawal_refund_<id>`) va referal bonusi
// (`referral_bonus_{passenger|referrer}_<orderId>`) — har biri bir marta
// (migratsiya 033). Ikki parallel REJECT yoki ikki marta yakunlangan safar
// pulni ikki marta yoza olmaydi.
@Index('uq_transactions_withdrawal_refund', ['externalId'], {
  unique: true,
  where: "external_id LIKE 'withdrawal_refund_%'",
})
@Index('uq_transactions_referral_bonus', ['externalId'], {
  unique: true,
  where: "external_id LIKE 'referral_bonus_%'",
})
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Order, { nullable: true, eager: false })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ name: 'order_id', nullable: true, type: 'uuid' })
  orderId: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ nullable: true, type: 'varchar' })
  externalId: string | null;

  // Set when this CREDIT transaction is a driver bonus payout (see DriverBonusesService).
  @ManyToOne(() => DriverBonusRule, { nullable: true, eager: false })
  @JoinColumn({ name: 'bonus_rule_id' })
  bonusRule: DriverBonusRule | null;

  @Column({ name: 'bonus_rule_id', type: 'uuid', nullable: true })
  bonusRuleId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
