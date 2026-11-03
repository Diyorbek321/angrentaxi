import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Shikoyat va hodisa — yagona jadval (docs/INCIDENT-POLICY.md §3, migratsiya 050).
 *
 *   open ──(menejer oladi)──▶ investigating ──▶ resolved | rejected
 *                                   ▲                │
 *                                   └── e'tiroz ─────┘ (bir marta, `appealedAt`)
 *
 * BUYURTMA POLIMORF: `orderVertical` + `orderId` — taksi/posilka/yuk
 * (`orders`), ovqat (`food_orders`) yoki market (`market_orders`). Shu sabab
 * `order_id` ga FK yo'q; tekshiruv yaratishda servisda.
 */
export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export type IncidentVertical = 'taxi' | 'food' | 'market';

/** Kim ochdi: foydalanuvchi, menejer, yoki tizim signali. */
export type IncidentSource = 'user' | 'manager' | 'rating_signal' | 'low_rating';

export type IncidentPartyRole = 'passenger' | 'driver' | 'vendor' | 'manager' | 'system';

export type IncidentOutcomeType =
  | 'warning'
  | 'suspension'
  | 'block'
  | 'refund'
  | 'compensation'
  | 'penalty'
  | 'no_action';

/** Bajarilgan natija — audit yozuvi bilan bir tranzaksiyada saqlanadi. */
export interface IncidentOutcomeRecord {
  type: IncidentOutcomeType;
  /** Pul natijalarida, so'm. */
  amount?: number;
  /** Kimga: foydalanuvchi id (refund — mijoz, compensation — haydovchi, ...). */
  targetUserId?: string | null;
  /** refund: `wallet` (hamyon) yoki `card` (qo'lda karta qaytarish navbati). */
  refundMethod?: 'wallet' | 'card';
  /** suspension: kun va tugash vaqti (ISO). */
  days?: number;
  until?: string;
  /** Tizim qo'ygan (xavfsizlik toifasi) — admin qaroridan keyin olib tashlanishi mumkin. */
  automatic?: boolean;
  /** To'xtatish olib tashlangan vaqt (ISO). */
  liftedAt?: string;
  auditLogId: string | null;
  actorUserId: string | null;
  at: string;
}

@Index('idx_incidents_status_created', ['status', 'createdAt'])
@Index('idx_incidents_subject_resolved', ['subjectUserId', 'resolvedAt'])
@Index('idx_incidents_order', ['orderVertical', 'orderId'])
@Index('idx_incidents_reporter_created', ['reporterUserId', 'createdAt'])
@Index('uq_incidents_open_reporter_order', ['reporterUserId', 'orderVertical', 'orderId'], {
  unique: true,
  where: `"source" = 'user' AND "status" IN ('open', 'investigating') AND "reporter_user_id" IS NOT NULL AND "order_id" IS NOT NULL`,
})
@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `null` — tizim (reyting signali). */
  @Column({ name: 'reporter_user_id', type: 'uuid', nullable: true })
  reporterUserId: string | null;

  @Column({ name: 'reporter_role', type: 'varchar', length: 20 })
  reporterRole: IncidentPartyRole;

  @Column({ name: 'subject_user_id', type: 'uuid', nullable: true })
  subjectUserId: string | null;

  @Column({ name: 'subject_role', type: 'varchar', length: 20, nullable: true })
  subjectRole: IncidentPartyRole | null;

  @Column({ name: 'order_vertical', type: 'varchar', length: 10, nullable: true })
  orderVertical: IncidentVertical | null;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', length: 30 })
  category: string;

  @Column({ type: 'varchar', length: 1000 })
  description: string;

  /** Saqlash kalitlari (`incident-photos/<uuid>.<ext>`), ≤ 3. Hech qachon ochiq URL emas. */
  @Column({ name: 'photo_keys', type: 'jsonb', default: () => `'[]'` })
  photoKeys: string[];

  @Column({ type: 'varchar', length: 20, default: IncidentStatus.OPEN })
  status: IncidentStatus;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  source: IncidentSource;

  /** Past baho qoralamasi (`source = 'low_rating'`) — qaysi baho. */
  @Column({ name: 'rating_id', type: 'uuid', nullable: true })
  ratingId: string | null;

  @Column({ name: 'assigned_manager_id', type: 'uuid', nullable: true })
  assignedManagerId: string | null;

  @Column({ name: 'resolution_note', type: 'varchar', length: 1000, nullable: true })
  resolutionNote: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  /** Jarima zinapoyasi shu bayroq bo'yicha sanaydi (§3). */
  @Column({ name: 'confirmed_against_subject', type: 'boolean', default: false })
  confirmedAgainstSubject: boolean;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  outcomes: IncidentOutcomeRecord[];

  /** Xavfsizlik toifasi — subyekt darhol to'xtatilgan, admin qaror qiladi. */
  @Column({ name: 'safety_suspended', type: 'boolean', default: false })
  safetySuspended: boolean;

  /** Faqat admin hal qiladi (xavfsizlik, blok pog'onasi, e'tiroz). */
  @Column({ name: 'escalated_to_admin', type: 'boolean', default: false })
  escalatedToAdmin: boolean;

  @Column({ name: 'appealed_at', type: 'timestamptz', nullable: true })
  appealedAt: Date | null;

  @Column({ name: 'appeal_note', type: 'varchar', length: 1000, nullable: true })
  appealNote: string | null;

  /** `upheld` — natija qoldi, `overturned` — bekor qilindi. */
  @Column({ name: 'appeal_decision', type: 'varchar', length: 20, nullable: true })
  appealDecision: 'upheld' | 'overturned' | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
