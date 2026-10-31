import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TAKSOMETR — manzilsiz taksi buyurtmasi, narx haqiqiy GPS izidan.
 */
export class Taximeter1700000001600 implements MigrationInterface {
  name = 'Taximeter1700000001600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_metered" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trip_track_points" (
        "id" BIGSERIAL NOT NULL,
        "order_id" uuid NOT NULL,
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_track_points_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trip_track_points_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_trip_track_points_order_time" ON "trip_track_points" ("order_id", "recorded_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_track_points"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "is_metered"`);
  }
}
