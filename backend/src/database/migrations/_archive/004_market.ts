import { MigrationInterface, QueryRunner } from 'typeorm';

// Documents the production schema for the Market vertical (seller dashboard +
// customer storefront). Like 003_driver_wallet.ts, dev environments run with
// DB_SYNC (TypeORM synchronize) on, so this migration exists for the
// DB_SYNC=false production path.
export class Market1700000000004 implements MigrationInterface {
  name = 'Market1700000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'market';`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE store_delivery_mode_enum AS ENUM ('self', 'platform');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE store_status_enum AS ENUM ('active', 'closed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE product_unit_enum AS ENUM ('dona', 'kg', 'litr');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE product_status_enum AS ENUM ('active', 'out', 'hidden');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE market_order_status_enum AS ENUM ('new', 'packing', 'shipped', 'delivered', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE market_order_delivery_mode_enum AS ENUM ('self', 'platform');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id UUID NOT NULL UNIQUE REFERENCES users(id),
        name VARCHAR NOT NULL,
        phone VARCHAR,
        address VARCHAR,
        location GEOMETRY(Point, 4326),
        working_hours_start VARCHAR NOT NULL DEFAULT '08:00',
        working_hours_end VARCHAR NOT NULL DEFAULT '22:00',
        delivery_mode store_delivery_mode_enum NOT NULL DEFAULT 'platform',
        low_stock_threshold INT NOT NULL DEFAULT 10,
        status store_status_enum NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS market_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        emoji VARCHAR NOT NULL DEFAULT '🛒',
        sort_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        category_id UUID REFERENCES market_categories(id),
        name VARCHAR NOT NULL,
        sku VARCHAR,
        price DECIMAL(12, 2) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        unit product_unit_enum NOT NULL DEFAULT 'dona',
        status product_status_enum NOT NULL DEFAULT 'active',
        emoji VARCHAR NOT NULL DEFAULT '📦',
        hue INT NOT NULL DEFAULT 45,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        delta INT NOT NULL,
        note VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS market_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id),
        customer_id UUID NOT NULL REFERENCES users(id),
        status market_order_status_enum NOT NULL DEFAULT 'new',
        items JSONB NOT NULL,
        delivery_mode market_order_delivery_mode_enum NOT NULL DEFAULT 'platform',
        delivery_address VARCHAR NOT NULL,
        customer_phone VARCHAR,
        total_price DECIMAL(12, 2) NOT NULL,
        note VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_market_categories_store ON market_categories (store_id);
      CREATE INDEX IF NOT EXISTS idx_products_store ON products (store_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_store ON stock_movements (store_id);
      CREATE INDEX IF NOT EXISTS idx_market_orders_store ON market_orders (store_id);
      CREATE INDEX IF NOT EXISTS idx_market_orders_customer ON market_orders (customer_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS market_orders CASCADE;
      DROP TABLE IF EXISTS stock_movements CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS market_categories CASCADE;
      DROP TABLE IF EXISTS stores CASCADE;
      DROP TYPE IF EXISTS market_order_delivery_mode_enum;
      DROP TYPE IF EXISTS market_order_status_enum;
      DROP TYPE IF EXISTS product_status_enum;
      DROP TYPE IF EXISTS product_unit_enum;
      DROP TYPE IF EXISTS store_status_enum;
      DROP TYPE IF EXISTS store_delivery_mode_enum;
    `);
    // Postgres cannot remove a single enum value; 'market' is left in
    // user_role_enum on rollback (harmless, matches how role additions are
    // generally irreversible without recreating the type).
  }
}
