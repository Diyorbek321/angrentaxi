import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Order } from './order.entity';

// RatingsService.getDriverRatingStats groups a driver's whole rating history
// by score, and the driver profile screen calls it on every open.
// No separate order_id index: the @Unique below already creates a composite
// index whose leading column is order_id, which serves both the per-order
// listing (`where: { orderId }`) and the duplicate-rating check.
@Entity('ratings')
@Unique(['orderId', 'fromUserId'])
@Index('idx_ratings_to_user_id', ['toUserId'])
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { eager: false })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'from_user_id' })
  fromUser: User;

  @Column({ name: 'from_user_id' })
  fromUserId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'to_user_id' })
  toUser: User;

  @Column({ name: 'to_user_id' })
  toUserId: string;

  @Column({ type: 'varchar', length: 20 })
  fromRole: 'passenger' | 'driver';

  @Column({ type: 'smallint' })
  score: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
