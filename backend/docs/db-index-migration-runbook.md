# DB index migration runbook (migration 022)

Applies `022_performance_indexes` — the read-path indexes for `orders`,
`transactions`, `withdrawal_requests`, `market_orders`, `food_orders`,
`ratings`, `drivers`, `driver_documents`, `support_*`, `sos_alerts`, `users`,
`trips`, `favorite_addresses`, `products` and `dishes`.

**Why this needs a runbook.** Production was built by TypeORM `synchronize`,
not by migrations. That means the schema exists but the `migrations` bookkeeping
table may be empty or partial, so a plain `npm run migration:run` will try to
replay 001–021 and can fail (or, worse, half-apply) on objects that already
exist. Check the bookkeeping first, then pick scenario (a) or (b).

Migration 022 itself is written to be safe either way: every statement is
`CREATE INDEX IF NOT EXISTS`, so re-running it is a no-op.

---

## 0. Back up first

Non-negotiable, even though this migration only adds indexes.

```bash
# Railway: grab the connection string from the Postgres service variables
pg_dump "$DATABASE_URL" --format=custom --no-owner \
  --file="angrentaxi-$(date +%Y%m%d-%H%M%S).dump"

# Verify the dump is readable before touching anything
pg_restore --list angrentaxi-*.dump | head
```

Keep the dump off the server (download it locally) until the deploy is
confirmed good.

---

## 1. Check the state of the `migrations` table

```sql
-- Does TypeORM's bookkeeping table exist at all?
SELECT to_regclass('public.migrations') AS migrations_table;

-- If it does: what has been recorded, newest first?
SELECT id, timestamp, name
FROM migrations
ORDER BY timestamp DESC;
```

Read the result as:

- **Rows for 001–021 present** (names like `OtpBruteForceProtection1700000000021`)
  → **scenario (a)**.
- **Table missing, empty, or only a partial list** → **scenario (b)**.

---

## 2a. Scenario (a) — migrations are properly recorded

```bash
cd backend
npm run build          # migrations are compiled TS
npm run migration:run  # should apply only 022
```

Expected log: one `PerformanceIndexes1700000000022` entry, nothing else.
If TypeORM starts announcing 001/002/… instead, **abort** (Ctrl-C) and switch
to scenario (b) — the bookkeeping was not as complete as it looked.

---

## 2b. Scenario (b) — bookkeeping missing/partial: apply the SQL by hand

Run the block below directly against production (`psql "$DATABASE_URL" -f …`).
It is the exact `up()` body of `022_performance_indexes.ts`.

`CONCURRENTLY` is not used here for the same reason it is not used in the
migration: it cannot run inside a transaction, and these tables are small
enough that each `CREATE INDEX` holds its lock for well under a second. If the
`orders` table has since grown into the millions of rows, run this file with
`CREATE INDEX CONCURRENTLY` instead (statement by statement, autocommit, no
`BEGIN`) during a low-traffic window; the index names must stay identical.

```sql
CREATE INDEX IF NOT EXISTS idx_orders_driver_id_created_at ON orders (driver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_passenger_id_created_at ON orders (passenger_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at ON transactions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions (external_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_driver_id_requested_at
  ON withdrawal_requests (driver_id, requested_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_requested_at
  ON withdrawal_requests (status, requested_at);

CREATE INDEX IF NOT EXISTS idx_market_orders_store_id_created_at ON market_orders (store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_market_orders_store_id_status ON market_orders (store_id, status);
CREATE INDEX IF NOT EXISTS idx_market_orders_customer_id_created_at ON market_orders (customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_food_orders_restaurant_id_created_at ON food_orders (restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_food_orders_restaurant_id_status ON food_orders (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_food_orders_customer_id_created_at ON food_orders (customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ratings_to_user_id ON ratings (to_user_id);

CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers (user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_is_online_updated_at ON drivers (is_online, updated_at);

CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON driver_documents (driver_id);

CREATE INDEX IF NOT EXISTS idx_support_threads_user_id ON support_threads (user_id);
CREATE INDEX IF NOT EXISTS idx_support_threads_status_last_message_at
  ON support_threads (status, last_message_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread_id_created_at
  ON support_messages (thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_status_created_at ON sos_alerts (status, created_at);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status_resolved_at ON sos_alerts (status, resolved_at);

CREATE INDEX IF NOT EXISTS idx_users_role_created_at ON users (role, created_at);
CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id ON users (referred_by_user_id);

CREATE INDEX IF NOT EXISTS idx_trips_order_id ON trips (order_id);

CREATE INDEX IF NOT EXISTS idx_favorite_addresses_user_id ON favorite_addresses (user_id);

CREATE INDEX IF NOT EXISTS idx_products_store_id_status ON products (store_id, status);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id_is_available ON dishes (restaurant_id, is_available);
```

Then record 022 as applied, so a future `migration:run` does not try it again:

```sql
-- Only if the migrations table exists; create it the way TypeORM does if not.
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  name VARCHAR NOT NULL
);

INSERT INTO migrations (timestamp, name)
SELECT 1700000000022, 'PerformanceIndexes1700000000022'
WHERE NOT EXISTS (
  SELECT 1 FROM migrations WHERE name = 'PerformanceIndexes1700000000022'
);
```

Note this only backfills 022. Reconciling the 001–021 bookkeeping is a separate
piece of work; until it is done, keep using scenario (b) for new migrations.

---

## 3. Verify the indexes landed

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

Expect 30 `idx_*` rows from this migration (plus `idx_otps_phone` from 021 and
the two pre-existing notification/trip-message indexes). In `psql`, `\di idx_*`
gives the same list.

Spot-check that the planner actually uses them — this should report an
`Index Scan` / `Index Scan Backward`, not a `Seq Scan`:

```sql
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE status IN ('searching','accepted','arrived','in_progress')
ORDER BY created_at DESC
LIMIT 200;

EXPLAIN ANALYZE
SELECT * FROM orders WHERE driver_id = '<some-uuid>' ORDER BY created_at DESC LIMIT 20;
```

If the plans still show `Seq Scan`, run `ANALYZE orders;` (and the other touched
tables) so the planner has fresh statistics, then re-check.

---

## 4. Rollback

Indexes are additive — dropping them only restores the previous (slower) plans,
it never loses data. No application rollback is required alongside it.

Scenario (a):

```bash
cd backend && npm run migration:revert   # runs 022's down()
```

Scenario (b), by hand:

```sql
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

DELETE FROM migrations WHERE name = 'PerformanceIndexes1700000000022';
```

Caveat: if the app runs with `DB_SYNC=true` anywhere, TypeORM will recreate
these indexes from the `@Index` decorators on the next boot. Turn synchronize
off before rolling back if the rollback needs to stick.
