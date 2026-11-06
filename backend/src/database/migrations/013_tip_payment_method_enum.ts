import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CHOY PULI TO'LOV TURI — ENTITY BILAN BIR XIL ENUM TURI.
 *
 * 001-migratsiya `orders.tip_payment_method` ustuniga `payment_method` bilan
 * UMUMIY `orders_payment_method_enum` turini bergan edi. Entity esa (va
 * synchronize qurgan bazalar) alohida `orders_tip_payment_method_enum`
 * turini ishlatadi. Migratsiya bilan qurilgan bazada `DB_SYNC=true` bilan
 * ishga tushirilsa, synchronize umumiy turni almashtirmoqchi bo'lib
 * "cannot drop type orders_payment_method_enum_old" bilan yiqilardi.
 *
 * Qiymatlar bir xil (cash/card/wallet), ya'ni ma'lumot o'zgarmaydi — faqat
 * ustun turi. Ustun allaqachon to'g'ri turda bo'lsa hech narsa qilmaydi.
 */
export class TipPaymentMethodEnum1700000001300 implements MigrationInterface {
  name = 'TipPaymentMethodEnum1700000001300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."orders_tip_payment_method_enum" AS ENUM ('cash', 'card', 'wallet');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name = 'tip_payment_method'
            AND udt_name = 'orders_payment_method_enum'
        ) THEN
          ALTER TABLE "orders"
            ALTER COLUMN "tip_payment_method" TYPE "public"."orders_tip_payment_method_enum"
            USING "tip_payment_method"::text::"public"."orders_tip_payment_method_enum";
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ALTER COLUMN "tip_payment_method" TYPE "public"."orders_payment_method_enum"
        USING "tip_payment_method"::text::"public"."orders_payment_method_enum"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."orders_tip_payment_method_enum"`);
  }
}
