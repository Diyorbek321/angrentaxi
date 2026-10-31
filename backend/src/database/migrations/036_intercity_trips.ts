import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shaharlararo qatnov — 2-qadam (b): qatnovlar va band qilish ustunlari.
 *
 *  · `intercity_trips` — haydovchi e'lon qilgan qatnov: yo'nalish, jo'nash
 *    vaqti, o'rindiqlar soni. O'rindiq HISOBI shu qatorda (`seats_taken`),
 *    band qilishning o'zi esa `orders` qatori.
 *  · `orders.intercity_trip_id / seats / booking_kind` — har bir yo'lovchi
 *    bandi oddiy buyurtma: komissiya, 1% ushlash, fiskal chek, reyting,
 *    chat — hammasi `order_id` bo'yicha ishlaydi va o'zgarishsiz qayta
 *    ishlatiladi.
 *  · Sozlamalar: bepul bekor qilish oynasi, bitta bandda nechta o'rindiq,
 *    e'lon qilish oralig'i.
 *
 * Narxlar qatnovga NUSXALANADI (`seat_price`, `whole_car_price`): admin
 * yo'nalish narxini o'zgartirsa, allaqachon e'lon qilingan va yo'lovchilar
 * ko'rgan narx o'zgarib qolmasligi kerak.
 */
const TRIP_CHECKS: ReadonlyArray<readonly [string, string]> = [
  ['chk_intercity_trips_seats_taken', '"seats_taken" >= 0 AND "seats_taken" <= "seats_total"'],
  ['chk_intercity_trips_seats_total', '"seats_total" BETWEEN 1 AND 8'],
  ['chk_intercity_trips_class', `"class" IN ('start', 'comfort')`],
  [
    'chk_intercity_trips_status',
    `"status" IN ('open', 'full', 'boarding', 'in_progress', 'completed', 'cancelled')`,
  ],
  ['chk_intercity_trips_prices_positive', '"seat_price" > 0 AND "whole_car_price" > 0'],
];

export class IntercityTrips1700000003600 implements MigrationInterface {
  name = 'IntercityTrips1700000003600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercity_trips" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "route_id" uuid NOT NULL,
        "driver_id" uuid NOT NULL,
        "class" character varying(10) NOT NULL DEFAULT 'start',
        "departure_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "seats_total" integer NOT NULL,
        "seats_taken" integer NOT NULL DEFAULT 0,
        "whole_car_booked" boolean NOT NULL DEFAULT false,
        "status" character varying(16) NOT NULL DEFAULT 'open',
        "seat_price" numeric(12,2) NOT NULL,
        "whole_car_price" numeric(12,2) NOT NULL,
        "cancel_reason" character varying(500),
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "departed_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intercity_trips" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_intercity_trips_route_status_departure"
        ON "intercity_trips" ("route_id", "status", "departure_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_intercity_trips_driver_status"
        ON "intercity_trips" ("driver_id", "status")
    `);
    await this.addConstraintOnce(
      queryRunner,
      'intercity_trips',
      'fk_intercity_trips_route',
      `FOREIGN KEY ("route_id") REFERENCES "intercity_routes"("id") ON DELETE RESTRICT`,
    );
    await this.addConstraintOnce(
      queryRunner,
      'intercity_trips',
      'fk_intercity_trips_driver',
      `FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT`,
    );
    for (const [name, expression] of TRIP_CHECKS) {
      await this.addConstraintOnce(queryRunner, 'intercity_trips', name, `CHECK (${expression})`);
    }

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "intercity_trip_id" uuid,
        ADD COLUMN IF NOT EXISTS "seats" integer,
        ADD COLUMN IF NOT EXISTS "booking_kind" character varying(10)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_orders_intercity_trip_id" ON "orders" ("intercity_trip_id")
    `);
    await this.addConstraintOnce(
      queryRunner,
      'orders',
      'fk_orders_intercity_trip',
      `FOREIGN KEY ("intercity_trip_id") REFERENCES "intercity_trips"("id") ON DELETE RESTRICT`,
    );
    await this.addConstraintOnce(
      queryRunner,
      'orders',
      'chk_orders_booking_kind',
      `CHECK ("booking_kind" IS NULL OR "booking_kind" IN ('seat', 'whole_car'))`,
    );
    await this.addConstraintOnce(
      queryRunner,
      'orders',
      'chk_orders_seats_positive',
      `CHECK ("seats" IS NULL OR "seats" BETWEEN 1 AND 8)`,
    );

    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "intercity_free_cancel_minutes" integer NOT NULL DEFAULT 60,
      ADD COLUMN IF NOT EXISTS "intercity_max_seats_per_booking" integer NOT NULL DEFAULT 4,
      ADD COLUMN IF NOT EXISTS "intercity_min_lead_minutes" integer NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS "intercity_max_ahead_days" integer NOT NULL DEFAULT 7`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      DROP COLUMN IF EXISTS "intercity_max_ahead_days",
      DROP COLUMN IF EXISTS "intercity_min_lead_minutes",
      DROP COLUMN IF EXISTS "intercity_max_seats_per_booking",
      DROP COLUMN IF EXISTS "intercity_free_cancel_minutes"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_seats_positive"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_booking_kind"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "fk_orders_intercity_trip"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_intercity_trip_id"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "booking_kind",
        DROP COLUMN IF EXISTS "seats",
        DROP COLUMN IF EXISTS "intercity_trip_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "intercity_trips"`);
  }

  /** `ADD CONSTRAINT` da `IF NOT EXISTS` yo'q — katalogdan tekshiriladi. */
  private async addConstraintOnce(
    queryRunner: QueryRunner,
    table: string,
    name: string,
    definition: string,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$
    `);
  }
}
