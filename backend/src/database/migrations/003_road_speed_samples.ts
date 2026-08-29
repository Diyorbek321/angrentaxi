import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Yo'l tezligi agregati uchun `road_speed_samples` jadvali.
 *
 * `IF NOT EXISTS` ATAYLAB: dev muhitida `synchronize` yoqiq bo'lgani uchun
 * jadval entity'dan avtomatik yaratilgan bo'lishi mumkin — migratsiya o'sha
 * bazaga ham tushib, yiqilmasligi kerak (`001_receipt_and_tips.ts` dagi bilan
 * bir xil mulohaza).
 *
 * Unikallik CONSTRAINT emas, INDEKS ko'rinishida: entity'dagi
 * `@Index(..., { unique: true })` ham xuddi shu nomdagi indeksni yaratadi,
 * shuning uchun `synchronize` ishlagan baza bilan migratsiya ishlagan baza
 * bir xil bo'ladi. Bu indeks bo'sh bezak emas — agregatga yozish
 * `ON CONFLICT (zone, day_of_week, hour_of_day)` ga tayanadi, ya'ni indekssiz
 * yozuv umuman ishlamaydi.
 */
export class RoadSpeedSamples1700000000300 implements MigrationInterface {
  name = 'RoadSpeedSamples1700000000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "road_speed_samples" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "zone" character varying(20) NOT NULL,
        "day_of_week" smallint NOT NULL,
        "hour_of_day" smallint NOT NULL,
        "sample_count" integer NOT NULL DEFAULT 0,
        "speed_sum" double precision NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_road_speed_samples" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_road_speed_samples_zone_dow_hour"
        ON "road_speed_samples" ("zone", "day_of_week", "hour_of_day")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_road_speed_samples_zone_dow_hour"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "road_speed_samples"`);
  }
}
