import { MigrationInterface, QueryRunner } from 'typeorm';

// Documents the production schema for the driver wallet/commission feature.
// NOTE: dev environments run with DB_SYNC (TypeORM synchronize) on, so this
// migration is not what actually creates the schema locally — it exists for
// the DB_SYNC=false production path (see 002_tariff_promo_bonus.ts).
export class DriverWallet1700000000003 implements MigrationInterface {
  name = 'DriverWallet1700000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE drivers
        ADD COLUMN IF NOT EXISTS balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        default_commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS platform_settings CASCADE;`);
    await queryRunner.query(`
      ALTER TABLE drivers
        DROP COLUMN IF EXISTS commission_rate,
        DROP COLUMN IF EXISTS balance;
    `);
  }
}
