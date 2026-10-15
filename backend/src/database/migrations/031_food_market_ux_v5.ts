import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Food/Market UX v5 (docs/specs/food-market-ux-v5.md).
 *
 *  · `food_orders` / `market_orders`: mijoz bekor qilishi (`cancelled_by`,
 *    `cancel_reason`, `cancelled_at`), promokod (`promo_code_id`,
 *    `promo_code`, `promo_discount` — PLATFORMA hisobidan), aksiya chegirmasi
 *    (`promotion_discount` — SOTUVCHI hisobidan, ma'lumot uchun; qatorlarda
 *    `unitPrice`/`discountAmount`), manzil tafsilotlari (`address_details`).
 *  · `promo_codes.service_types` (jsonb, null = hamma xizmat).
 *  · `promo_code_usages.food_order_id` / `market_order_id` — ovqat/market
 *    buyurtmasidagi ishlatish (`order_id` faqat `orders` ga FK). FK yo'q
 *    (ataylab): ishlatish buyurtma yozilishidan OLDIN band qilinadi.
 *  · `favorite_addresses.address_details`.
 *  · `promotions` — sotuvchi aksiyalari.
 */
export class FoodMarketUxV51700000003100 implements MigrationInterface {
  name = 'FoodMarketUxV51700000003100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "cancelled_by" varchar(20),
        ADD COLUMN IF NOT EXISTS "cancel_reason" varchar(200),
        ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "promo_code_id" uuid,
        ADD COLUMN IF NOT EXISTS "promo_code" varchar(50),
        ADD COLUMN IF NOT EXISTS "promo_discount" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "promotion_discount" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "address_details" jsonb`);
    }

    await queryRunner.query(`ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "service_types" jsonb`);

    await queryRunner.query(`ALTER TABLE "promo_code_usages"
      ADD COLUMN IF NOT EXISTS "food_order_id" uuid,
      ADD COLUMN IF NOT EXISTS "market_order_id" uuid`);

    await queryRunner.query(`ALTER TABLE "favorite_addresses" ADD COLUMN IF NOT EXISTS "address_details" jsonb`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "promotions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "vendor_type" varchar(20) NOT NULL,
      "vendor_id" uuid NOT NULL,
      "title" varchar(60) NOT NULL,
      "description" varchar(200),
      "discount_type" varchar(10) NOT NULL,
      "discount_value" numeric(12,2) NOT NULL,
      "scope" varchar(10) NOT NULL DEFAULT 'all',
      "category_ids" jsonb NOT NULL DEFAULT '[]',
      "item_ids" jsonb NOT NULL DEFAULT '[]',
      "min_order_amount" numeric(12,2),
      "starts_at" timestamptz NOT NULL,
      "ends_at" timestamptz,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_promotions" PRIMARY KEY ("id"),
      CONSTRAINT "chk_promotions_vendor_type" CHECK ("vendor_type" IN ('restaurant', 'store')),
      CONSTRAINT "chk_promotions_discount_type" CHECK ("discount_type" IN ('percent', 'fixed')),
      CONSTRAINT "chk_promotions_scope" CHECK ("scope" IN ('all', 'category', 'items')),
      CONSTRAINT "chk_promotions_discount_value" CHECK ("discount_value" > 0)
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_promotions_vendor" ON "promotions" ("vendor_type", "vendor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "promotions"`);
    await queryRunner.query(`ALTER TABLE "favorite_addresses" DROP COLUMN IF EXISTS "address_details"`);
    await queryRunner.query(`ALTER TABLE "promo_code_usages"
      DROP COLUMN IF EXISTS "market_order_id",
      DROP COLUMN IF EXISTS "food_order_id"`);
    await queryRunner.query(`ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "service_types"`);
    for (const table of ['market_orders', 'food_orders']) {
      await queryRunner.query(`ALTER TABLE "${table}"
        DROP COLUMN IF EXISTS "address_details",
        DROP COLUMN IF EXISTS "promotion_discount",
        DROP COLUMN IF EXISTS "promo_discount",
        DROP COLUMN IF EXISTS "promo_code",
        DROP COLUMN IF EXISTS "promo_code_id",
        DROP COLUMN IF EXISTS "cancelled_at",
        DROP COLUMN IF EXISTS "cancel_reason",
        DROP COLUMN IF EXISTS "cancelled_by"`);
    }
  }
}
