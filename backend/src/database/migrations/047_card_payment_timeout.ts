import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kartali ovqat/market buyurtmasi to'lovdan oldin sotuvchiga ketmaydi
 * (docs/INCIDENT-POLICY.md §1).
 *
 *  · `platform_settings.card_payment_timeout_minutes` — to'lanmagan kartali
 *    buyurtma shuncha daqiqadan keyin avtomatik bekor qilinadi. Standart 15.
 *
 *  · `transactions.order_id → orders.id` tashqi kaliti olib tashlanadi.
 *    "To'langanmi" alohida ustun EMAS: manba — buyurtmaning COMPLETED karta
 *    DEBIT tranzaksiyasi (`delivery/vendor-card-payment.ts`). Lekin ovqat/
 *    market buyurtmasi `orders` da emas (`food_orders`/`market_orders`), va
 *    shu kalit tufayli `initiatePayment` ularning to'lov qatorini umuman
 *    yoza olmasdi (FK xatosi) — ya'ni kartali ovqat/market to'lovi hech
 *    qachon "to'langan" bo'la olmasdi. `order_id` endi uch vertikaldan
 *    birining id'si (taksi, ovqat, market). Nom sinxronizatsiya bilan
 *    qurilgan bazada boshqacha bo'lishi mumkin — shuning uchun katalogdan
 *    qidiriladi.
 */
export class CardPaymentTimeout1700000004700 implements MigrationInterface {
  name = 'CardPaymentTimeout1700000004700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "card_payment_timeout_minutes" int NOT NULL DEFAULT 15`);
    await queryRunner.query(`DO $$
      DECLARE fk record;
      BEGIN
        FOR fk IN
          SELECT con.conname
            FROM pg_constraint con
            JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'transactions'::regclass
             AND con.contype = 'f'
             AND con.confrelid = 'orders'::regclass
             AND att.attname = 'order_id'
        LOOP
          EXECUTE format('ALTER TABLE "transactions" DROP CONSTRAINT %I', fk.conname);
        END LOOP;
      END $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NOT VALID — ovqat/market to'lov qatorlari mavjud bo'lsa ham qaytadi.
    await queryRunner.query(`ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_3cb0558ed36997f1d9ecc1118e7" FOREIGN KEY ("order_id")
      REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "platform_settings"
      DROP COLUMN IF EXISTS "card_payment_timeout_minutes"`);
  }
}
