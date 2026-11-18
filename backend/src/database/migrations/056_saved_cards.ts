import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Saqlangan kartalar va avtomatik yechish (docs/specs/saqlangan-kartalar.md v2).
 *
 *  · `saved_cards` — yo'lovchining bog'langan kartasi. Faqat provayder TOKENI
 *    (AES-256-GCM bilan shifrlangan) va niqob (`8600 **** 4421`). Karta
 *    raqami, CVV, egasining ismi — hech qachon serverga kelmaydi: karta
 *    ilovaning o'zida Payme `cards.create` orqali bog'lanadi.
 *  · `card_charge_attempts` — safar oxiridagi har bir yechish urinishi.
 *    Qisman unikal indeks: bitta buyurtmaga bir vaqtda faqat BITTA jonli
 *    (`pending` / `paid` / `review`) urinish — qayta urinish yoki
 *    parallel chaqiruv yo'lovchidan ikki marta yecha olmaydi.
 */
export class SavedCards1700000005600 implements MigrationInterface {
  name = 'SavedCards1700000005600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_cards" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "provider" varchar(16) NOT NULL DEFAULT 'payme' CHECK ("provider" IN ('payme','click')),
        "encrypted_token" varchar(1024) NOT NULL,
        "token_fingerprint" varchar(64) NOT NULL,
        "masked_pan" varchar(24) NOT NULL,
        "card_brand" varchar(16) NOT NULL DEFAULT 'unknown'
          CHECK ("card_brand" IN ('uzcard','humo','visa','mastercard','unknown')),
        "expiry" varchar(5) NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','removed')),
        "is_default" boolean NOT NULL DEFAULT false,
        "failed_charge_count" int NOT NULL DEFAULT 0,
        "last_used_at" timestamptz NULL,
        "removed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_saved_cards_user_status" ON "saved_cards" ("user_id", "status")`,
    );
    // Bitta kartani ikki marta bog'lab bo'lmaydi (shifrlangan matn har safar
    // boshqa — IV tasodifiy, shuning uchun unikallik barmoq izi bo'yicha).
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_saved_cards_active_fingerprint"
      ON "saved_cards" ("user_id", "provider", "token_fingerprint") WHERE "status" = 'active'`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_saved_cards_one_default"
      ON "saved_cards" ("user_id") WHERE "is_default" = true AND "status" = 'active'`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "card_charge_attempts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "saved_card_id" uuid NOT NULL REFERENCES "saved_cards"("id") ON DELETE CASCADE,
        "amount" decimal(12,2) NOT NULL,
        "provider_receipt_id" varchar(64) NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending'
          CHECK ("status" IN ('pending','paid','failed','review')),
        "failure_reason" varchar(64) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_card_charge_attempts_live_order"
      ON "card_charge_attempts" ("order_id") WHERE "status" IN ('pending','paid','review')`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_card_charge_attempts_card" ON "card_charge_attempts" ("saved_card_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "card_charge_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_cards"`);
  }
}
