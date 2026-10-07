import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naqd ovqat/market buyurtmasida sotuvchi bilan hisob-kitob
 * (biznes qarori, 2026-10-07).
 *
 * Kuryer tovarni olayotganda do'konga tovar summasini O'Z pulidan to'laydi,
 * keyin mijozdan tovar + yetkazish haqini oladi. Shunda hech kim hech kimga
 * qarzdor qolmaydi va platformaga kassa kerak emas.
 *
 *  · `max_cash_vendor_order` — naqd buyurtma chegarasi (200 000 so'm): kuryer
 *    katta summani cho'ntagidan to'lamasin. Undan katta — faqat karta.
 *  · `vendor_cash_paid_at` — kuryer "do'konga to'ladim" dedi.
 *  · `vendor_cash_confirmed_at` — sotuvchi "oldim" dedi.
 *  · `vendor_cash_disputed_at` — sotuvchi "olmadim" dedi → dispetcherga.
 */
export class VendorCashSettlement1700000001900 implements MigrationInterface {
  name = 'VendorCashSettlement1700000001900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        ADD COLUMN IF NOT EXISTS "max_cash_vendor_order" decimal(12,2) NOT NULL DEFAULT 200000
    `);
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "vendor_cash_paid_at" TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS "vendor_cash_confirmed_at" TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS "vendor_cash_disputed_at" TIMESTAMP WITH TIME ZONE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          DROP COLUMN IF EXISTS "vendor_cash_disputed_at",
          DROP COLUMN IF EXISTS "vendor_cash_confirmed_at",
          DROP COLUMN IF EXISTS "vendor_cash_paid_at"
      `);
    }
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "max_cash_vendor_order"`);
  }
}
