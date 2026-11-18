import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Huquqiy hujjat roziligi — bitta qator = bitta foydalanuvchi bitta hujjatning
 * bitta VERSIYASINI qabul qildi (migratsiya 048, `modules/legal/legal-versions.ts`).
 *
 * NEGA JADVAL, `users` USTUNI EMAS: ustun eski rozilikni ustidan yozib
 * yuborardi. Nizoda esa "shu odam shu sanada AYNAN qaysi tahrirga rozi
 * bo'lgan, qaysi IP/qurilmadan" degan dalil kerak — ya'ni tarix. To'rtta
 * hujjat × N versiya ustunlar bilan ifodalanmaydi. Qatorlar faqat INSERT
 * qilinadi (o'zgartirilmaydi).
 *
 * `(user_id, document, version)` unikal — takror bosish yangi qator yaratmaydi.
 */
@Index('uq_legal_acceptances_user_doc_version', ['userId', 'document', 'version'], { unique: true })
@Index('idx_legal_acceptances_doc_version', ['document', 'version'])
@Entity('legal_acceptances')
export class LegalAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_legal_acceptances_user' })
  user?: User;

  /** `terms` | `driver-terms` | `vendor-terms` | `privacy`. */
  @Column({ type: 'varchar', length: 32 })
  document: string;

  /** `YYYY-MM-DD.N`. */
  @Column({ type: 'varchar', length: 32 })
  version: string;

  @CreateDateColumn({ name: 'accepted_at', type: 'timestamptz' })
  acceptedAt: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 256, nullable: true })
  userAgent: string | null;

  /** Qayerda rozi bo'ldi: `login` (kirish ekrani) yoki `sheet` (rozilik oynasi). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  source: string | null;
}
