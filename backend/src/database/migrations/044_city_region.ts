import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shahar hududi (ISO 3166-2:UZ) — taksi litsenziyasi hududi cheklovi
 * (common/regions/uz-regions.ts). Mavjud shaharlar nomidan to'ldiriladi;
 * tanilmagani `NULL` qoladi (cheklov qo'llanmaydi) — admin panelda tanlanadi.
 */
export class CityRegion1700000004400 implements MigrationInterface {
  name = 'CityRegion1700000004400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "region" character varying(8)`);
    await queryRunner.query(`
      UPDATE "cities" SET "region" = 'UZ-TO'
       WHERE "region" IS NULL
         AND lower("name") ~ '(angren|ohangaron|olmaliq|chirchiq|bekobod|yangiyo.?l|ангрен)'
    `);
    await queryRunner.query(`
      UPDATE "cities" SET "region" = 'UZ-TK'
       WHERE "region" IS NULL AND lower("name") ~ '^(toshkent|tashkent|ташкент)( sh.*| city)?$'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cities" DROP COLUMN IF EXISTS "region"`);
  }
}
