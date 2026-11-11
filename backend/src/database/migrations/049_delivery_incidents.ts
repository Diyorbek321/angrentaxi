import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Yetkazish hodisalari (docs/INCIDENT-POLICY.md §2).
 *
 *  · `platform_settings` — yetti sozlama (posilka qiymati chegarasi, manzilda
 *    bepul kutish, qaytarish haqi foizi, rad etish chegarasi va oynasi,
 *    "osilib qolgan" yetkazish signali). Kodda raqam qotirilmaydi.
 *
 *  · `orders` — kuryer safarining yetkazish holati. HOLAT ENUM'IGA QIYMAT
 *    QO'SHILMAYDI: qaytarish yo'li `in_progress` ichidagi kichik holat
 *    (`delivery_failed_at` bor = "qaytarilmoqda"), yakuni esa `completed` +
 *    `delivery_outcome = 'returned'`. Sabab — haydovchi bandligi, GPS izi,
 *    daromad/komissiya hisobotlari, matching va ilovalarning holat
 *    tahlilchilari `in_progress`/`completed` ga tayanadi; yangi holatlar
 *    ularning hammasini qayta ko'rib chiqishni talab qilardi.
 *
 *  · `drivers.location_updated_at` — oxirgi GPS ping vaqti ("kuryer
 *    joylashuvi eski" signali uchun).
 *
 *  · `food_orders` / `market_orders` — yangi holatlar `returning`,
 *    `returned` va qaytarish hisob-kitobi ustunlari. ⚠️ `ADD VALUE` tranzaksiya
 *    ichida — qiymat shu migratsiyada ISHLATILMAYDI (035 naqshi).
 */
export class DeliveryIncidents1700000004900 implements MigrationInterface {
  name = 'DeliveryIncidents1700000004900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "parcel_max_declared_value" int NOT NULL DEFAULT 1000000,
      ADD COLUMN IF NOT EXISTS "dropoff_free_wait_minutes" int NOT NULL DEFAULT 5,
      ADD COLUMN IF NOT EXISTS "return_fee_percent" int NOT NULL DEFAULT 50,
      ADD COLUMN IF NOT EXISTS "refusal_cash_block_count" int NOT NULL DEFAULT 2,
      ADD COLUMN IF NOT EXISTS "refusal_window_days" int NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS "stuck_delivery_minutes" int NOT NULL DEFAULT 60,
      ADD COLUMN IF NOT EXISTS "stale_courier_location_minutes" int NOT NULL DEFAULT 10`);

    await queryRunner.query(`ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "dropoff_arrived_at" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "delivery_failed_at" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "delivery_failure_reason" varchar(30) NULL,
      ADD COLUMN IF NOT EXISTS "delivery_outcome" varchar(20) NULL,
      ADD COLUMN IF NOT EXISTS "returned_at" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "stuck_flagged_at" timestamptz NULL`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_delivery_failure_reason"`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_delivery_failure_reason"
      CHECK ("delivery_failure_reason" IS NULL OR "delivery_failure_reason" IN ('customer_absent', 'customer_refused', 'unreachable'))`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_delivery_outcome"`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_delivery_outcome"
      CHECK ("delivery_outcome" IS NULL OR "delivery_outcome" IN ('returned'))`);
    // Rad etishlar sanog'i (naqd blok) — mijoz bo'yicha, faqat muvaffaqiyatsiz yetkazishlar.
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_passenger_delivery_failed"
      ON "orders" ("passenger_id", "delivery_failed_at") WHERE "delivery_failed_at" IS NOT NULL`);

    await queryRunner.query(`ALTER TABLE "drivers"
      ADD COLUMN IF NOT EXISTS "location_updated_at" timestamptz NULL`);

    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`ALTER TYPE "public"."${table}_status_enum" ADD VALUE IF NOT EXISTS 'returning'`);
      await queryRunner.query(`ALTER TYPE "public"."${table}_status_enum" ADD VALUE IF NOT EXISTS 'returned'`);
      await queryRunner.query(`ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "returned_at" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "return_charge" decimal(12,2) NULL,
        ADD COLUMN IF NOT EXISTS "refund_due" decimal(12,2) NULL,
        ADD COLUMN IF NOT EXISTS "refund_status" varchar(20) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enum qiymatlarini Postgres'da olib tashlab bo'lmaydi — ular qoladi.
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`ALTER TABLE "${table}"
        DROP COLUMN IF EXISTS "returned_at",
        DROP COLUMN IF EXISTS "return_charge",
        DROP COLUMN IF EXISTS "refund_due",
        DROP COLUMN IF EXISTS "refund_status"`);
    }
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN IF EXISTS "location_updated_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_passenger_delivery_failed"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_delivery_outcome"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_delivery_failure_reason"`);
    await queryRunner.query(`ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "dropoff_arrived_at",
      DROP COLUMN IF EXISTS "delivery_failed_at",
      DROP COLUMN IF EXISTS "delivery_failure_reason",
      DROP COLUMN IF EXISTS "delivery_outcome",
      DROP COLUMN IF EXISTS "returned_at",
      DROP COLUMN IF EXISTS "stuck_flagged_at"`);
    await queryRunner.query(`ALTER TABLE "platform_settings"
      DROP COLUMN IF EXISTS "parcel_max_declared_value",
      DROP COLUMN IF EXISTS "dropoff_free_wait_minutes",
      DROP COLUMN IF EXISTS "return_fee_percent",
      DROP COLUMN IF EXISTS "refusal_cash_block_count",
      DROP COLUMN IF EXISTS "refusal_window_days",
      DROP COLUMN IF EXISTS "stuck_delivery_minutes",
      DROP COLUMN IF EXISTS "stale_courier_location_minutes"`);
  }
}
