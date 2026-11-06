import { MigrationInterface, QueryRunner } from 'typeorm';

// Documents the production schema for the tariff-approval / promo-code / driver-bonus
// feature set. NOTE: dev environments run with DB_SYNC (TypeORM synchronize) on, so this
// migration is not what actually creates the schema locally — it exists for the
// DB_SYNC=false production path (same drift already present between 001 and the entities).
export class TariffPromoBonus1700000000002 implements MigrationInterface {
  name = 'TariffPromoBonus1700000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Tariff: max price cap
    await queryRunner.query(`
      ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS max_price DECIMAL(10, 2);
    `);

    // Orders: promo code + driver earnings
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id),
        ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS driver_earning DECIMAL(10, 2);
    `);

    // Tariff change requests (manager-propose / admin-approve workflow)
    await queryRunner.query(`
      CREATE TYPE tariff_change_action_enum AS ENUM ('create', 'update');
    `);
    await queryRunner.query(`
      CREATE TYPE tariff_change_request_status_enum AS ENUM ('pending', 'approved', 'rejected');
    `);
    await queryRunner.query(`
      CREATE TABLE tariff_change_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action tariff_change_action_enum NOT NULL,
        tariff_id UUID REFERENCES tariffs(id),
        proposed_changes JSONB NOT NULL,
        previous_values JSONB,
        status tariff_change_request_status_enum NOT NULL DEFAULT 'pending',
        proposed_by UUID NOT NULL REFERENCES users(id),
        reviewed_by UUID REFERENCES users(id),
        review_note VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tariff_change_requests_status ON tariff_change_requests (status);
    `);

    // Driver bonus rules + ledger reuse (Transaction.bonus_rule_id) + award idempotency index
    await queryRunner.query(`
      CREATE TYPE bonus_rule_type_enum AS ENUM ('trip_count', 'weekly_goal');
    `);
    await queryRunner.query(`
      CREATE TYPE bonus_rule_status_enum AS ENUM ('active', 'inactive');
    `);
    await queryRunner.query(`
      CREATE TABLE driver_bonus_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        rule_type bonus_rule_type_enum NOT NULL,
        trip_threshold INTEGER NOT NULL,
        bonus_amount DECIMAL(10, 2) NOT NULL,
        service_type VARCHAR,
        status bonus_rule_status_enum NOT NULL DEFAULT 'active',
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bonus_rule_id UUID REFERENCES driver_bonus_rules(id);
    `);

    await queryRunner.query(`
      CREATE TABLE driver_bonus_awards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bonus_rule_id UUID NOT NULL REFERENCES driver_bonus_rules(id),
        driver_id UUID NOT NULL REFERENCES users(id),
        period_key VARCHAR NOT NULL,
        transaction_id UUID NOT NULL REFERENCES transactions(id),
        awarded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (bonus_rule_id, driver_id, period_key)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS driver_bonus_awards CASCADE;`);
    await queryRunner.query(`ALTER TABLE transactions DROP COLUMN IF EXISTS bonus_rule_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS driver_bonus_rules CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS bonus_rule_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS bonus_rule_type_enum;`);

    await queryRunner.query(`DROP TABLE IF EXISTS tariff_change_requests CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS tariff_change_request_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS tariff_change_action_enum;`);

    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN IF EXISTS driver_earning,
        DROP COLUMN IF EXISTS discount_amount,
        DROP COLUMN IF EXISTS promo_code_id;
    `);

    await queryRunner.query(`ALTER TABLE tariffs DROP COLUMN IF EXISTS max_price;`);
  }
}
