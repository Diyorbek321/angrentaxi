import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Termo-sumka fotosi — "Ovqat yetkazish" xizmatini yoqish sharti.
 *
 * Qoida ilgari faqat `seed.ts` da bor edi, shuning uchun seed qilinmagan
 * prod bazada umuman yo'q edi: haydovchi ilovasida band chiqmasdi. Seed
 * bilan AYNAN bir xil qiymatlar (30 kunda qayta, 5 kun muhlat).
 *
 * `DO NOTHING` — admin allaqachon o'zgartirgan qatorni qayta yozmaydi.
 */
export class ThermalBagRequirement1700000004000 implements MigrationInterface {
  name = 'ThermalBagRequirement1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO driver_verification_requirements
        (code, label, hint, kind, service_type, vehicle_type, cadence_days, grace_days, is_required, is_active, sort_order)
      VALUES
        ('thermal_bag_photo', 'Termo-sumka fotosi', 'Sumka ochiq holatda, ichki qismi ko''rinsin', 'vehicle_photo', 'food', NULL, 30, 5, true, true, 110)
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // O'chirilmaydi — yuborilgan fotolar tarixi qatorga bog'liq (017 bilan bir xil).
    await queryRunner.query(`
      UPDATE driver_verification_requirements
      SET is_active = false, updated_at = now()
      WHERE code = 'thermal_bag_photo'
    `);
  }
}
