import { MigrationInterface, QueryRunner } from 'typeorm';

// Extends the driver wallet/commission model (003_driver_wallet.ts) to Market
// and Food vendors: a per-store commission rate (Restaurant already got one
// in 005_food.ts), a payment method on market orders (Food already had one),
// and an owner-type tag on withdrawal requests so the existing MVP payout
// queue (008_withdrawal_requests.ts) can serve vendors/restaurants alongside
// drivers. Dev environments run with DB_SYNC on; this documents the
// production path.
export class VendorCommissionSettlement1700000000016 implements MigrationInterface {
  name = 'VendorCommissionSettlement1700000000016';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stores
        ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 10.00;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE market_payment_method_enum AS ENUM ('cash', 'card');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE market_orders
        ADD COLUMN IF NOT EXISTS payment_method market_payment_method_enum NOT NULL DEFAULT 'cash';
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE withdrawal_owner_type_enum AS ENUM ('driver', 'vendor', 'restaurant');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE withdrawal_requests
        ADD COLUMN IF NOT EXISTS owner_type withdrawal_owner_type_enum NOT NULL DEFAULT 'driver';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE withdrawal_requests DROP COLUMN IF EXISTS owner_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS withdrawal_owner_type_enum;`);

    await queryRunner.query(`ALTER TABLE market_orders DROP COLUMN IF EXISTS payment_method;`);
    await queryRunner.query(`DROP TYPE IF EXISTS market_payment_method_enum;`);

    await queryRunner.query(`ALTER TABLE stores DROP COLUMN IF EXISTS commission_rate;`);
  }
}
