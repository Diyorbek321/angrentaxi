import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * POSILKA (2-versiya) — shahar ichida buyum/hujjat yetkazish.
 *
 * 1. `orders.service_type` enum'iga `parcel`.
 * 2. Topshirish PIN kodi va noto'g'ri urinishlar hisobi.
 * 3. Boshlang'ich "Posilka" tarifi — usiz posilka buyurtmasi berib bo'lmaydi.
 *    Narxlar BOSHLANG'ICH taxmin: admin panelida (Tariflar) o'zgartiriladi.
 *    Bunday tarif allaqachon bo'lsa (masalan admin qo'lda yaratgan) — tegilmaydi.
 */
export class ParcelDelivery1700000001400 implements MigrationInterface {
  name = 'ParcelDelivery1700000001400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."orders_service_type_enum" ADD VALUE IF NOT EXISTS 'parcel'`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "delivery_pin" varchar(4),
        ADD COLUMN IF NOT EXISTS "delivery_pin_attempts" int NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      INSERT INTO "tariffs" ("name", "service_type", "base_price", "price_per_km", "price_per_min", "min_price", "is_active")
      SELECT 'Posilka', 'parcel', 5000, 1200, 100, 8000, true
      WHERE NOT EXISTS (SELECT 1 FROM "tariffs" WHERE "service_type" = 'parcel')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enum qiymatini Postgres'da olib tashlab bo'lmaydi; ustunlar va tarif
    // (agar unga buyurtma bog'lanmagan bo'lsa) olinadi.
    await queryRunner.query(`
      DELETE FROM "tariffs" t WHERE t."service_type" = 'parcel'
        AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."tariff_id" = t."id")
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_pin_attempts", DROP COLUMN IF EXISTS "delivery_pin"
    `);
  }
}
