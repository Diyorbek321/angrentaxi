import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Davriy ko'rik va selfi (biznes qarori, 2026-10-06).
 *
 *  · Mashina ko'rigi — 30 kunda bir: 4 tomon + old o'rindiqlar + orqa
 *    o'rindiqlar + bagaj = 7 ta surat. Menejer tasdiqlaydi.
 *  · Selfi — 3 kunda bir: akkauntdan boshqa odam foydalanmayotganini
 *    tekshirish. Menejer avvalgi selfi bilan solishtiradi.
 *  · Muddat o'tsa 1 kun muhlat (`grace_days = 1`), keyin onlayn bo'lib
 *    bo'lmaydi — mexanizm `DriverVerificationService` da tayyor edi, bu
 *    migratsiya faqat QOIDALARNI yozadi.
 *
 * NEGA MIGRATSIYA (seed emas): seed — dev ma'lumot, production bazaga
 * tushmaydi. Talablar esa biznes qoidasi va har bir muhitda bir xil
 * bo'lishi shart.
 *
 * `ON CONFLICT (code) DO UPDATE`: dev bazada seed allaqachon shu kodlarni
 * boshqa muddat bilan yozgan bo'lishi mumkin — qoida bu yerdagi qiymatga
 * keltiriladi. `created_at` YANGILANADI: muhlat yangi qoida yozilgan paytdan
 * hisoblanadi, aks holda eski qatorli bazada butun park darhol bloklanardi
 * (`computeBlockDeadline` → `created_at + grace_days`).
 *
 * Eski bitta "Salon" surati old va orqa o'rindiqlarga ajratildi — eski
 * qator o'chirilmaydi (yuborilgan materiallar tarixi unga bog'liq), faqat
 * nofaol qilinadi.
 */
export class PeriodicInspection1700000001700 implements MigrationInterface {
  name = 'PeriodicInspection1700000001700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO driver_verification_requirements
        (code, label, hint, kind, service_type, vehicle_type, cadence_days, grace_days, is_required, is_active, sort_order)
      VALUES
        ('vehicle_photo_front',       'Avtomobil old tomondan',   'Davlat raqami ko''rinsin',                     'vehicle_photo', NULL, NULL, 30, 1, true, true, 50),
        ('vehicle_photo_back',        'Avtomobil orqa tomondan',  'Davlat raqami ko''rinsin',                     'vehicle_photo', NULL, NULL, 30, 1, true, true, 60),
        ('vehicle_photo_left',        'Avtomobil chap tomondan',  'Mashina to''liq tushsin',                      'vehicle_photo', NULL, NULL, 30, 1, true, true, 70),
        ('vehicle_photo_right',       'Avtomobil o''ng tomondan', 'Mashina to''liq tushsin',                      'vehicle_photo', NULL, NULL, 30, 1, true, true, 80),
        ('vehicle_photo_front_seats', 'Old o''rindiqlar',         'Eshikni ochib, ikkala o''rindiq ko''rinsin',   'vehicle_photo', NULL, NULL, 30, 1, true, true, 90),
        ('vehicle_photo_rear_seats',  'Orqa o''rindiqlar',        'Eshikni ochib, butun o''rindiq ko''rinsin',    'vehicle_photo', NULL, NULL, 30, 1, true, true, 92),
        ('vehicle_photo_trunk',       'Bagaj',                    'Bagajni ochib, ichi to''liq ko''rinsin',       'vehicle_photo', NULL, NULL, 30, 1, true, true, 94),
        ('selfie',                    'Selfi',                    'Yuzingiz aniq ko''rinsin, ko''zoynak va niqobsiz', 'selfie',    NULL, NULL, 3,  1, true, true, 5)
      ON CONFLICT (code) DO UPDATE SET
        label        = EXCLUDED.label,
        hint         = EXCLUDED.hint,
        kind         = EXCLUDED.kind,
        cadence_days = EXCLUDED.cadence_days,
        grace_days   = EXCLUDED.grace_days,
        is_required  = EXCLUDED.is_required,
        is_active    = true,
        sort_order   = EXCLUDED.sort_order,
        created_at   = now(),
        updated_at   = now()
    `);

    await queryRunner.query(`
      UPDATE driver_verification_requirements
      SET is_active = false, updated_at = now()
      WHERE code = 'vehicle_photo_interior'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE driver_verification_requirements
      SET is_active = false, updated_at = now()
      WHERE code IN ('vehicle_photo_front_seats', 'vehicle_photo_rear_seats', 'vehicle_photo_trunk', 'selfie')
    `);
    await queryRunner.query(`
      UPDATE driver_verification_requirements
      SET is_active = true, updated_at = now()
      WHERE code = 'vehicle_photo_interior'
    `);
  }
}
