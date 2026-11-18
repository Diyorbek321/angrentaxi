import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Saytdan kelgan ariza turi. */
export const LEAD_TYPES = ['driver', 'courier', 'partner'] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

/** new → contacted → accepted | rejected (menejer qo'lda o'tkazadi). */
export const LEAD_STATUSES = ['new', 'contacted', 'accepted', 'rejected'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Turga xos maydonlar — har biri ixtiyoriy, DTO tekshiradi. */
export interface LeadDetails {
  carModel?: string;
  carYear?: number;
  vehicle?: string;
  businessName?: string;
  businessType?: string;
  address?: string;
  comment?: string;
}

/**
 * Korporativ saytdagi "Haydovchi / Kuryer / Hamkor bo'lish" arizasi.
 *
 * Foydalanuvchi hisobi emas: odam hali ilovada yo'q. Menejer qo'ng'iroq
 * qilib, keyin oddiy KYC oqimiga yo'naltiradi. IP saqlanmaydi (ortiqcha
 * shaxsiy ma'lumot) — spamga qarshi throttle + honeypot + 24 soatlik dublikat.
 */
@Index('idx_leads_status_created', ['status', 'createdAt'])
@Index('idx_leads_phone_type', ['phone', 'type'])
@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: LeadType;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Normallashtirilgan: +998XXXXXXXXX. */
  @Column({ type: 'varchar', length: 16 })
  phone: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details: LeadDetails;

  @Column({ type: 'varchar', length: 2, default: 'uz' })
  lang: string;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: LeadStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Shaxsiy ma'lumotni qayta ishlashga rozilik vaqti (majburiy). */
  @Column({ name: 'consent_at', type: 'timestamptz' })
  consentAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
