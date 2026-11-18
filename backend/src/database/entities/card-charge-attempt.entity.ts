import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * `review` — Payme chek to'langan, lekin daftar yopilmagan (Merchant callback
 * yetib kelmagan): qo'lda tekshiriladi, qayta yechish bloklanadi.
 */
export type CardChargeStatus = 'pending' | 'paid' | 'failed' | 'review';


/**
 * Safar oxirida saqlangan kartadan yechish urinishi (migratsiya 056).
 *
 * `uq_card_charge_attempts_live_order` — bitta buyurtmaga bir vaqtda faqat
 * bitta jonli (`pending`/`paid`/`review`) urinish.
 */
@Index('idx_card_charge_attempts_card', ['savedCardId'])
// Indeks entity'da ham — aks holda `synchronize` uni o'chirib yuborardi va
// ikki marta yechishdan himoya yo'qolardi.
@Index('uq_card_charge_attempts_live_order', ['orderId'], {
  unique: true,
  where: `"status" IN ('pending','paid','review')`,
})
@Entity('card_charge_attempts')
export class CardChargeAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'saved_card_id', type: 'uuid' })
  savedCardId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'provider_receipt_id', type: 'varchar', length: 64, nullable: true })
  providerReceiptId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: CardChargeStatus;

  @Column({ name: 'failure_reason', type: 'varchar', length: 64, nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
