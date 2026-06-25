import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PromoCode } from './promo_code.entity';
import { User } from './user.entity';
import { Order } from './order.entity';

@Entity('promo_code_usages')
@Unique(['promoCodeId', 'userId'])
export class PromoCodeUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PromoCode, { eager: false })
  @JoinColumn({ name: 'promo_code_id' })
  promoCode: PromoCode;

  @Column({ name: 'promo_code_id' })
  promoCodeId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Order, { eager: false, nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ name: 'order_id', nullable: true, type: 'uuid' })
  orderId: string | null;

  @CreateDateColumn({ name: 'used_at' })
  usedAt: Date;
}
