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

  @Column({ name: 'platform_name', type: 'varchar', default: 'Angren Taxi' })
  platformName: string;

  @Column({ name: 'support_phone', type: 'varchar', default: '+998 71 200 00 00' })
  supportPhone: string;

  @Column({ name: 'support_email', type: 'varchar', default: 'support@angrentaxi.uz' })
  supportEmail: string;

  // Stored and toggleable from Super Admin > Global Settings, but NOT yet
  // enforced by any request-blocking guard — flipping this only changes what
  // the setting reads back as. Wiring real traffic-blocking enforcement on a
  // live, deployed app is a separate, deliberate decision (see the PR/task
  // notes) rather than something to silently switch on.
  // Flat delivery fee added to every food/market order, in so'm.
  //
  // This lived only in the mobile app as `SuperappProvider._deliveryFee =
  // 7000`, so the passenger was shown a total the server never recorded: the
  // order row, the vendor's board and the receipt were all 7000 lower than
  // the figure at checkout. The server owns it now.
  @Column({
    name: 'delivery_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 7000,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  deliveryFee: number;

  @Column({ name: 'maintenance_mode', type: 'boolean', default: false })
  maintenanceMode: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
