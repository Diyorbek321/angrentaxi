import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Single-row table for platform-wide config. Read/created lazily by
// SettingsService.getOrCreate() rather than a seed migration.
@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 10.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  defaultCommissionRate: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
