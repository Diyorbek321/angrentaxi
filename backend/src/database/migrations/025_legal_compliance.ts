import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Huquqiy talablar (2026-10-15) — docs/LEGAL-COMPLIANCE.md.
 *
 *  · VMQ No. 200 (02.04.2025): haydovchining huquqiy profili (`drivers`
 *    ustunlari) va taksi uchun 4 ta yangi tekshiruv talabi.
 *  · PQ-247 (12.08.2025) + Soliq kodeksi 465/470: 1% ushlab qolish
 *    sozlamalari va bir buyurtmaga bitta soliq qatori kafolati.
 *  · Fiskal cheklar (komissioner modeli): `fiscal_receipts` jadvali va
 *    sotuvchilarning STIR ustuni.
 *
 * ⚠️ HECH NARSA DARHOL MAJBURLANMAYDI. Standart qiymatlar mavjud xulqni
 * aynan saqlaydi: `legal_compliance_enforced_from = NULL` (faqat
 * ogohlantirish), `tax_withholding_enabled = false`,
 * `launch_promo_commission_until = NULL`. Yangi tekshiruv talablari
 * `is_required = false` bilan yoziladi — 006/017 dagi onlayn darvoza ularni
 * hisoblamaydi; ularni faqat huquqiy darvoza (majburlash yoqilganda) talab
 * qiladi. Aks holda `created_at + grace_days` dan keyin butun taksi parki
 * oflayn bo'lib qolardi.
 *
 * `IF NOT EXISTS` — dev muhitida `synchronize` ustun/jadvallarni entity'dan
 * oldinroq yaratgan bo'lishi mumkin (004/005/006 dagi bilan bir xil).
 */
const DRIVER_COLUMNS: readonly string[] = [
  `"tax_status" character varying(30)`,
  `"pinfl" character varying(14)`,
  `"tin" character varying(9)`,
  `"birth_date" date`,
  `"driving_licence_issued_at" date`,
  `"taxi_licence_number" character varying(50)`,
  `"taxi_licence_region" character varying(100)`,
  `"citizenship" character varying(2) NOT NULL DEFAULT 'UZ'`,
];

const SETTINGS_COLUMNS: readonly string[] = [
  `"legal_compliance_enforced_from" TIMESTAMP WITH TIME ZONE`,
  `"min_driver_age_years" integer NOT NULL DEFAULT 21`,
  `"min_licence_experience_years" integer NOT NULL DEFAULT 3`,
  `"max_vehicle_age_years" integer NOT NULL DEFAULT 15`,
  `"tax_withholding_enabled" boolean NOT NULL DEFAULT false`,
  `"driver_tax_withholding_rate" numeric(5,2) NOT NULL DEFAULT 1`,
  `"launch_promo_commission_until" TIMESTAMP WITH TIME ZONE`,
];

const columnName = (definition: string): string => definition.split('"')[1];

const LEGAL_REQUIREMENT_CODES = ['taxi_licence', 'medical_check', 'carrier_insurance', 'tech_inspection'];

export class LegalCompliance1700000002500 implements MigrationInterface {
  name = 'LegalCompliance1700000002500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of DRIVER_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS ${column}`);
    }
    for (const column of SETTINGS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS ${column}`);
    }
    for (const table of ['restaurants', 'stores']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tin" character varying(9)`);
    }

    // Bir buyurtma + bir haydovchi = ko'pi bilan bitta soliq qatori.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_transactions_tax_withholding_order"
        ON "transactions" ("order_id", "user_id") WHERE external_id = 'tax_withholding'
    `);

    await this.createFiscalReceipts(queryRunner);
    await this.seedTaxiRequirements(queryRunner);
  }

  private async createFiscalReceipts(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fiscal_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "service_type" character varying(20) NOT NULL,
        "principal_type" character varying(20) NOT NULL,
        "principal_id" uuid,
        "principal_pinfl" character varying(14),
        "principal_tin" character varying(9),
        "platform_role" character varying(20) NOT NULL DEFAULT 'komissioner',
        "total" numeric(12,2) NOT NULL,
        "commission_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "payment_method" character varying(10) NOT NULL,
        "status" character varying(10) NOT NULL DEFAULT 'pending',
        "provider" character varying(30) NOT NULL,
        "external_id" character varying(100),
        "fiscal_sign" character varying(100),
        "qr_url" character varying(500),
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" character varying(500),
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fiscal_receipts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_fiscal_receipts_order_id" ON "fiscal_receipts" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fiscal_receipts_status_created"
        ON "fiscal_receipts" ("status", "created_at")
    `);
  }

  /**
   * VMQ 200 hujjatlari — menejer ko'rib chiqadi (mavjud talablar kabi).
   * `cadence_days = 365` — menejer hujjatdagi aniq sanani (`validUntil`)
   * kiritmasa ishlatiladigan zaxira: tibbiy va texnik ko'rik yillik,
   * litsenziya va sug'urta uchun esa hujjatdagi sana kiritilishi kerak.
   */
  private async seedTaxiRequirements(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO driver_verification_requirements
        (code, label, hint, kind, service_type, vehicle_type, cadence_days, grace_days, is_required, is_active, sort_order)
      VALUES
        ('taxi_licence',      'Taksi litsenziya varaqasi',        'Litsenziya varaqasi (hudud va amal qilish muddati ko''rinsin)', 'document', 'taxi', NULL, 365, 30, false, true, 200),
        ('medical_check',     'Tibbiy ko''rik ma''lumotnomasi',   'Yillik tibbiy ko''rikdan o''tganlik hujjati',                  'document', 'taxi', NULL, 365, 30, false, true, 210),
        ('carrier_insurance', 'Tashuvchi javobgarlik sug''urtasi', 'Yo''lovchi tashuvchining fuqarolik javobgarligi polisi',         'document', 'taxi', NULL, 365, 30, false, true, 220),
        ('tech_inspection',   'Texnik ko''rik',                    'Yillik texnik ko''rikdan o''tganlik talon/dalolatnomasi',      'document', 'taxi', NULL, 365, 30, false, true, 230)
      ON CONFLICT (code) DO UPDATE SET
        label        = EXCLUDED.label,
        hint         = EXCLUDED.hint,
        kind         = EXCLUDED.kind,
        service_type = EXCLUDED.service_type,
        cadence_days = EXCLUDED.cadence_days,
        grace_days   = EXCLUDED.grace_days,
        is_active    = true,
        sort_order   = EXCLUDED.sort_order,
        updated_at   = now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE driver_verification_requirements SET is_active = false, updated_at = now() WHERE code = ANY($1)`,
      [LEGAL_REQUIREMENT_CODES],
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "fiscal_receipts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_transactions_tax_withholding_order"`);
    for (const table of ['restaurants', 'stores']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tin"`);
    }
    for (const column of SETTINGS_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "${columnName(column)}"`);
    }
    for (const column of DRIVER_COLUMNS) {
      await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN IF EXISTS "${columnName(column)}"`);
    }
  }
}
