import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Taksi: bekor qilish, kelmaslik, uzilish (docs/INCIDENT-POLICY.md §5).
 *
 *  · `orders.accepted_at` — bepul bekor qilish oynasi shu lahzadan
 *    (`arrived_at` bilan bir xil: JS `Date`, `timestamp`). Eski qatorlarda
 *    `null` — jarima olinmaydi (xavfsiz tomon).
 *  · `orders.cancelled_at` — kim/qachon bekor qildi (haydovchi bekor qilish
 *    signali kunlik sanaydi; ulashish havolasi muddati).
 *  · `orders.cancellation_fee` — kech bekor qilish / kelmaslik jarimasi.
 *  · `orders.trip_outcome` / `interrupt_reason` — safar uzildi (avariya,
 *    buzilish): shu nuqtagacha narx bilan yakunlangan.
 *  · `transactions` — jarima qatorlari (`taxi_fee_charge_<order>` yo'lovchi
 *    DEBIT, `taxi_fee_payout_<order>` haydovchi CREDIT) buyurtmaga bir marta.
 *  · `incidents.source` — yangi tizim manbalari.
 *  · 5 sozlama — kodda raqam qotirilmaydi.
 */
export class TaxiPenalties1700000005200 implements MigrationInterface {
  name = 'TaxiPenalties1700000005200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "accepted_at" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "cancellation_fee" decimal(12,2) NULL,
      ADD COLUMN IF NOT EXISTS "trip_outcome" varchar(20) NULL,
      ADD COLUMN IF NOT EXISTS "interrupt_reason" varchar(20) NULL`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_trip_outcome"`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_trip_outcome"
      CHECK ("trip_outcome" IS NULL OR "trip_outcome" IN ('interrupted'))`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_orders_driver_cancelled_at" ON "orders" ("driver_id", "cancelled_at")
        WHERE "cancelled_by" = 'driver'`,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_transactions_taxi_fee"
        ON "transactions" ("external_id") WHERE "external_id" LIKE 'taxi_fee_%'
    `);

    await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "chk_incidents_source"`);
    await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "chk_incidents_source"
      CHECK ("source" IN ('user', 'manager', 'rating_signal', 'low_rating', 'driver_cancel_signal', 'trip_interrupted'))`);

    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "free_cancel_minutes" int NOT NULL DEFAULT 2,
      ADD COLUMN IF NOT EXISTS "late_cancel_fee" int NOT NULL DEFAULT 3000,
      ADD COLUMN IF NOT EXISTS "no_show_wait_minutes" int NOT NULL DEFAULT 5,
      ADD COLUMN IF NOT EXISTS "no_show_fee" int NOT NULL DEFAULT 5000,
      ADD COLUMN IF NOT EXISTS "driver_cancel_signal_count" int NOT NULL DEFAULT 3`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      DROP COLUMN IF EXISTS "free_cancel_minutes",
      DROP COLUMN IF EXISTS "late_cancel_fee",
      DROP COLUMN IF EXISTS "no_show_wait_minutes",
      DROP COLUMN IF EXISTS "no_show_fee",
      DROP COLUMN IF EXISTS "driver_cancel_signal_count"`);
    await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "chk_incidents_source"`);
    await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "chk_incidents_source"
      CHECK ("source" IN ('user', 'manager', 'rating_signal', 'low_rating'))`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_transactions_taxi_fee"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_driver_cancelled_at"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_trip_outcome"`);
    await queryRunner.query(`ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "accepted_at",
      DROP COLUMN IF EXISTS "cancelled_at",
      DROP COLUMN IF EXISTS "cancellation_fee",
      DROP COLUMN IF EXISTS "trip_outcome",
      DROP COLUMN IF EXISTS "interrupt_reason"`);
  }
}
