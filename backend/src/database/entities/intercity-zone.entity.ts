import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IntercityPoint } from './intercity-point.entity';

const decimal = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};

/**
 * "Shahar ichiga davom" hududidagi tuman (Yunusobod, Chilonzor...) —
 * migratsiya 039.
 *
 * Haydovchi e'londa tumanlarni tanlaydi; yo'lovchi manzili tanlangan
 * tumanlardan tashqarida bo'lsa, u bu qatnovni band qila olmaydi —
 * bir mashinadagi yo'lovchilar shaharning qarama-qarshi chekkalariga
 * tarqalmaydi. Markaz + radius (`City` bilan bir xil sabab: admin bitta
 * formadan boshqaradi, poligon muharriri kerak emas).
 */
@Index('uq_intercity_zones_point_name', ['pointId', 'name'], { unique: true })
@Check('chk_intercity_zones_radius', '"radius_km" > 0 AND "radius_km" <= 30')
@Entity('intercity_zones')
export class IntercityZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'point_id', type: 'uuid' })
  pointId: string;

  @ManyToOne(() => IntercityPoint, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'point_id', foreignKeyConstraintName: 'fk_intercity_zones_point' })
  point?: IntercityPoint;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'center_lat', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  centerLat: number;

  @Column({ name: 'center_lng', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  centerLng: number;

  @Column({ name: 'radius_km', type: 'decimal', precision: 5, scale: 2, transformer: decimal })
  radiusKm: number;

  // Faol emas — yangi e'londa tanlanmaydi; qator O'CHIRILMAYDI (eski
  // qatnovlar unga bog'langan).
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
