import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ nullable: true, type: 'varchar' })
  carModel: string | null;

  @Column({ nullable: true, type: 'varchar' })
  carNumber: string | null;

  @Column({ nullable: true, type: 'varchar' })
  licensePlate: string | null;

  // Manufacture year, self-reported at application time — informational
  // input to the manager's tariff-tier review, not itself enforced anywhere.
  @Column({ name: 'car_year', type: 'int', nullable: true })
  carYear: number | null;

  // Highest Tariff.tier this driver may be matched against (1 = Start ...
  // 5 = Biznes). A manager sets this after reviewing carYear/photos — new
  // drivers default to 1 (Start only) until vetted higher, mirroring Yandex
  // Pro's "check with your partner manager" model.
  @Column({ name: 'approved_tariff_tier', type: 'int', default: 1 })
  approvedTariffTier: number;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 5.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  rating: number;

  @Column({ default: false })
  isOnline: boolean;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  balance: number;

  // Per-driver commission override (percent, e.g. 5 for a driver carrying ads
  // who pays a reduced rate). Null means "use the platform default rate".
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  commissionRate: number | null;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
