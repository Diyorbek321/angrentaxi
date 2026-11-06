import { MigrationInterface, QueryRunner } from 'typeorm';

// Read-path indexes for the tables that grow with traffic (orders, the money
// ledger, marketplace orders, support, safety). Before this, only primary keys
// and the implicit unique indexes (users.phone, promo_codes.code, the @Unique
// composites on ratings / promo_code_usages / driver_bonus_awards) existed, so
// every history page, dispatcher poll and dashboard counter was a sequential
// scan — fine at a few hundred rows, quadratically worse after a few thousand.
//
// Index definitions mirror the @Index decorators on the entities one-for-one
// (same names, same column order), so a DB_SYNC=true environment and a
// migrated environment converge on the same schema.
//
// Composite ordering rule used throughout: filter column(s) first, then the
// column the query sorts on (created_at / requested_at / last_message_at).
// Postgres can walk such an index backwards, so an ASC index serves the
// `ORDER BY ... DESC` these queries all use, and the sort disappears from the
// plan entirely.
//
// CONCURRENTLY is deliberately NOT used. `CREATE INDEX CONCURRENTLY` cannot
// run inside a transaction block, and TypeORM wraps each migration in one
// (`migration:run` uses a transaction per migration by default). Making these
// concurrent would mean either running the migration outside TypeORM or
// disabling transactional migrations globally — not worth it at the current
// data volume, where each of these tables is small enough that a plain
// `CREATE INDEX` holds its ACCESS EXCLUSIVE lock for well under a second.
// Revisit if `orders` ever reaches the millions of rows: at that point apply
// the statements manually with CONCURRENTLY (see
// docs/db-index-migration-runbook.md) during a low-traffic window.
export class PerformanceIndexes1700000000022 implements MigrationInterface {
  name = 'PerformanceIndexes1700000000022';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- orders: driver/passenger history, dispatcher board, dashboard + reports
      CREATE INDEX IF NOT EXISTS idx_orders_driver_id_created_at ON orders (driver_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_passenger_id_created_at ON orders (passenger_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders (status, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);

      -- transactions: wallet history, balance/referral aggregates, webhook idempotency
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at ON transactions (user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions (order_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions (external_id);

      -- withdrawal_requests: requester history + admin payout queue
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_driver_id_requested_at
        ON withdrawal_requests (driver_id, requested_at);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_requested_at
        ON withdrawal_requests (status, requested_at);

      -- market_orders: vendor panel + customer order list
      CREATE INDEX IF NOT EXISTS idx_market_orders_store_id_created_at ON market_orders (store_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_market_orders_store_id_status ON market_orders (store_id, status);
      CREATE INDEX IF NOT EXISTS idx_market_orders_customer_id_created_at
        ON market_orders (customer_id, created_at);

      -- food_orders: kitchen board + customer order list
      CREATE INDEX IF NOT EXISTS idx_food_orders_restaurant_id_created_at
        ON food_orders (restaurant_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_food_orders_restaurant_id_status ON food_orders (restaurant_id, status);
      CREATE INDEX IF NOT EXISTS idx_food_orders_customer_id_created_at ON food_orders (customer_id, created_at);

      -- ratings: per-driver rating breakdown (order_id is already covered by
      -- the (order_id, from_user_id) unique index)
      CREATE INDEX IF NOT EXISTS idx_ratings_to_user_id ON ratings (to_user_id);

      -- drivers: profile lookup by user, online counters / roster filter
      CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers (user_id);
      CREATE INDEX IF NOT EXISTS idx_drivers_is_online_updated_at ON drivers (is_online, updated_at);

      -- driver_documents: KYC list per driver
      CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON driver_documents (driver_id);

      -- support: thread get-or-create, operator inbox, message pagination
      CREATE INDEX IF NOT EXISTS idx_support_threads_user_id ON support_threads (user_id);
      CREATE INDEX IF NOT EXISTS idx_support_threads_status_last_message_at
        ON support_threads (status, last_message_at);
      CREATE INDEX IF NOT EXISTS idx_support_messages_thread_id_created_at
        ON support_messages (thread_id, created_at);

      -- sos_alerts: active list + "resolved today" shift-report stat
      CREATE INDEX IF NOT EXISTS idx_sos_alerts_status_created_at ON sos_alerts (status, created_at);
      CREATE INDEX IF NOT EXISTS idx_sos_alerts_status_resolved_at ON sos_alerts (status, resolved_at);

      -- users: admin user list by role, referral counts
      CREATE INDEX IF NOT EXISTS idx_users_role_created_at ON users (role, created_at);
      CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id ON users (referred_by_user_id);

      -- trips: always reached from its order
      CREATE INDEX IF NOT EXISTS idx_trips_order_id ON trips (order_id);

      -- favorite_addresses: always read scoped to one user
      CREATE INDEX IF NOT EXISTS idx_favorite_addresses_user_id ON favorite_addresses (user_id);

      -- marketplace catalogs: always read per store / per restaurant
      CREATE INDEX IF NOT EXISTS idx_products_store_id_status ON products (store_id, status);
      CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id_is_available ON dishes (restaurant_id, is_available);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_orders_driver_id_created_at;
      DROP INDEX IF EXISTS idx_orders_passenger_id_created_at;
      DROP INDEX IF EXISTS idx_orders_status_created_at;
      DROP INDEX IF EXISTS idx_orders_created_at;

      DROP INDEX IF EXISTS idx_transactions_user_id_created_at;
      DROP INDEX IF EXISTS idx_transactions_order_id;
      DROP INDEX IF EXISTS idx_transactions_external_id;

      DROP INDEX IF EXISTS idx_withdrawal_requests_driver_id_requested_at;
      DROP INDEX IF EXISTS idx_withdrawal_requests_status_requested_at;

      DROP INDEX IF EXISTS idx_market_orders_store_id_created_at;
      DROP INDEX IF EXISTS idx_market_orders_store_id_status;
      DROP INDEX IF EXISTS idx_market_orders_customer_id_created_at;

      DROP INDEX IF EXISTS idx_food_orders_restaurant_id_created_at;
      DROP INDEX IF EXISTS idx_food_orders_restaurant_id_status;
      DROP INDEX IF EXISTS idx_food_orders_customer_id_created_at;

      DROP INDEX IF EXISTS idx_ratings_to_user_id;

      DROP INDEX IF EXISTS idx_drivers_user_id;
      DROP INDEX IF EXISTS idx_drivers_is_online_updated_at;

      DROP INDEX IF EXISTS idx_driver_documents_driver_id;

      DROP INDEX IF EXISTS idx_support_threads_user_id;
      DROP INDEX IF EXISTS idx_support_threads_status_last_message_at;
      DROP INDEX IF EXISTS idx_support_messages_thread_id_created_at;

      DROP INDEX IF EXISTS idx_sos_alerts_status_created_at;
      DROP INDEX IF EXISTS idx_sos_alerts_status_resolved_at;

      DROP INDEX IF EXISTS idx_users_role_created_at;
      DROP INDEX IF EXISTS idx_users_referred_by_user_id;

      DROP INDEX IF EXISTS idx_trips_order_id;

      DROP INDEX IF EXISTS idx_favorite_addresses_user_id;

      DROP INDEX IF EXISTS idx_products_store_id_status;
      DROP INDEX IF EXISTS idx_dishes_restaurant_id_is_available;
    `);
  }
}
