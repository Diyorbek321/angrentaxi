import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A passenger's saved place (Yandex Go's "Uy"/"Ish"/saved-places equivalent).
// No FK relation object is declared (mirrors withdrawal-request.entity.ts'
// driverId-only-to-users pattern) — this table is purely per-user scoped and
// always accessed through userId, never joined.
@Entity('favorite_addresses')
export class FavoriteAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Free text label, e.g. 'Uy', 'Ish', or any custom name the passenger picks.
  @Column({ type: 'varchar', length: 50 })
  label: string;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  lat: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  lng: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
