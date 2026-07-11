import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { MarketCategory } from './market-category.entity';

export enum ProductUnit {
  PIECE = 'dona',
  KG = 'kg',
  LITER = 'litr',
}

export enum ProductStatus {
  ACTIVE = 'active',
  OUT = 'out',
  HIDDEN = 'hidden',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { eager: false })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'store_id' })
  storeId: string;

  @ManyToOne(() => MarketCategory, { eager: false, nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: MarketCategory | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ nullable: true, type: 'varchar' })
  sku: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  price: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({
    type: 'enum',
    enum: ProductUnit,
    default: ProductUnit.PIECE,
  })
  unit: ProductUnit;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  @Column({ type: 'varchar', default: '📦' })
  emoji: string;

  // Hue (0-360) used to render the mock's gradient product swatch — kept as a
  // literal field rather than derived so the same swatch persists across edits.
  @Column({ type: 'int', default: 45 })
  hue: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
