import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Huquqiy/biznes bosqich 3 (2026-10-15) — docs/LEGAL-COMPLIANCE.md §11–16.
 *
 *  · Hamyonni Payme/Click/Uzcard orqali o'zi to'ldirish: `wallet_topups`
 *    jadvali va sozlamalar (standart O'CHIQ).
 *  · Umumiy amallar jurnali `audit_logs` (qo'lda balans tuzatish, smenani
 *    bekor qilish).
 *  · Kuryerga hamyon eslatmasi — kuniga bir marta (`courier_wallet_reminders`).
 *  · Smenani bekor qilish/qaytarish ustunlari, platforma STIR'i.
 *  · Olib ketilgandan keyin bekor qilingan yetkazishda hamyon o'tkazmasini
 *    teskari qilish hisoblagichi.
 *  · `drivers.balance` daftardan qayta hisoblanadi: ustun endi daftarning
 *    keshi (har pul harakatida `syncDriverBalanceColumn`), qarorlar esa
 *    faqat daftardan o'qiydi.
 *
 * `IF NOT EXISTS` — dev muhitida `synchronize` ularni entity'dan oldinroq
 * yaratgan bo'lishi mumkin (025/026 bilan bir xil).
 */
const SETTINGS_COLUMNS: readonly string[] = [
  `"wallet_topup_enabled" boolean NOT NULL DEFAULT false`,
  `"wallet_topup_min" numeric(12,2) NOT NULL DEFAULT 10000`,
  `"wallet_topup_max" numeric(12,2) NOT NULL DEFAULT 2000000`,
  `"wallet_topup_presets" jsonb NOT NULL DEFAULT '[50000, 100000, 200000]'`,
  `"platform_tin" character varying(9)`,
];

const SHIFT_PASS_COLUMNS: readonly string[] = [
  `"cancelled_at" TIMESTAMP WITH TIME ZONE`,
  `"cancel_reason" character varying(500)`,
  `"refund_amount" numeric(12,2)`,
];

const columnName = (definition: string): string => definition.split('"')[1];

export class WalletTopupsAndAudit1700000002700 implements MigrationInterface {
  name = 'WalletTopupsAndAudit1700000002700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of SETTINGS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS ${column}`);
    }
    for (const column of SHIFT_PASS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "driver_shift_passes" ADD COLUMN IF NOT EXISTS ${column}`);
    }
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "vendor_wallet_reversal_count" integer NOT NULL DEFAULT 0`,
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallet_topups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "seq" BIGSERIAL NOT NULL,
        "user_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "provider" character varying(10) NOT NULL,
        "status" character varying(10) NOT NULL DEFAULT 'pending',
        "external_id" character varying(100),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "paid_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_wallet_topups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallet_topups_seq" UNIQUE ("seq"),
        CONSTRAINT "FK_wallet_topups_user" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
        CONSTRAINT "CHK_wallet_topups_amount" CHECK ("amount" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_wallet_topups_user_created" ON "wallet_topups" ("user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_wallet_topups_external_id"
        ON "wallet_topups" ("external_id") WHERE external_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_transactions_wallet_topup"
        ON "transactions" ("external_id")
        WHERE external_id LIKE 'wallet_topup_%' OR external_id LIKE 'shift_pass_refund_%'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_user_id" uuid,
        "action" character varying(50) NOT NULL,
        "target_type" character varying(30) NOT NULL,
        "target_id" uuid,
        "amount" numeric(12,2),
        "note" character varying(500),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_created" ON "audit_logs" ("created_at")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_logs_target" ON "audit_logs" ("target_type", "target_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courier_wallet_reminders" (
        "user_id" uuid NOT NULL,
        "reminder_date" date NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courier_wallet_reminders" PRIMARY KEY ("user_id", "reminder_date")
      )
    `);

    // `drivers.balance` = daftar (tugallangan kirim − chiqim). Ilgari yechish
    // va hamyon o'tkazmasi ustunga tegmasdi — bir martalik tenglashtirish.
    await queryRunner.query(`
      UPDATE "drivers" d
         SET "balance" = COALESCE((
               SELECT SUM(CASE WHEN t.type = 'credit' AND t.status = 'completed' THEN t.amount ELSE 0 END)
                    - SUM(CASE WHEN t.type = 'debit' AND t.status = 'completed' THEN t.amount ELSE 0 END)
                 FROM "transactions" t WHERE t.user_id = d.user_id), 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "courier_wallet_reminders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_transactions_wallet_topup"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_topups"`);
    for (const table of ['food_orders', 'market_orders']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "vendor_wallet_reversal_count"`);
    }
    for (const column of SHIFT_PASS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "driver_shift_passes" DROP COLUMN IF EXISTS "${columnName(column)}"`);
    }
    for (const column of SETTINGS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "${columnName(column)}"`);
    }
  }
}
