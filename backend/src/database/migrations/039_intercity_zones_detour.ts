import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shaharlararo — bir mashinadagi yo'lovchilar shaharning qarama-qarshi
 * chekkalariga tarqalib ketmasligi uchun (`intercity-zone-policy.ts`,
 * `intercity-detour.ts`).
 *
 *  · `intercity_zones` — "shahar ichiga davom" yoqilgan nuqta atrofidagi
 *    tumanlar (Yunusobod, Chilonzor...): markaz + radius, admin boshqaradi.
 *  · `intercity_trip_zones` — haydovchi e'londa tanlagan tumanlar, tomon
 *    bo'yicha (`origin` — olish, `destination` — tushirish). Bo'sh —
 *    butun davom hududi (eski qatnovlar o'zgarishsiz ishlaydi).
 *  · `platform_settings.intercity_max_detour_minutes` — o'rindiq bandi
 *    haydovchining shahar ichidagi yo'lini ko'pi bilan shuncha daqiqaga
 *    uzaytiradi. 0 — tekshiruv o'chiq.
 *
 * Migratsiya HECH QANDAY tuman qo'shmaydi: tayyor Toshkent ro'yxati admin
 * panelidagi bitta tugma bilan yaratiladi (taxminiy markazlarni admin
 * aniqlashtiradi).
 */
export class IntercityZonesDetour1700000003900 implements MigrationInterface {
  name = 'IntercityZonesDetour1700000003900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercity_zones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "point_id" uuid NOT NULL,
        "name" character varying(80) NOT NULL,
        "center_lat" numeric(10,7) NOT NULL,
        "center_lng" numeric(10,7) NOT NULL,
        "radius_km" numeric(5,2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intercity_zones" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_intercity_zones_point_name" ON "intercity_zones" ("point_id", "name")
    `);
    await this.addConstraintOnce(
      queryRunner,
      'intercity_zones',
      'fk_intercity_zones_point',
      `FOREIGN KEY ("point_id") REFERENCES "intercity_points"("id") ON DELETE RESTRICT`,
    );
    await this.addConstraintOnce(
      queryRunner,
      'intercity_zones',
      'chk_intercity_zones_radius',
      `CHECK ("radius_km" > 0 AND "radius_km" <= 30)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercity_trip_zones" (
        "trip_id" uuid NOT NULL,
        "zone_id" uuid NOT NULL,
        "side" character varying(12) NOT NULL,
        CONSTRAINT "PK_intercity_trip_zones" PRIMARY KEY ("trip_id", "zone_id")
      )
    `);
    await this.addConstraintOnce(
      queryRunner,
      'intercity_trip_zones',
      'fk_intercity_trip_zones_trip',
      `FOREIGN KEY ("trip_id") REFERENCES "intercity_trips"("id") ON DELETE CASCADE`,
    );
    await this.addConstraintOnce(
      queryRunner,
      'intercity_trip_zones',
      'fk_intercity_trip_zones_zone',
      `FOREIGN KEY ("zone_id") REFERENCES "intercity_zones"("id") ON DELETE RESTRICT`,
    );
    await this.addConstraintOnce(
      queryRunner,
      'intercity_trip_zones',
      'chk_intercity_trip_zones_side',
      `CHECK ("side" IN ('origin', 'destination'))`,
    );

    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "intercity_max_detour_minutes" int NOT NULL DEFAULT 15`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      DROP COLUMN IF EXISTS "intercity_max_detour_minutes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intercity_trip_zones"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intercity_zones"`);
  }

  private async addConstraintOnce(
    queryRunner: QueryRunner,
    table: string,
    name: string,
    definition: string,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$
    `);
  }
}
