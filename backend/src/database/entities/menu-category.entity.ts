import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';

@Entity('menu_categories')
export class MenuCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Restaurant, { eager: false })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
