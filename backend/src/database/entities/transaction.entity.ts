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
