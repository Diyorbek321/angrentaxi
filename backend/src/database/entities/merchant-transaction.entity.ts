import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Bizga pul olib keladigan merchant protokollari (Payme Merchant API, Click SHOP API). */
export type MerchantProvider = 'payme' | 'click';

/** Nima to'lanyapti: buyurtma (yo'lovchi/mijoz to'lovi) yoki hamyonni to'ldirish. */
export type MerchantTargetKind = 'order' | 'topup';

/** Tranzaksiya holati — Payme Merchant API raqamlari (Click ham shu raqamlarda saqlanadi). */
export const MERCHANT_TX_STATE = {
  created: 1,
  performed: 2,
  cancelled: -1,
  cancelledAfterPerform: -2,
} as const;
export type MerchantTxState = (typeof MERCHANT_TX_STATE)[keyof typeof MERCHANT_TX_STATE];

const bigintAsNumber = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null || value === undefined ? null : Number(value)),
};

/**
 * Provayder tranzaksiyasi — Payme `CreateTransaction` / Click `Prepare` da
 * yaratiladi (migratsiya 028, docs/LEGAL-COMPLIANCE.md §18).
 *
 * Protokol holati (state, create/perform/cancel vaqtlari, sabab) shu yerda,
 * PUL qoidalari esa nishonning o'z servisida (buyurtma — `PaymentsService`,
 * to'ldirish — `WalletTopupsService`). Ikki oqim bitta protokol kodidan
 * foydalanadi.
 *
 *  · `(provider, external_id)` unikal — Payme `id` / Click `click_trans_id`.
 *  · Payme: bitta nishonda bir vaqtda faqat bitta `state = 1` tranzaksiya
 *    (`uq_merchant_tx_payme_active_target`) — protokol talabi.
 *  · `seq` — Click `merchant_prepare_id` (butun son) va Payme `transaction`.
 */
@Index('uq_merchant_tx_provider_external', ['provider', 'externalId'], { unique: true })
@Index('uq_merchant_tx_payme_active_target', ['provider', 'targetRef'], {
  unique: true,
  where: `provider = 'payme' AND state = 1`,
})
@Index('idx_merchant_tx_provider_time', ['provider', 'providerTime'])
@Entity('merchant_transactions')
export class MerchantTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  @Generated('increment')
  seq: string;

  @Column({ type: 'varchar', length: 10 })
  provider: MerchantProvider;

  @Column({ name: 'external_id', type: 'varchar', length: 100 })
  externalId: string;

  @Column({ name: 'target_kind', type: 'varchar', length: 10 })
  targetKind: MerchantTargetKind;

  /** Buyurtma UUID'i yoki `topup_<id>`. */
  @Column({ name: 'target_ref', type: 'varchar', length: 100 })
  targetRef: string;

  /** So'mda. */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) },
  })
  amount: number;

  @Column({ type: 'smallint' })
  state: MerchantTxState;

  /** Payme `time` (ms) — GetStatement shu bo'yicha. Click uchun null. */
  @Column({ name: 'provider_time', type: 'bigint', nullable: true, transformer: bigintAsNumber })
  providerTime: number | null;

  /** Payme `account` (GetStatement javobi uchun). */
  @Column({ type: 'jsonb', nullable: true })
  account: Record<string, unknown> | null;

  @Column({ name: 'create_time', type: 'timestamptz' })
  createTime: Date;

  @Column({ name: 'perform_time', type: 'timestamptz', nullable: true })
  performTime: Date | null;

  @Column({ name: 'cancel_time', type: 'timestamptz', nullable: true })
  cancelTime: Date | null;

  /** Payme bekor qilish sababi (1..10) yoki null. */
  @Column({ type: 'smallint', nullable: true })
  reason: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
