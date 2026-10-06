import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * REKLAMA (3-versiya) — bosh ekrandagi banner karuseli.
 *
 * Jadval bo'sh boshlanadi: bannerlarni admin panelidan admin qo'yadi.
 */
export class AdBanners1700000001500 implements MigrationInterface {
  name = 'AdBanners1700000001500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."ad_banners_link_type_enum" AS ENUM ('none', 'restaurant', 'store', 'url');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ad_banners" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(120) NOT NULL,
        "image_key" varchar(200) NOT NULL,
        "link_type" "public"."ad_banners_link_type_enum" NOT NULL DEFAULT 'none',
        "link_target" varchar(500),
        "starts_at" TIMESTAMP WITH TIME ZONE,
        "ends_at" TIMESTAMP WITH TIME ZONE,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "impressions" int NOT NULL DEFAULT 0,
        "clicks" int NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_banners_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ad_banners_active_sort" ON "ad_banners" ("is_active", "sort_order")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ad_banners"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ad_banners_link_type_enum"`);
  }
}
