import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shaharlararo qatnov — 1-qadam: nuqtalar, yo'nalishlar va narxlar.
 *
 *  · `intercity_points` — yo'nalish uchlari (Angren, Rohat krugi (Toshkent),
 *    Olmaliq, Ohangaron...). Markaz + radius: yo'lovchini olish va tushirish
 *    manzili shu doira ichida bo'lishi kerak.
 *  · `intercity_routes` — har bir YO'NALISH alohida qator (Angren→Toshkent va
 *    Toshkent→Angren narxi farq qilishi mumkin). Narx qat'iy: o'rindiq va
 *    butun mashina, Start va (ixtiyoriy) Comfort klass.
 *  · `platform_settings.intercity_enabled` — standart o'chiq.
 *
 * ⚠️ NEGA `cities` EMAS. `cities` — shahar ichidagi taksi QAMROVI:
 * `CitiesService.resolveForPoint` har buyurtmada unga qaraydi. Toshkentni
 * u yerga qo'shish shaharlararo uchun nuqta ochish o'rniga Toshkentda shahar
 * ichidagi taksini ham jimgina ochib yuborardi. Alohida jadval bu ikki
 * tushunchani bir-biriga tegizmaydi.
 *
 * Migratsiya HECH QANDAY qator qo'ymaydi — yo'nalishlar seed'da yoki admin
 * paneli orqali qo'shiladi (xuddi `cities` dagidek).
 *
 * `IF NOT EXISTS` — dev muhitida `synchronize` jadvalni entity'dan oldinroq
 * yaratgan bo'lishi mumkin (026/031 dagi bilan bir xil).
 */
const ROUTE_CHECKS: ReadonlyArray<readonly [string, string]> = [
  ['chk_intercity_routes_distinct_points', '"origin_point_id" <> "destination_point_id"'],
  ['chk_intercity_routes_prices_positive', '"seat_price" > 0 AND "whole_car_price" > 0'],
  [
    'chk_intercity_routes_comfort_pair',
    '("comfort_seat_price" IS NULL) = ("comfort_whole_car_price" IS NULL)',
  ],
  [
    'chk_intercity_routes_comfort_positive',
    '"comfort_seat_price" IS NULL OR ("comfort_seat_price" > 0 AND "comfort_whole_car_price" > 0)',
  ],
];

export class IntercityRoutes1700000003400 implements MigrationInterface {
  name = 'IntercityRoutes1700000003400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercity_points" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "center_lat" numeric(10,7) NOT NULL,
        "center_lng" numeric(10,7) NOT NULL,
        "radius_km" numeric(6,2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intercity_points" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_intercity_points_is_active_sort_order"
        ON "intercity_points" ("is_active", "sort_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercity_routes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "origin_point_id" uuid NOT NULL,
        "destination_point_id" uuid NOT NULL,
        "seat_price" numeric(12,2) NOT NULL,
        "whole_car_price" numeric(12,2) NOT NULL,
        "comfort_seat_price" numeric(12,2),
        "comfort_whole_car_price" numeric(12,2),
        "seats_default" integer NOT NULL DEFAULT 4,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intercity_routes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_intercity_routes_origin_destination"
        ON "intercity_routes" ("origin_point_id", "destination_point_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_intercity_routes_is_active_sort_order"
        ON "intercity_routes" ("is_active", "sort_order")
    `);
    await this.addConstraintOnce(
      queryRunner,
      'fk_intercity_routes_origin_point',
      `FOREIGN KEY ("origin_point_id") REFERENCES "intercity_points"("id") ON DELETE RESTRICT`,
    );
    await this.addConstraintOnce(
      queryRunner,
      'fk_intercity_routes_destination_point',
      `FOREIGN KEY ("destination_point_id") REFERENCES "intercity_points"("id") ON DELETE RESTRICT`,
    );
    for (const [name, expression] of ROUTE_CHECKS) {
      await this.addConstraintOnce(queryRunner, name, `CHECK (${expression})`);
    }

    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "intercity_enabled" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "intercity_enabled"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intercity_routes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intercity_points"`);
  }

  /** `ADD CONSTRAINT` da `IF NOT EXISTS` yo'q — katalogdan tekshiriladi. */
  private async addConstraintOnce(
    queryRunner: QueryRunner,
    name: string,
    definition: string,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "intercity_routes" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$
    `);
  }
}
