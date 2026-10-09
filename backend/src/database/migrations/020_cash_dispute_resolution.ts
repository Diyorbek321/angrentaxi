import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naqd nizoni dispetcher yopadi (2026-10-09).
 *
 * Migratsiya 019 nizoni faqat OCHARDI (`vendor_cash_disputed_at`) — yopish
 * yo'q edi, ya'ni telefonda hal qilingan nizo dispetcher navbatida abadiy
 * qizil turardi. Endi:
 *  · `vendor_cash_dispute_resolved_at` — qachon yopildi (navbatdan chiqadi);
 *  · `vendor_cash_dispute_resolved_by` — qaysi dispetcher (users.id);
 *  · `vendor_cash_dispute_resolution` — qanday hal bo'ldi (majburiy izoh).
 *
 * `vendor_cash_disputed_at` O'CHIRILMAYDI: nizo bo'lgani tarixda qoladi.
 */
export class CashDisputeResolution1700000002000 implements MigrationInterface {
  name = 'CashDisputeResolution1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "vendor_cash_dispute_resolved_at" TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS "vendor_cash_dispute_resolved_by" uuid,
          ADD COLUMN IF NOT EXISTS "vendor_cash_dispute_resolution" varchar(500)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          DROP COLUMN IF EXISTS "vendor_cash_dispute_resolution",
          DROP COLUMN IF EXISTS "vendor_cash_dispute_resolved_by",
          DROP COLUMN IF EXISTS "vendor_cash_dispute_resolved_at"
      `);
    }
  }
}
