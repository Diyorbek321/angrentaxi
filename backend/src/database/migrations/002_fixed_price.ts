import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Qat'iy narx bayrog'i.
 *
 * Manzili oldindan belgilangan buyurtmalarda yo'lovchiga ko'rsatilgan summa
 * majburiy bo'ladi — safar oxirida `fare_breakdown` dagi quote aynan
 * undiriladi.
 *
 * ESKI QATORLAR `false` bo'lib qoladi. Ular hisoblagich rejimida yakunlanadi,
 * ya'ni bugungi xulq saqlanadi — o'tmishdagi safarlarni retroaktiv qayta
 * narxlash mumkin emas va kerak ham emas.
 */
export class FixedPrice1700000000200 implements MigrationInterface {
  name = 'FixedPrice1700000000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "is_fixed_price" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "is_fixed_price"
    `);
  }
}
