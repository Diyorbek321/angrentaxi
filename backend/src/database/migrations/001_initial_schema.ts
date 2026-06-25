import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000001 implements MigrationInterface {
  name = 'InitialSchema1700000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Enable PostGIS
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE user_role_enum AS ENUM ('passenger', 'driver', 'manager', 'admin');
    `);

    await queryRunner.query(`
      CREATE TYPE user_status_enum AS ENUM ('active', 'blocked');
    `);

    await queryRunner.query(`
      CREATE TYPE order_status_enum AS ENUM (
        'created', 'searching', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE payment_method_enum AS ENUM ('cash', 'card', 'wallet');
    `);

    await queryRunner.query(`
      CREATE TYPE transaction_type_enum AS ENUM ('credit', 'debit');
    `);

    await queryRunner.query(`
      CREATE TYPE transaction_status_enum AS ENUM ('pending', 'completed', 'failed', 'refunded');
    `);

    // Users table
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(100),
        role user_role_enum NOT NULL DEFAULT 'passenger',
        status user_status_enum NOT NULL DEFAULT 'active',
        fcm_token VARCHAR(500),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_phone ON users (phone);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_role ON users (role);
    `);

    // OTPs table
    await queryRunner.query(`
      CREATE TABLE otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL,
        code VARCHAR(10) NOT NULL,
        is_used BOOLEAN NOT NULL DEFAULT false,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_otps_phone ON otps (phone);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_otps_expires_at ON otps (expires_at);
    `);

    // Tariffs table
    await queryRunner.query(`
      CREATE TABLE tariffs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        base_price DECIMAL(10, 2) NOT NULL,
        price_per_km DECIMAL(10, 2) NOT NULL,
        price_per_min DECIMAL(10, 2) NOT NULL,
        min_price DECIMAL(10, 2) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Drivers table
    await queryRunner.query(`
      CREATE TABLE drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        car_model VARCHAR(100),
        car_number VARCHAR(20),
        license_plate VARCHAR(20),
        rating DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
        is_online BOOLEAN NOT NULL DEFAULT false,
        current_location geometry(Point, 4326),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_drivers_user_id ON drivers (user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_drivers_is_online ON drivers (is_online);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_drivers_location ON drivers USING GIST (current_location);
    `);

    // Orders table
    await queryRunner.query(`
      CREATE TABLE orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        passenger_id UUID NOT NULL REFERENCES users(id),
        driver_id UUID REFERENCES users(id),
        tariff_id UUID NOT NULL REFERENCES tariffs(id),
        pickup_location geometry(Point, 4326) NOT NULL,
        dropoff_location geometry(Point, 4326) NOT NULL,
        pickup_address VARCHAR(500),
        dropoff_address VARCHAR(500),
        estimated_price DECIMAL(10, 2) NOT NULL,
        final_price DECIMAL(10, 2),
        status order_status_enum NOT NULL DEFAULT 'created',
        payment_method payment_method_enum NOT NULL DEFAULT 'cash',
        note VARCHAR(300),
        cancel_reason VARCHAR(300),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_orders_status ON orders (status);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_orders_passenger_id ON orders (passenger_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_orders_driver_id ON orders (driver_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_orders_pickup_location ON orders USING GIST (pickup_location);
    `);

    // Trips table
    await queryRunner.query(`
      CREATE TABLE trips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        actual_distance_km DECIMAL(10, 3),
        actual_duration_min INTEGER
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_trips_order_id ON trips (order_id);
    `);

    // Transactions table
    await queryRunner.query(`
      CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        order_id UUID REFERENCES orders(id),
        amount DECIMAL(10, 2) NOT NULL,
        type transaction_type_enum NOT NULL,
        payment_method payment_method_enum NOT NULL,
        status transaction_status_enum NOT NULL DEFAULT 'pending',
        external_id VARCHAR(200),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_transactions_user_id ON transactions (user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_transactions_order_id ON transactions (order_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_transactions_status ON transactions (status);
    `);

    // Insert default tariffs
    await queryRunner.query(`
      INSERT INTO tariffs (name, base_price, price_per_km, price_per_min, min_price, is_active)
      VALUES
        ('Standard', 3000, 1500, 200, 5000, true),
        ('Comfort', 5000, 2500, 300, 8000, true),
        ('Business', 8000, 4000, 500, 15000, true);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS transactions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS trips CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS drivers CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tariffs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS otps CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS transaction_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS transaction_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_method_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role_enum;`);

    await queryRunner.query(`DROP EXTENSION IF EXISTS postgis;`);
  }
}
