import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Go-live tuzatishlari (2026-10-15) — docs/LEGAL-COMPLIANCE.md §18–20.
 *
 *  · `merchant_transactions` — Payme Merchant API / Click SHOP API
 *    tranzaksiyalari (holat, vaqtlar, sabab). Buyurtma to'lovi va hamyonni
 *    to'ldirish bitta protokol kodidan foydalanadi.
 *  · Fiskal qaytarish cheki: `fiscal_receipts.receipt_type` (`sale|refund`)
 *    va `original_receipt_id`. Unikallik endi `(order_id, receipt_type)` —
 *    bitta buyurtma/smenaga bitta sotuv va bitta qaytarish cheki.
 *
 * `IF NOT EXISTS` — dev'da `synchronize` ularni oldinroq yaratgan bo'lishi mumkin.
 */
export class MerchantTransactionsAndFiscalRefunds1700000002800 implements MigrationInterface {
  name = 'MerchantTransactionsAndFiscalRefunds1700000002800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchant_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "seq" BIGSERIAL NOT NULL,
        "provider" character varying(10) NOT NULL,
        "external_id" character varying(100) NOT NULL,
        "target_kind" character varying(10) NOT NULL,
        "target_ref" character varying(100) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "state" smallint NOT NULL,
        "provider_time" bigint,
        "account" jsonb,
        "create_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "perform_time" TIMESTAMP WITH TIME ZONE,
        "cancel_time" TIMESTAMP WITH TIME ZONE,
        "reason" smallint,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchant_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_merchant_transactions_seq" UNIQUE ("seq")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_merchant_tx_provider_external"
        ON "merchant_transactions" ("provider", "external_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_merchant_tx_payme_active_target"
        ON "merchant_transactions" ("provider", "target_ref") WHERE provider = 'payme' AND state = 1
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_merchant_tx_provider_time"
        ON "merchant_transactions" ("provider", "provider_time")
    `);

    await queryRunner.query(
      `ALTER TABLE "fiscal_receipts" ADD COLUMN IF NOT EXISTS "receipt_type" character varying(10) NOT NULL DEFAULT 'sale'`,
    );
    await queryRunner.query(
      `ALTER TABLE "fiscal_receipts" ADD COLUMN IF NOT EXISTS "original_receipt_id" uuid`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_fiscal_receipts_order_id"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_fiscal_receipts_order_type"
        ON "fiscal_receipts" ("order_id", "receipt_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "fiscal_receipts" WHERE "receipt_type" <> 'sale'`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_fiscal_receipts_order_type"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_fiscal_receipts_order_id" ON "fiscal_receipts" ("order_id")`,
    );
    await queryRunner.query(`ALTER TABLE "fiscal_receipts" DROP COLUMN IF EXISTS "original_receipt_id"`);
    await queryRunner.query(`ALTER TABLE "fiscal_receipts" DROP COLUMN IF EXISTS "receipt_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchant_transactions"`);
  }
}
