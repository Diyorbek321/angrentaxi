import { MigrationInterface, QueryRunner } from 'typeorm';

// Car-year-gated tariff tiers, modeled on Yandex Pro's public tariff
// structure (Start/Standart/Komfort/Komfort+/Biznes) — see Tariff.tier and
// Driver.approvedTariffTier for the enforcement model: a manager reviews a
// driver's car and sets how high a tier they may be matched against.
export class TariffTiers1700000000020 implements MigrationInterface {
  name = 'TariffTiers1700000000020';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS tier INT NOT NULL DEFAULT 1;
      ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS min_car_year INT;
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS car_year INT;
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS approved_tariff_tier INT NOT NULL DEFAULT 1;
    `);

    // Rename/re-tier the 3 existing taxi tariffs (001_initial_schema) to the
    // Uzbek naming and 5-tier scheme; min_car_year is informational (shown to
    // drivers/managers), not itself enforced — Driver.approved_tariff_tier is
    // the actual matching gate.
    await queryRunner.query(`
      UPDATE tariffs SET name = 'Standart', tier = 2, min_car_year = EXTRACT(YEAR FROM NOW())::int - 15
        WHERE name = 'Standard' AND service_type = 'taxi';
      UPDATE tariffs SET name = 'Komfort', tier = 3, min_car_year = EXTRACT(YEAR FROM NOW())::int - 10
        WHERE name = 'Comfort' AND service_type = 'taxi';
      UPDATE tariffs SET name = 'Biznes', tier = 5, min_car_year = EXTRACT(YEAR FROM NOW())::int - 5
        WHERE name = 'Business' AND service_type = 'taxi';
    `);

    // New tiers: Start (below Standart, no car-age requirement) and Komfort+
    // (between Komfort and Biznes). Pricing interpolated from the existing
    // Standard/Comfort/Business rows.
    await queryRunner.query(`
      INSERT INTO tariffs (name, service_type, base_price, price_per_km, price_per_min, min_price, tier, min_car_year, is_active)
      SELECT 'Start', 'taxi', 2000, 1200, 150, 4000, 1, NULL, true
      WHERE NOT EXISTS (SELECT 1 FROM tariffs WHERE name = 'Start' AND service_type = 'taxi');

      INSERT INTO tariffs (name, service_type, base_price, price_per_km, price_per_min, min_price, tier, min_car_year, is_active)
      SELECT 'Komfort+', 'taxi', 6500, 3200, 400, 11000, 4, EXTRACT(YEAR FROM NOW())::int - 7, true
      WHERE NOT EXISTS (SELECT 1 FROM tariffs WHERE name = 'Komfort+' AND service_type = 'taxi');
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tariffs WHERE name IN ('Start', 'Komfort+') AND service_type = 'taxi';
      UPDATE tariffs SET name = 'Standard' WHERE name = 'Standart' AND service_type = 'taxi';
      UPDATE tariffs SET name = 'Comfort' WHERE name = 'Komfort' AND service_type = 'taxi';
      UPDATE tariffs SET name = 'Business' WHERE name = 'Biznes' AND service_type = 'taxi';
      ALTER TABLE drivers DROP COLUMN IF EXISTS approved_tariff_tier;
      ALTER TABLE drivers DROP COLUMN IF EXISTS car_year;
      ALTER TABLE tariffs DROP COLUMN IF EXISTS min_car_year;
      ALTER TABLE tariffs DROP COLUMN IF EXISTS tier;
    `);
  }
}
