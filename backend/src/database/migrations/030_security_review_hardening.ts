import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Security review (2026-10-15) — docs/LEGAL-COMPLIANCE.md §25.
 *
 *  · `platform_settings.wallet_topup_hold_days` (7) — karta to'ldirishi
 *    shuncha kun yechib olinmaydi (#3a).
 *  · `platform_settings.manual_adjustment_manager_limit` (2 000 000) — menejer
 *    qo'lda tuzatish chegarasi (#6).
 *  · `uq_drivers_pinfl`, `uq_drivers_tin` — qisman unikal indekslar
 *    (`WHERE … IS NOT NULL`) (#4). Mavjud takrorlar bo'lsa indeks YARATILMAYDI
 *    (ma'lumot o'chirilmaydi, ilova ko'tariladi) — ogohlantirish logda;
 *    takrorlarni qo'lda tuzatib, migratsiyani qayta yurgizing (`down` + `up`)
 *    yoki indeksni qo'lda yarating. Tekshiruv so'rovi:
 *    `SELECT pinfl, count(*) FROM drivers WHERE pinfl IS NOT NULL GROUP BY 1 HAVING count(*) > 1`.
 */
export class SecurityReviewHardening1700000003000 implements MigrationInterface {
  name = 'SecurityReviewHardening1700000003000';

  private readonly logger = new Logger('Migration030');

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "wallet_topup_hold_days" integer NOT NULL DEFAULT 7`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "manual_adjustment_manager_limit" numeric(12,2) NOT NULL DEFAULT 2000000`,
    );

    for (const column of ['pinfl', 'tin'] as const) {
      const duplicates = (await queryRunner.query(
        `SELECT "${column}" AS value, count(*)::int AS n FROM "drivers"
          WHERE "${column}" IS NOT NULL GROUP BY 1 HAVING count(*) > 1`,
      )) as Array<{ value: string; n: number }>;
      if (duplicates.length > 0) {
        this.logger.warn(
          `uq_drivers_${column} NOT created: ${duplicates.length} duplicated ${column} value(s) in drivers — ` +
            'resolve them manually, then create the index (see migration 030 header).',
        );
        continue;
      }
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_drivers_${column}" ON "drivers" ("${column}") WHERE "${column}" IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_drivers_tin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_drivers_pinfl"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "manual_adjustment_manager_limit"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "wallet_topup_hold_days"`);
  }
}
