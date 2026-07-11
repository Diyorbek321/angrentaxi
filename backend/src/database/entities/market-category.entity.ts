import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Store } from './store.entity';

@Entity('market_categories')
export class MarketCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { eager: false })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'store_id' })
  storeId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', default: '🛒' })
  emoji: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
