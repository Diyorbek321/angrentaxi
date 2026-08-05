import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { MenuCategory } from './menu-category.entity';

// Menus are always read per restaurant — the owner's dish list
// (`where: { restaurantId }`), the public menu (`{ restaurantId,
// isAvailable }`) and cart validation all scope by restaurant_id first.
@Index('idx_dishes_restaurant_id_is_available', ['restaurantId', 'isAvailable'])
@Entity('dishes')
export class Dish {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Restaurant, { eager: false })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => MenuCategory, { eager: false, nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: MenuCategory | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar' })
  name: string;

  // Named "description" not "desc" — DESC is a reserved SQL keyword and
  // breaks unquoted raw SQL (seed scripts, migrations).
  @Column({ nullable: true, type: 'varchar' })
  description: string | null;

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

  @Column({ name: 'prep_minutes', type: 'int', default: 10 })
  prepMinutes: number;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
