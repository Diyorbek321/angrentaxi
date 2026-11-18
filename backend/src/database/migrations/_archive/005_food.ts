import { MigrationInterface, QueryRunner } from 'typeorm';

// Documents the production schema for the Food vertical (restaurant
// dashboard + customer storefront). Like 004_market.ts, dev environments run
// with DB_SYNC (TypeORM synchronize) on, so this migration exists for the
// DB_SYNC=false production path.
export class Food1700000000005 implements MigrationInterface {
  name = 'Food1700000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'restaurant';`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE restaurant_status_enum AS ENUM ('active', 'closed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE food_order_status_enum AS ENUM ('new', 'preparing', 'ready', 'delivered', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE food_payment_method_enum AS ENUM ('card', 'cash');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id UUID NOT NULL UNIQUE REFERENCES users(id),
        name VARCHAR NOT NULL,
        phone VARCHAR,
        address VARCHAR,
        location GEOMETRY(Point, 4326),
        hours JSONB NOT NULL,
        delivery_radius_km INT NOT NULL DEFAULT 7,
        commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
        notifications JSONB NOT NULL DEFAULT '{"sound":true,"push":true,"sms":false}',
        status restaurant_status_enum NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS menu_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dishes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        category_id UUID REFERENCES menu_categories(id),
        name VARCHAR NOT NULL,
        description VARCHAR,
        price DECIMAL(12, 2) NOT NULL,
        prep_minutes INT NOT NULL DEFAULT 10,
        is_available BOOLEAN NOT NULL DEFAULT true,
        tags JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS food_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id),
        customer_id UUID NOT NULL REFERENCES users(id),
        status food_order_status_enum NOT NULL DEFAULT 'new',
        items JSONB NOT NULL,
        delivery_address VARCHAR NOT NULL,
        customer_phone VARCHAR,
        payment_method food_payment_method_enum NOT NULL DEFAULT 'cash',
        total_price DECIMAL(12, 2) NOT NULL,
        note VARCHAR,
        reject_reason VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON menu_categories (restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_dishes_restaurant ON dishes (restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_food_orders_restaurant ON food_orders (restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_food_orders_customer ON food_orders (customer_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS food_orders CASCADE;
      DROP TABLE IF EXISTS dishes CASCADE;
      DROP TABLE IF EXISTS menu_categories CASCADE;
      DROP TABLE IF EXISTS restaurants CASCADE;
      DROP TYPE IF EXISTS food_payment_method_enum;
      DROP TYPE IF EXISTS food_order_status_enum;
      DROP TYPE IF EXISTS restaurant_status_enum;
    `);
  }
}
