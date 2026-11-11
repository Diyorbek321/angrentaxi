import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Umumiy amallar jurnali (migratsiya 027): pulga tegadigan qo'lda amallar —
 * hamyonni qo'lda to'ldirish/tuzatish, smenani bekor qilish va h.k.
 *
 * NEGA `dispatch_overrides` emas: u faqat buyurtmani qayta biriktirish
 * uchun (order_id, new_driver_id NOT NULL) — balans tuzatishini u yerga
 * yozib bo'lmaydi.
 */
@Index('idx_audit_logs_created', ['createdAt'])
@Index('idx_audit_logs_target', ['targetType', 'targetId'])
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Amalni bajargan xodim (`users.id`); tizim amali bo'lsa `null`. */
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  /** Masalan `wallet.manual_adjustment`, `shift_pass.cancel`. */
  @Column({ type: 'varchar', length: 50 })
  action: string;

  /** `driver`, `shift_pass`, ... */
  @Column({ name: 'target_type', type: 'varchar', length: 30 })
  targetType: string;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  amount: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
