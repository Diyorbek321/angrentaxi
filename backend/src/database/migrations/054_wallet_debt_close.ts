import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Yo'lovchi qarzini yopish (docs/INCIDENT-POLICY.md §7) va posilka qabul
 * qiluvchisiga qo'ng'iroq (§4).
 *
 *  · `uq_transactions_wallet_debt_cash` — menejer naqd olganda kirim qatori
 *    (`wallet_debt_cash_<debitId>`) har bir qarzga bir marta.
 *  · `order_call_logs.callee_type` — kimga qo'ng'iroq: `recipient` (ilova
 *    foydalanuvchisi emas, `callee_user_id` NULL). Eski qatorlarda NULL —
 *    buyurtma qarshi tomoni.
 */
export class WalletDebtClose1700000005400 implements MigrationInterface {
  name = 'WalletDebtClose1700000005400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_transactions_wallet_debt_cash"
        ON "transactions" ("external_id") WHERE "external_id" LIKE 'wallet_debt_cash_%'
    `);
    await queryRunner.query(`ALTER TABLE "order_call_logs"
      ADD COLUMN IF NOT EXISTS "callee_type" varchar(20) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_call_logs" DROP COLUMN IF EXISTS "callee_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_transactions_wallet_debt_cash"`);
  }
}
