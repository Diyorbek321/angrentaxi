import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Huquqiy/biznes bosqich 2 (2026-10-15) — docs/LEGAL-COMPLIANCE.md §7–9.
 *
 *  · Sotuvchi bilan hamyon orqali hisob-kitob — e-tijorat qonuniga
 *    o'zgartishlar (10.09.2026, kuchga kirishi 2026-12-12), 23-modda:
 *    `platform_settings.vendor_settlement_mode` ('cash' | 'wallet'),
 *    `vendor_wallet_settlement_from` (standart 2026-12-12 00:00 Toshkent),
 *    `food_orders/market_orders.vendor_wallet_settled_at` va o'tkazma
 *    qatorlarining bir martaligi uchun unikal qisman indeks.
 *  · Haydovchi smenasi (kunlik obuna): sozlamalar va `driver_shift_passes`.
 *
 * ⚠️ STANDART HOLATDA BUGUN HECH NARSA O'ZGARMAYDI: rejim 'cash', sana
 * kelajakda, smena o'chiq. 2026-12-12 dan hamyon rejimi o'z-o'zidan yoqiladi.
 *
 * `IF NOT EXISTS` — dev muhitida `synchronize` ularni entity'dan oldinroq
 * yaratgan bo'lishi mumkin (025 bilan bir xil).
 */
const SETTINGS_COLUMNS: readonly string[] = [
  `"vendor_settlement_mode" character varying(10) NOT NULL DEFAULT 'cash'`,
  `"vendor_wallet_settlement_from" TIMESTAMP WITH TIME ZONE DEFAULT '2026-12-12 00:00:00+05'`,
  `"shift_pass_enabled" boolean NOT NULL DEFAULT false`,
  `"shift_pass_price" numeric(12,2) NOT NULL DEFAULT 25000`,
  `"shift_pass_duration_hours" integer NOT NULL DEFAULT 24`,
  `"shift_pass_service_types" jsonb NOT NULL DEFAULT '["taxi"]'`,
];

const columnName = (definition: string): string => definition.split('"')[1];

export class VendorWalletAndShiftPass1700000002600 implements MigrationInterface {
  name = 'VendorWalletAndShiftPass1700000002600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of SETTINGS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS ${column}`);
    }
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "vendor_wallet_settled_at" TIMESTAMP WITH TIME ZONE`,
      );
    }
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_transactions_vendor_settlement"
        ON "transactions" ("external_id") WHERE external_id LIKE 'vendor_settlement_%'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "driver_shift_passes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL,
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "price" numeric(12,2) NOT NULL,
        "status" character varying(10) NOT NULL DEFAULT 'active',
        "service_types" jsonb NOT NULL DEFAULT '["taxi"]',
        "transaction_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_driver_shift_passes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_driver_shift_passes_driver" FOREIGN KEY ("driver_id")
          REFERENCES "users"("id"),
        CONSTRAINT "CHK_driver_shift_passes_window" CHECK ("ends_at" > "starts_at")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_driver_shift_passes_driver_ends"
        ON "driver_shift_passes" ("driver_id", "ends_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_driver_shift_passes_starts" ON "driver_shift_passes" ("starts_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "driver_shift_passes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_transactions_vendor_settlement"`);
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "vendor_wallet_settled_at"`);
    }
    for (const column of SETTINGS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "${columnName(column)}"`);
    }
  }
}
