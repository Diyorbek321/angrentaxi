import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('tariffs')
export class Tariff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Which vertical this tariff belongs to: 'taxi' | 'cargo' (food/market later).
  @Column({ name: 'service_type', type: 'varchar', default: 'taxi' })
  serviceType: string;

  // For cargo: 'van' | 'small_truck' | 'large_truck'. Null for taxi.
  @Column({ name: 'vehicle_type', type: 'varchar', nullable: true })
  vehicleType: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  basePrice: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pricePerKm: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pricePerMin: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  minPrice: number;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 1,
    default: 1.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  surgeMultiplier: number;

  // Upper cap on the computed price; null = unbounded (preserves pre-existing behavior).
  @Column({
    name: 'max_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value !== null ? parseFloat(value) : null),
    },
  })
  maxPrice: number | null;

  @Column({ default: true })
  isActive: boolean;

  // Ordinal rank among taxi tariffs (1 = Start ... 5 = Biznes) — a driver may
  // serve any tariff at or below their Driver.approvedTariffTier. Meaningless
  // for cargo tariffs (vehicleType set instead), left at the default there.
  @Column({ name: 'tier', type: 'int', default: 1 })
  tier: number;

  // Minimum manufacture year a driver's car must meet to be considered for
  // this tariff, informational only — the actual gate on matching is
  // Driver.approvedTariffTier, which a manager sets after reviewing the car
  // (mirrors Yandex Pro's model: public criteria, per-driver manual vetting).
  @Column({ name: 'min_car_year', type: 'int', nullable: true })
  minCarYear: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
