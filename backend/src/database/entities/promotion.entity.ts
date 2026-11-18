import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PromotionVendorType {
  RESTAURANT = 'restaurant',
  STORE = 'store',
}

export enum PromotionDiscountType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

export enum PromotionScope {
  ALL = 'all',
  CATEGORY = 'category',
  ITEMS = 'items',
}

const money = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};

/**
 * Sotuvchi aksiyasi (migratsiya 031, docs/specs/food-market-ux-v5.md §4).
 *
 * Restoran/do'kon o'zi yaratadi; chegirma SOTUVCHI hisobidan — buyurtma
 * qatoriga chegirmali narx yoziladi, komissiya va fiskal chek shu narxdan
 * (`promotions/promotion-pricing.ts`). `vendorId` — `restaurants.id` yoki
 * `stores.id` (`vendorType` ga qarab), shu sabab FK yo'q.
 */
@Index('idx_promotions_vendor', ['vendorType', 'vendorId'])
@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_type', type: 'varchar', length: 20 })
  vendorType: PromotionVendorType;

  @Column({ name: 'vendor_id', type: 'uuid' })
  vendorId: string;

  @Column({ type: 'varchar', length: 60 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @Column({ name: 'discount_type', type: 'varchar', length: 10 })
  discountType: PromotionDiscountType;

  @Column({ name: 'discount_value', type: 'decimal', precision: 12, scale: 2, transformer: money })
  discountValue: number;

  @Column({ type: 'varchar', length: 10, default: PromotionScope.ALL })
  scope: PromotionScope;

  @Column({ name: 'category_ids', type: 'jsonb', default: () => "'[]'" })
  categoryIds: string[];

  @Column({ name: 'item_ids', type: 'jsonb', default: () => "'[]'" })
  itemIds: string[];

  @Column({
    name: 'min_order_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: money,
  })
  minOrderAmount: number | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
