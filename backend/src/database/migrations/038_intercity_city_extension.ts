import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shaharlararo — "shahar ichiga davom": nuqtadan (Rohat krugi) yo'lovchi
 * manzilgacha km haqi (`intercity-extension.ts`).
 *
 *  · `extension_max_km` — nuqta markazidan qancha uzoqqacha eltish/olish
 *    mumkin. 0 — davom o'chiq (standart: migratsiya hech narsani yoqmaydi).
 *  · `extension_price_per_km` — Start, so'm/km.
 *  · `extension_comfort_price_per_km` — Comfort; NULL bo'lsa Start narxi.
 *
 * Bandning o'zida yangi ustun YO'Q: davom summasi `orders.fare_breakdown`
 * jsonb ga (`distanceFare` + `intercityExtensions`) muzlatib yoziladi —
 * chek, fiskal va komissiya allaqachon shu qatordan o'qiydi.
 */
export class IntercityCityExtension1700000003800 implements MigrationInterface {
  name = 'IntercityCityExtension1700000003800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "intercity_points"
      ADD COLUMN IF NOT EXISTS "extension_max_km" numeric(6,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "extension_price_per_km" int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "extension_comfort_price_per_km" int NULL`);
    await queryRunner.query(`ALTER TABLE "intercity_points"
      DROP CONSTRAINT IF EXISTS "chk_intercity_points_extension_non_negative"`);
    await queryRunner.query(`ALTER TABLE "intercity_points"
      ADD CONSTRAINT "chk_intercity_points_extension_non_negative" CHECK (
        "extension_max_km" >= 0
        AND "extension_price_per_km" >= 0
        AND ("extension_comfort_price_per_km" IS NULL OR "extension_comfort_price_per_km" >= 0)
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "intercity_points"
      DROP CONSTRAINT IF EXISTS "chk_intercity_points_extension_non_negative"`);
    await queryRunner.query(`ALTER TABLE "intercity_points"
      DROP COLUMN IF EXISTS "extension_comfort_price_per_km",
      DROP COLUMN IF EXISTS "extension_price_per_km",
      DROP COLUMN IF EXISTS "extension_max_km"`);
  }
}
