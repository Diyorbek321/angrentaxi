import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shaharlararo — yo'lovchi so'rovlari doskasi (`intercity-request.entity.ts`).
 *
 * Qatnov topmagan yo'lovchi so'rov qoldiradi (yo'nalish, vaqt oralig'i,
 * joylar, manzillar, muzlatilgan narx + o'zi qo'shgan summa); haydovchi
 * qabul qilsa band uning qatnoviga tushadi. Ochiq so'rov oraliq tugaganda
 * cron bilan `expired` bo'ladi.
 *
 * `uq_intercity_requests_open_passenger` — bitta yo'lovchida bitta ochiq
 * so'rov (ikki haydovchi ikki so'rovni qabul qilib, yo'lovchini ikki
 * mashinaga yozmasin).
 */
export class IntercityRequests1700000004100 implements MigrationInterface {
  name = 'IntercityRequests1700000004100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercity_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "passenger_id" uuid NOT NULL,
        "route_id" uuid NOT NULL,
        "class" character varying(10) NOT NULL DEFAULT 'start',
        "kind" character varying(12) NOT NULL DEFAULT 'seat',
        "seats" integer NOT NULL DEFAULT 1,
        "pickup_lat" numeric(10,7) NOT NULL,
        "pickup_lng" numeric(10,7) NOT NULL,
        "pickup_address" character varying(300) NOT NULL,
        "dropoff_lat" numeric(10,7) NOT NULL,
        "dropoff_lng" numeric(10,7) NOT NULL,
        "dropoff_address" character varying(300) NOT NULL,
        "window_start" TIMESTAMP WITH TIME ZONE NOT NULL,
        "window_end" TIMESTAMP WITH TIME ZONE NOT NULL,
        "base_price" numeric(12,2) NOT NULL,
        "bonus" numeric(12,2) NOT NULL DEFAULT 0,
        "fare_breakdown" jsonb NOT NULL,
        "status" character varying(12) NOT NULL DEFAULT 'open',
        "trip_id" uuid,
        "order_id" uuid,
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        "closed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intercity_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_intercity_requests_route_status_window"
        ON "intercity_requests" ("route_id", "status", "window_end")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_intercity_requests_passenger"
        ON "intercity_requests" ("passenger_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_intercity_requests_open_passenger"
        ON "intercity_requests" ("passenger_id") WHERE "status" = 'open'
    `);

    const constraints: Array<[string, string]> = [
      ['fk_intercity_requests_passenger', `FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT`],
      ['fk_intercity_requests_route', `FOREIGN KEY ("route_id") REFERENCES "intercity_routes"("id") ON DELETE RESTRICT`],
      ['fk_intercity_requests_trip', `FOREIGN KEY ("trip_id") REFERENCES "intercity_trips"("id") ON DELETE SET NULL`],
      ['fk_intercity_requests_order', `FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL`],
      ['chk_intercity_requests_status', `CHECK ("status" IN ('open', 'accepted', 'cancelled', 'expired'))`],
      ['chk_intercity_requests_class', `CHECK ("class" IN ('start', 'comfort'))`],
      ['chk_intercity_requests_kind', `CHECK ("kind" IN ('seat', 'whole_car'))`],
      ['chk_intercity_requests_seats', `CHECK ("seats" BETWEEN 1 AND 8)`],
      ['chk_intercity_requests_window', `CHECK ("window_end" > "window_start")`],
      ['chk_intercity_requests_money', `CHECK ("base_price" > 0 AND "bonus" >= 0)`],
    ];
    for (const [name, definition] of constraints) {
      await this.addConstraintOnce(queryRunner, name, definition);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "intercity_requests"`);
  }

  private async addConstraintOnce(queryRunner: QueryRunner, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "intercity_requests" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$
    `);
  }
}
