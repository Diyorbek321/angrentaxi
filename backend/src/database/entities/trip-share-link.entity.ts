import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Yo'lovchining "safarni ulashish" havolasi (INCIDENT-POLICY §4, migratsiya
 * 051). Token o'zi saqlanmaydi — faqat SHA-256 xeshi. Muddat jadvalda emas:
 * safar tugagan lahza + `tripShareGraceMinutes` (`trip-share-policy.ts`).
 */
@Index('uq_trip_share_links_token_hash', ['tokenHash'], { unique: true })
@Index('idx_trip_share_links_order', ['orderId'])
@Entity('trip_share_links')
export class TripShareLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
