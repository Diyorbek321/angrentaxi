import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * API v4 (2026-10-15) — docs/LEGAL-COMPLIANCE.md §21–23.
 *
 *  · `food_orders` / `market_orders`: `vendor_wallet_amount`,
 *    `vendor_wallet_commission` (hamyon o'tkazmasi PAYTIDAGI summalar) va
 *    `vendor_wallet_reversed_at`. Mavjud hisoblangan/teskari qilingan
 *    buyurtmalar daftar qatorlaridan to'ldiriladi (oxirgi raund belgilari:
 *    `vendor_settlement_debit_<id>[_<n>]`, `..._commission_...`,
 *    `vendor_settlement_reversal_debit_<id>[_<n>]`).
 *  · `uq_transactions_refund_clawback` — karta qaytarimida ulushni qaytarib
 *    olish qatori (`refund_clawback_driver_<id>` / `refund_clawback_vendor_<id>`)
 *    bir marta.
 *
 * `IF NOT EXISTS` — dev'da `synchronize` ularni oldinroq yaratgan bo'lishi mumkin.
 */
export class VendorSettlementViewAndRefundClawback1700000002900 implements MigrationInterface {
  name = 'VendorSettlementViewAndRefundClawback1700000002900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "vendor_wallet_amount" numeric(12,2)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "vendor_wallet_commission" numeric(12,2)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "vendor_wallet_reversed_at" TIMESTAMP WITH TIME ZONE`,
      );
      await this.backfill(queryRunner, table);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_transactions_refund_clawback"
        ON "transactions" ("external_id") WHERE external_id LIKE 'refund_clawback_%'
    `);
  }

  /**
   * Oxirgi raund: hozir hisoblangan bo'lsa `reversal_count + 1`, aks holda
   * `reversal_count` (teskari qilingan, qayta o'tkazilmagan). Belgi qo'shimchasi
   * 1-raundda yo'q, keyin `_<n>` (`vendor-wallet-settlement.ts`).
   */
  private async backfill(queryRunner: QueryRunner, table: string): Promise<void> {
    await queryRunner.query(`
      WITH candidates AS (
        SELECT o.id,
               o.vendor_wallet_reversal_count AS reversals,
               CASE WHEN o.vendor_wallet_settled_at IS NOT NULL
                    THEN o.vendor_wallet_reversal_count + 1
                    ELSE o.vendor_wallet_reversal_count END AS round
          FROM "${table}" o
         WHERE o.vendor_wallet_amount IS NULL
           AND (o.vendor_wallet_settled_at IS NOT NULL OR o.vendor_wallet_reversal_count > 0)
      ), tagged AS (
        SELECT c.id,
               c.reversals,
               CASE WHEN c.round > 1 THEN '_' || c.round ELSE '' END AS settle_suffix,
               CASE WHEN c.reversals > 1 THEN '_' || c.reversals ELSE '' END AS reversal_suffix
          FROM candidates c
         WHERE c.round > 0
      ), sums AS (
        SELECT t.id,
               debit.amount AS amount,
               COALESCE(commission.amount, 0) AS commission,
               reversal.created_at AS reversed_at
          FROM tagged t
          JOIN transactions debit
            ON debit.external_id = 'vendor_settlement_debit_' || t.id || t.settle_suffix
          LEFT JOIN transactions commission
            ON commission.external_id = 'vendor_settlement_commission_' || t.id || t.settle_suffix
          LEFT JOIN transactions reversal
            ON t.reversals > 0
           AND reversal.external_id = 'vendor_settlement_reversal_debit_' || t.id || t.reversal_suffix
      )
      UPDATE "${table}" o
         SET vendor_wallet_amount = s.amount,
             vendor_wallet_commission = s.commission,
             vendor_wallet_reversed_at = s.reversed_at
        FROM sums s
       WHERE o.id = s.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_transactions_refund_clawback"`);
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "vendor_wallet_reversed_at"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "vendor_wallet_commission"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "vendor_wallet_amount"`);
    }
  }
}
