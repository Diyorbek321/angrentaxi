import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Buyurtmani kim bekor qildi (passenger/driver/manager/system) — antifrod
 * hisobotida "haydovchi yetib kelgach bekor qildi" belgisini kim tomonidan
 * ekanini ajratish uchun. Eski qatorlar `NULL` qoladi (noma'lum).
 */
export class OrderCancelledBy1700000004600 implements MigrationInterface {
  name = 'OrderCancelledBy1700000004600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_by" character varying(20)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cancelled_by"`);
  }
}
