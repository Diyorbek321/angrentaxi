import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export const SAVED_CARD_PROVIDERS = ['payme', 'click'] as const;
export type SavedCardProvider = (typeof SAVED_CARD_PROVIDERS)[number];

export const CARD_BRANDS = ['uzcard', 'humo', 'visa', 'mastercard', 'unknown'] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];

export type SavedCardStatus = 'active' | 'removed';

/**
 * Yo'lovchining bog'langan kartasi (migratsiya 056).
 *
 * Faqat provayder tokeni (shifrlangan) va niqob saqlanadi — karta raqami,
 * CVV, egasining ismi hech qachon serverga kelmaydi. O'chirish — soft:
 * qator tugagan to'lovlar auditi uchun qoladi.
 */
@Index('idx_saved_cards_user_status', ['userId', 'status'])
// Qisman unikal indekslar entity'da ham (synchronize o'chirmasin).
@Index('uq_saved_cards_active_fingerprint', ['userId', 'provider', 'tokenFingerprint'], {
  unique: true,
  where: `"status" = 'active'`,
})
@Index('uq_saved_cards_one_default', ['userId'], {
  unique: true,
  where: `"is_default" = true AND "status" = 'active'`,
})
@Entity('saved_cards')
export class SavedCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 16, default: 'payme' })
  provider: SavedCardProvider;

  /** `iv:tag:ciphertext` (hex), `card-token-crypto.ts`. API javobiga HECH QACHON chiqmaydi. */
  @Column({ name: 'encrypted_token', type: 'varchar', length: 1024, select: false })
  encryptedToken: string;

  /** sha256(token) — dublikatni aniqlash uchun. */
  @Column({ name: 'token_fingerprint', type: 'varchar', length: 64, select: false })
  tokenFingerprint: string;

  @Column({ name: 'masked_pan', type: 'varchar', length: 24 })
  maskedPan: string;

  @Column({ name: 'card_brand', type: 'varchar', length: 16, default: 'unknown' })
  cardBrand: CardBrand;

  /** `MM/YY` — provayder bersa. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  expiry: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: SavedCardStatus;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  /** Ketma-ket muvaffaqiyatsiz yechishlar; chegaraga yetsa karta o'chiriladi. */
  @Column({ name: 'failed_charge_count', type: 'int', default: 0 })
  failedChargeCount: number;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
