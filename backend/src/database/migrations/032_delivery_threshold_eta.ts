import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bepul yetkazish chegarasi va yetkazish vaqti
 * (docs/specs/food-market-ux-v5.md §7).
 *
 *  · `platform_settings.free_delivery_from` — so'm; tovar summasi (aksiyadan
 *    keyin, promokoddan oldin) shunga yetsa yetkazish haqi 0. 0 — o'chiq,
 *    ya'ni standart qiymat hech narsani o'zgartirmaydi.
 *  · `delivery_eta_min_minutes` / `delivery_eta_max_minutes` — ilovada
 *    "30–50 daq". `min ≤ max` servisda tekshiriladi (birlashtirilgan qiymat).
 */
export class DeliveryThresholdEta1700000003200 implements MigrationInterface {
  name = 'DeliveryThresholdEta1700000003200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "free_delivery_from" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "delivery_eta_min_minutes" int NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS "delivery_eta_max_minutes" int NOT NULL DEFAULT 50`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      DROP COLUMN IF EXISTS "delivery_eta_max_minutes",
      DROP COLUMN IF EXISTS "delivery_eta_min_minutes",
      DROP COLUMN IF EXISTS "free_delivery_from"`);
  }
}
