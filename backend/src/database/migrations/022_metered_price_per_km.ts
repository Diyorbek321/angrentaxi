import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Taksometr uchun alohida km narxi (biznes qarori, 2026-10-09).
 *
 * NULL bilan boshlanadi — ya'ni hech bir tarifning narxi o'zgarmaydi, toki
 * admin (yoki menejer taklifi orqali) qiymat qo'ymaguncha.
 */
export class MeteredPricePerKm1700000002200 implements MigrationInterface {
  name = 'MeteredPricePerKm1700000002200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tariffs" ADD COLUMN IF NOT EXISTS "metered_price_per_km" decimal(10,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tariffs" DROP COLUMN IF EXISTS "metered_price_per_km"`);
  }
}
