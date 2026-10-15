import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum WalletTopupStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  /** Bekor qilingan — to'langandan keyin bo'lsa, daftarda teskari DEBIT bor. */
  CANCELLED = 'cancelled',
  /** To'lanmay muddati o'tgan (Payme talabi: 12 soat). */
  EXPIRED = 'expired',
}

export type WalletTopupProvider = 'payme' | 'click' | 'uzcard';

/**
 * Haydovchi/kuryer hamyonini to'lov tizimi orqali to'ldirish (migratsiya 027).
 *
 * Provayderga yuboriladigan merchant havolasi — `topup_<id>`
 * (`WALLET_TOPUP_REFERENCE_PREFIX`); buyurtma to'lovlari esa buyurtma UUID'i
 * bilan boradi, ya'ni callback qaysi oqimga tegishli ekanini prefiksdan
 * aniq biladi. Payme'ning faqat o'z `id` sini yuboradigan chaqiruvlari
 * (Perform/Cancel/CheckTransaction) uchun `external_id` (unikal) bo'yicha
 * qidiriladi.
 *
 * Pul daftarga FAQAT `paid` ga o'tishda tushadi: CREDIT
 * `wallet_topup_<id>` (unikal indeks — bir martalik).
 */
@Index('idx_wallet_topups_user_created', ['userId', 'createdAt'])
@Index('uq_wallet_topups_external_id', ['externalId'], {
  unique: true,
  where: 'external_id IS NOT NULL',
})
@Check('CHK_wallet_topups_amount', '"amount" > 0')
@Entity('wallet_topups')
export class WalletTopup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Click `merchant_prepare_id` — protokol butun son talab qiladi, UUID emas.
   */
  @Column({ type: 'bigint', unique: true })
  @Generated('increment')
  seq: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) },
  })
  amount: number;

  @Column({ type: 'varchar', length: 10 })
  provider: WalletTopupProvider;

  @Column({ type: 'varchar', length: 10, default: WalletTopupStatus.PENDING })
  status: WalletTopupStatus;

  /** Provayderning o'z tranzaksiya id'si (Payme `id`, Click `click_trans_id`, UZPS `transaction_id`). */
  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  externalId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}
