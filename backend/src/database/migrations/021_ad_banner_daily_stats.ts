import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reklama hisobotining kunlik kesimi (2026-10-09).
 *
 * Har ko'rish/bosish `(banner_id, day)` qatoriga `ON CONFLICT ... + 1` bilan
 * qo'shiladi — bitta qator bir bannerning bir kuni. Eski jami sonlar
 * (`ad_banners.impressions/clicks`) o'zgarmaydi; ular kunlarga taqsimlab
 * bo'lmaydi, shuning uchun bu jadval bo'sh boshlanadi.
 */
export class AdBannerDailyStats1700000002100 implements MigrationInterface {
  name = 'AdBannerDailyStats1700000002100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ad_banner_daily_stats" (
        "banner_id" uuid NOT NULL,
        "day" date NOT NULL,
        "impressions" int NOT NULL DEFAULT 0,
        "clicks" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_ad_banner_daily_stats" PRIMARY KEY ("banner_id", "day"),
        CONSTRAINT "FK_ad_banner_daily_stats_banner" FOREIGN KEY ("banner_id")
          REFERENCES "ad_banners"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ad_banner_daily_stats"`);
  }
}
