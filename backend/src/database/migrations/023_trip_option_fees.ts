import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safar opsiyalari uchun qo'shimcha haq (biznes qarori, 2026-10-09).
 *
 * `{"child_seat": 5000, "pet": 7000}` ko'rinishida; menejer belgilaydi.
 * Bo'sh obyekt bilan boshlanadi — deploy lahzasida hech kimning narxi
 * o'zgarmaydi, toki menejer birinchi summani qo'ymaguncha.
 */
export class TripOptionFees1700000002300 implements MigrationInterface {
  name = 'TripOptionFees1700000002300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        ADD COLUMN IF NOT EXISTS "trip_option_fees" jsonb NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "trip_option_fees"`);
  }
}
