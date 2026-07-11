import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Store } from './store.entity';
import { Product } from './product.entity';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { eager: false })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'store_id' })
  storeId: string;

  @ManyToOne(() => Product, { eager: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'int' })
  delta: number;

  @Column({ nullable: true, type: 'varchar' })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
