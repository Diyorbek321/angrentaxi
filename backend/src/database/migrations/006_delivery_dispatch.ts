import { MigrationInterface, QueryRunner } from 'typeorm';

// Bridges Market/Food orders into the ride-hailing driver-matching pipeline:
// vendor pickup coordinates (Store/Restaurant), customer dropoff coordinates,
// and a link column back to the dispatched `orders` row. Like 004/005, dev
// environments run with DB_SYNC on; this documents the production path.
export class DeliveryDispatch1700000000006 implements MigrationInterface {
  name = 'DeliveryDispatch1700000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE stores
        ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 7),
        ADD COLUMN IF NOT EXISTS lng DECIMAL(10, 7);

      ALTER TABLE restaurants
        ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 7),
        ADD COLUMN IF NOT EXISTS lng DECIMAL(10, 7);

      ALTER TABLE market_orders
        ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10, 7) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(10, 7) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS delivery_order_id UUID;

      ALTER TABLE food_orders
        ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10, 7) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(10, 7) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS delivery_order_id UUID;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE food_orders
        DROP COLUMN IF EXISTS delivery_order_id,
        DROP COLUMN IF EXISTS delivery_lng,
        DROP COLUMN IF EXISTS delivery_lat;

      ALTER TABLE market_orders
        DROP COLUMN IF EXISTS delivery_order_id,
        DROP COLUMN IF EXISTS delivery_lng,
        DROP COLUMN IF EXISTS delivery_lat;

      ALTER TABLE restaurants
        DROP COLUMN IF EXISTS lng,
        DROP COLUMN IF EXISTS lat;

      ALTER TABLE stores
        DROP COLUMN IF EXISTS lng,
        DROP COLUMN IF EXISTS lat;
    `);
  }
}
