import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SAFAR OPSIYALARI.
 *
 *   orders.options     — yo'lovchi so'ragan qo'shimchalar (bola o'rindig'i,
 *                        hayvon, konditsioner, katta bagaj).
 *   drivers.amenities  — haydovchi taklif qila oladigan qo'shimchalar.
 *
 * Matching faqat so'ralgan HAMMA opsiyani beradigan haydovchiga taklif
 * yuboradi. Ikkala ustun ham NOT NULL + DEFAULT '[]': mavjud buyurtmalar
 * "opsiyasiz", mavjud haydovchilar esa "qo'shimcha yo'q" bo'lib qoladi —
 * ya'ni deploy lahzasida hech kimning ishi o'zgarmaydi.
 */
export class TripOptions1700000001100 implements MigrationInterface {
  name = 'TripOptions1700000001100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "options" jsonb NOT NULL DEFAULT '[]'
    `);
    await queryRunner.query(`
      ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "amenities" jsonb NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN IF EXISTS "amenities"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "options"`);
  }
}
