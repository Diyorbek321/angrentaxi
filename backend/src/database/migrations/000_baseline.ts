import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Baseline schema, generated from the entity definitions.
 *
 * It replaces the hand-written 001-023 migrations (kept in `_archive/` for
 * history), which had drifted from the entities badly enough to be unrunnable:
 * 002 referenced a `promo_codes` table no migration ever created, and
 * `promo_code_usages`, `ratings`, `support_threads` and `support_messages` had
 * no migration at all. A fresh database therefore had no working path to a
 * correct schema.
 *
 * Servers whose schema was built by `synchronize` before migrations were
 * usable (the current Railway deployment) already have every table. Running
 * CREATE TABLE there would fail the deploy, so `up()` detects a complete
 * existing schema and records itself as applied without touching it.
 *
 * Regenerate with:
 *   DB_NAME=<empty db> npx typeorm-ts-node-commonjs migration:generate \
 *     src/database/migrations/gen -d src/config/typeorm.config.ts
 */

/** Every table this baseline creates, used to verify a pre-existing schema is complete. */
const EXPECTED_TABLES: readonly string[] = [
    'dishes',
    'dispatch_overrides',
    'driver_bonus_awards',
    'driver_bonus_rules',
    'driver_documents',
    'drivers',
    'favorite_addresses',
    'food_orders',
    'market_categories',
    'market_orders',
    'menu_categories',
    'notification_logs',
    'orders',
    'otps',
    'platform_settings',
    'products',
    'promo_code_usages',
    'promo_codes',
    'push_notification_logs',
    'ratings',
    'refresh_tokens',
    'restaurants',
    'sos_alerts',
    'stock_movements',
    'stores',
    'support_messages',
    'support_threads',
    'tariff_change_requests',
    'tariffs',
    'transactions',
    'trip_messages',
    'trips',
    'users',
    'withdrawal_requests',
];

export class Baseline1700000000000 implements MigrationInterface {
    name = 'Baseline1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // uuid_generate_v4() and the geometry(Point,4326) columns below both
        // depend on these; a fresh Postgres has neither.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

        if (await queryRunner.hasTable('users')) {
            // Pre-existing schema (built by synchronize before migrations were
            // usable). Only treat it as baselined if it is actually complete —
            // silently marking a partial schema as migrated would leave the
            // server missing tables with no remaining path to repair them.
            const missing: string[] = [];
            for (const table of EXPECTED_TABLES) {
                if (!(await queryRunner.hasTable(table))) {
                    missing.push(table);
                }
            }

            if (missing.length > 0) {
                throw new Error(
                    `Cannot baseline: the database has a partial schema, missing ${missing.length} ` +
                        `table(s): ${missing.join(', ')}. Start the server once with DB_SYNC=true to ` +
                        'let synchronize complete the schema, then redeploy with DB_SYNC=false.',
                );
            }

            return;
        }

        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('passenger', 'driver', 'manager', 'admin', 'market', 'restaurant')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'blocked', 'pending')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying NOT NULL, "first_name" character varying(50), "last_name" character varying(50), "role" "public"."users_role_enum" NOT NULL DEFAULT 'passenger', "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "block_reason" character varying(300), "fcm_token" character varying, "referral_code" character varying(10) NOT NULL, "referred_by_user_id" uuid, "permissions" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_ba10055f9ef9690e77cf6445cba" UNIQUE ("referral_code"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_users_referred_by_user_id" ON "users" ("referred_by_user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_users_role_created_at" ON "users" ("role", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."withdrawal_requests_owner_type_enum" AS ENUM('driver', 'vendor', 'restaurant')`);
        await queryRunner.query(`CREATE TYPE "public"."withdrawal_requests_status_enum" AS ENUM('pending', 'approved', 'rejected', 'paid')`);
        await queryRunner.query(`CREATE TABLE "withdrawal_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "owner_type" "public"."withdrawal_requests_owner_type_enum" NOT NULL DEFAULT 'driver', "amount" numeric(10,2) NOT NULL, "status" "public"."withdrawal_requests_status_enum" NOT NULL DEFAULT 'pending', "payout_destination" character varying NOT NULL, "requested_at" TIMESTAMP NOT NULL DEFAULT now(), "processed_at" TIMESTAMP, "admin_note" character varying, CONSTRAINT "PK_e1b3734a3f3cbd46bf0ad7eedb6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_withdrawal_requests_status_requested_at" ON "withdrawal_requests" ("status", "requested_at") `);
        await queryRunner.query(`CREATE INDEX "idx_withdrawal_requests_driver_id_requested_at" ON "withdrawal_requests" ("driver_id", "requested_at") `);
        await queryRunner.query(`CREATE TABLE "tariffs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "service_type" character varying NOT NULL DEFAULT 'taxi', "vehicle_type" character varying, "base_price" numeric(10,2) NOT NULL, "price_per_km" numeric(10,2) NOT NULL, "price_per_min" numeric(10,2) NOT NULL, "min_price" numeric(10,2) NOT NULL, "surge_multiplier" numeric(3,1) NOT NULL DEFAULT '1', "max_price" numeric(10,2), "is_active" boolean NOT NULL DEFAULT true, "tier" integer NOT NULL DEFAULT '1', "min_car_year" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7f32baf8d8b4bb0cf4d7ac97741" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "promo_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(50) NOT NULL, "discount_percent" numeric(5,2), "discount_fixed" numeric(10,2), "max_uses" integer, "used_count" integer NOT NULL DEFAULT '0', "min_order_amount" numeric(10,2) NOT NULL DEFAULT '0', "expires_at" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2f096c406a9d9d5b8ce204190c3" UNIQUE ("code"), CONSTRAINT "PK_c7b4f01710fda5afa056a2b4a35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."orders_service_type_enum" AS ENUM('taxi', 'cargo', 'food', 'market')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('created', 'searching', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_payment_method_enum" AS ENUM('cash', 'card', 'wallet')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "passenger_id" uuid NOT NULL, "driver_id" uuid, "tariff_id" uuid NOT NULL, "pickup_location" geometry(Point,4326) NOT NULL, "dropoff_location" geometry(Point,4326) NOT NULL, "pickup_address" character varying, "dropoff_address" character varying, "waypoints" jsonb, "estimated_price" numeric(10,2) NOT NULL, "final_price" numeric(10,2), "promo_code_id" uuid, "discount_amount" numeric(10,2), "driver_earning" numeric(10,2), "service_type" "public"."orders_service_type_enum" NOT NULL DEFAULT 'taxi', "details" jsonb, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'created', "payment_method" "public"."orders_payment_method_enum" NOT NULL DEFAULT 'cash', "note" character varying, "cancel_reason" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_orders_created_at" ON "orders" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_status_created_at" ON "orders" ("status", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_passenger_id_created_at" ON "orders" ("passenger_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_driver_id_created_at" ON "orders" ("driver_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "start_time" TIMESTAMP, "end_time" TIMESTAMP, "actual_distance_km" numeric(10,3), "actual_duration_min" integer, CONSTRAINT "REL_8b3534829163c67172ad780549" UNIQUE ("order_id"), CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_trips_order_id" ON "trips" ("order_id") `);
        await queryRunner.query(`CREATE TABLE "trip_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "sender_role" character varying(20) NOT NULL, "body" character varying(500) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7ff74e17236f408922537c8d747" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d887fcb1d4f4c653518b6f93d0" ON "trip_messages" ("order_id") `);
        await queryRunner.query(`CREATE TYPE "public"."driver_bonus_rules_rule_type_enum" AS ENUM('trip_count', 'weekly_goal')`);
        await queryRunner.query(`CREATE TYPE "public"."driver_bonus_rules_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`CREATE TABLE "driver_bonus_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "rule_type" "public"."driver_bonus_rules_rule_type_enum" NOT NULL, "trip_threshold" integer NOT NULL, "bonus_amount" numeric(10,2) NOT NULL, "service_type" character varying, "status" "public"."driver_bonus_rules_status_enum" NOT NULL DEFAULT 'active', "created_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_38274ceb26cb0ee61530401da61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum" AS ENUM('credit', 'debit')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_payment_method_enum" AS ENUM('cash', 'card', 'wallet')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('pending', 'completed', 'failed', 'refunded')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "order_id" uuid, "amount" numeric(10,2) NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "payment_method" "public"."transactions_payment_method_enum" NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'pending', "external_id" character varying, "bonus_rule_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_transactions_external_id" ON "transactions" ("external_id") `);
        await queryRunner.query(`CREATE INDEX "idx_transactions_order_id" ON "transactions" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "idx_transactions_user_id_created_at" ON "transactions" ("user_id", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."tariff_change_requests_action_enum" AS ENUM('create', 'update')`);
        await queryRunner.query(`CREATE TYPE "public"."tariff_change_requests_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "tariff_change_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" "public"."tariff_change_requests_action_enum" NOT NULL, "tariff_id" uuid, "proposed_changes" jsonb NOT NULL, "previous_values" jsonb, "status" "public"."tariff_change_requests_status_enum" NOT NULL DEFAULT 'pending', "proposed_by" uuid NOT NULL, "reviewed_by" uuid, "review_note" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "reviewed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a24bc7b87d22220b553dacab336" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "support_threads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "user_role" character varying(20) NOT NULL, "order_id" uuid, "status" character varying(20) NOT NULL DEFAULT 'open', "assigned_manager_id" uuid, "last_read_at_user" TIMESTAMP WITH TIME ZONE, "last_read_at_operator" TIMESTAMP WITH TIME ZONE, "last_message_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_079837444b1d0c8907809fc5b25" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_support_threads_status_last_message_at" ON "support_threads" ("status", "last_message_at") `);
        await queryRunner.query(`CREATE INDEX "idx_support_threads_user_id" ON "support_threads" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "support_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "thread_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "sender_role" character varying(20) NOT NULL, "body" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2aa37479e71ef29cbf4dba2b1a2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_support_messages_thread_id_created_at" ON "support_messages" ("thread_id", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."stores_delivery_mode_enum" AS ENUM('self', 'platform')`);
        await queryRunner.query(`CREATE TYPE "public"."stores_status_enum" AS ENUM('active', 'closed')`);
        await queryRunner.query(`CREATE TABLE "stores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_user_id" uuid NOT NULL, "name" character varying NOT NULL, "phone" character varying, "address" character varying, "location" geometry(Point,4326), "lat" numeric(10,7), "lng" numeric(10,7), "working_hours_start" character varying NOT NULL DEFAULT '08:00', "working_hours_end" character varying NOT NULL DEFAULT '22:00', "delivery_mode" "public"."stores_delivery_mode_enum" NOT NULL DEFAULT 'platform', "low_stock_threshold" integer NOT NULL DEFAULT '10', "commission_rate" numeric(5,2) NOT NULL DEFAULT '10', "status" "public"."stores_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ba95f3c2644552c72431cfb0c78" UNIQUE ("owner_user_id"), CONSTRAINT "REL_ba95f3c2644552c72431cfb0c7" UNIQUE ("owner_user_id"), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "market_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "name" character varying NOT NULL, "emoji" character varying NOT NULL DEFAULT '🛒', "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e9306357275a20bc95816379cbf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."products_unit_enum" AS ENUM('dona', 'kg', 'litr')`);
        await queryRunner.query(`CREATE TYPE "public"."products_status_enum" AS ENUM('active', 'out', 'hidden')`);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "category_id" uuid, "name" character varying NOT NULL, "sku" character varying, "price" numeric(12,2) NOT NULL, "stock" integer NOT NULL DEFAULT '0', "unit" "public"."products_unit_enum" NOT NULL DEFAULT 'dona', "status" "public"."products_status_enum" NOT NULL DEFAULT 'active', "emoji" character varying NOT NULL DEFAULT '📦', "hue" integer NOT NULL DEFAULT '45', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_products_store_id_status" ON "products" ("store_id", "status") `);
        await queryRunner.query(`CREATE TABLE "stock_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "delta" integer NOT NULL, "note" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sos_alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "reported_by_user_id" uuid NOT NULL, "reported_by_role" character varying NOT NULL, "lat" numeric(10,7) NOT NULL, "lng" numeric(10,7) NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "resolved_at" TIMESTAMP, CONSTRAINT "PK_5c6f2f5f40ab2224315e007b9c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_sos_alerts_status_resolved_at" ON "sos_alerts" ("status", "resolved_at") `);
        await queryRunner.query(`CREATE INDEX "idx_sos_alerts_status_created_at" ON "sos_alerts" ("status", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."restaurants_status_enum" AS ENUM('active', 'closed')`);
        await queryRunner.query(`CREATE TABLE "restaurants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_user_id" uuid NOT NULL, "name" character varying NOT NULL, "phone" character varying, "address" character varying, "location" geometry(Point,4326), "lat" numeric(10,7), "lng" numeric(10,7), "hours" jsonb NOT NULL, "delivery_radius_km" integer NOT NULL DEFAULT '7', "commission_rate" numeric(5,2) NOT NULL DEFAULT '15', "notifications" jsonb NOT NULL DEFAULT '{"sound":true,"push":true,"sms":false}', "status" "public"."restaurants_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d429be1535b3d5f184061afb749" UNIQUE ("owner_user_id"), CONSTRAINT "REL_d429be1535b3d5f184061afb74" UNIQUE ("owner_user_id"), CONSTRAINT "PK_e2133a72eb1cc8f588f7b503e68" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "revoked_at" TIMESTAMP, "replaced_by_token_hash" character varying(64), "user_agent" character varying(255), "ip" character varying(64), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TABLE "ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "from_user_id" uuid NOT NULL, "to_user_id" uuid NOT NULL, "from_role" character varying(20) NOT NULL, "score" smallint NOT NULL, "comment" character varying(500), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8fd3429b76f44049f2b1f9d3a94" UNIQUE ("order_id", "from_user_id"), CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_ratings_to_user_id" ON "ratings" ("to_user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."push_notification_logs_audience_enum" AS ENUM('all', 'customers', 'drivers')`);
        await queryRunner.query(`CREATE TABLE "push_notification_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "body" character varying NOT NULL, "audience" "public"."push_notification_logs_audience_enum" NOT NULL, "sent_count" integer NOT NULL DEFAULT '0', "created_by_user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6d128d42a0c4e706c7f04cdcae7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "promo_code_usages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "promo_code_id" uuid NOT NULL, "user_id" uuid NOT NULL, "order_id" uuid, "used_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9c9ffeda460b6ae457cdb4232b5" UNIQUE ("promo_code_id", "user_id"), CONSTRAINT "PK_23c4867b2c9e4bbcf82d677c50b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "platform_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "default_commission_rate" numeric(5,2) NOT NULL DEFAULT '10', "platform_name" character varying NOT NULL DEFAULT 'Angren Taxi', "support_phone" character varying NOT NULL DEFAULT '+998 71 200 00 00', "support_email" character varying NOT NULL DEFAULT 'support@angrentaxi.uz', "delivery_fee" numeric(10,2) NOT NULL DEFAULT '7000', "maintenance_mode" boolean NOT NULL DEFAULT false, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2934aeb70ec285196dcab4a2e96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "otps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying NOT NULL, "code" character varying NOT NULL, "is_used" boolean NOT NULL DEFAULT false, "attempts" integer NOT NULL DEFAULT '0', "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_91fef5ed60605b854a2115d2410" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_otps_phone" ON "otps" ("phone") `);
        await queryRunner.query(`CREATE TABLE "notification_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "body" character varying(500) NOT NULL, "event" character varying(50) NOT NULL, "read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f803d5e1bd85942b24ee424870" ON "notification_logs" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "menu_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "restaurant_id" uuid NOT NULL, "name" character varying NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_124ae987900336f983881cb04e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."market_orders_status_enum" AS ENUM('new', 'packing', 'shipped', 'delivered', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."market_orders_delivery_mode_enum" AS ENUM('self', 'platform')`);
        await queryRunner.query(`CREATE TYPE "public"."market_orders_payment_method_enum" AS ENUM('cash', 'card')`);
        await queryRunner.query(`CREATE TABLE "market_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "status" "public"."market_orders_status_enum" NOT NULL DEFAULT 'new', "items" jsonb NOT NULL, "delivery_mode" "public"."market_orders_delivery_mode_enum" NOT NULL DEFAULT 'platform', "delivery_address" character varying NOT NULL, "delivery_lat" numeric(10,7) NOT NULL, "delivery_lng" numeric(10,7) NOT NULL, "delivery_order_id" uuid, "customer_phone" character varying, "payment_method" "public"."market_orders_payment_method_enum" NOT NULL DEFAULT 'cash', "total_price" numeric(12,2) NOT NULL, "note" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e1fe67e5c646e19e8c5257896ca" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_market_orders_customer_id_created_at" ON "market_orders" ("customer_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_market_orders_store_id_status" ON "market_orders" ("store_id", "status") `);
        await queryRunner.query(`CREATE INDEX "idx_market_orders_store_id_created_at" ON "market_orders" ("store_id", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."food_orders_status_enum" AS ENUM('new', 'preparing', 'ready', 'delivered', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."food_orders_payment_method_enum" AS ENUM('card', 'cash')`);
        await queryRunner.query(`CREATE TABLE "food_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "restaurant_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "status" "public"."food_orders_status_enum" NOT NULL DEFAULT 'new', "items" jsonb NOT NULL, "delivery_address" character varying NOT NULL, "delivery_lat" numeric(10,7) NOT NULL, "delivery_lng" numeric(10,7) NOT NULL, "delivery_order_id" uuid, "customer_phone" character varying, "payment_method" "public"."food_orders_payment_method_enum" NOT NULL DEFAULT 'cash', "total_price" numeric(12,2) NOT NULL, "note" character varying, "reject_reason" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b5765853128905c515770b51a04" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_food_orders_customer_id_created_at" ON "food_orders" ("customer_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_food_orders_restaurant_id_status" ON "food_orders" ("restaurant_id", "status") `);
        await queryRunner.query(`CREATE INDEX "idx_food_orders_restaurant_id_created_at" ON "food_orders" ("restaurant_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "favorite_addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "label" character varying(50) NOT NULL, "address" character varying(500) NOT NULL, "lat" numeric(10,7) NOT NULL, "lng" numeric(10,7) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c2cf3667a562b3f482dcfdead23" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_favorite_addresses_user_id" ON "favorite_addresses" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "drivers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "car_model" character varying, "car_number" character varying, "license_plate" character varying, "car_year" integer, "approved_tariff_tier" integer NOT NULL DEFAULT '1', "rating" numeric(3,2) NOT NULL DEFAULT '5', "is_online" boolean NOT NULL DEFAULT false, "balance" numeric(10,2) NOT NULL DEFAULT '0', "commission_rate" numeric(5,2), "current_location" geometry(Point,4326), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_8e224f1b8f05ace7cfc7c76d03" UNIQUE ("user_id"), CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_drivers_is_online_updated_at" ON "drivers" ("is_online", "updated_at") `);
        await queryRunner.query(`CREATE INDEX "idx_drivers_user_id" ON "drivers" ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."driver_documents_document_type_enum" AS ENUM('license_front', 'license_back', 'passport', 'vehicle_registration')`);
        await queryRunner.query(`CREATE TYPE "public"."driver_documents_review_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "driver_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "document_type" "public"."driver_documents_document_type_enum" NOT NULL, "file_url" character varying NOT NULL, "review_status" "public"."driver_documents_review_status_enum" NOT NULL DEFAULT 'pending', "rejection_reason" character varying(500), "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_31c28b4e8f55a5d411597d45ab2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_driver_documents_driver_id" ON "driver_documents" ("driver_id") `);
        await queryRunner.query(`CREATE TABLE "driver_bonus_awards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bonus_rule_id" uuid NOT NULL, "driver_id" character varying NOT NULL, "period_key" character varying NOT NULL, "transaction_id" uuid NOT NULL, "awarded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8ec6a5cd2eb037d3c365c8b1835" UNIQUE ("bonus_rule_id", "driver_id", "period_key"), CONSTRAINT "PK_c4eea7dcb35f8aa42d7626abf45" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dispatch_overrides" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "performed_by_user_id" uuid NOT NULL, "previous_driver_id" uuid, "new_driver_id" uuid NOT NULL, "reason" character varying(500) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_10af5a0eec6db6ab1c7c3a56d58" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dishes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "restaurant_id" uuid NOT NULL, "category_id" uuid, "name" character varying NOT NULL, "description" character varying, "price" numeric(12,2) NOT NULL, "prep_minutes" integer NOT NULL DEFAULT '10', "is_available" boolean NOT NULL DEFAULT true, "tags" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f4748c8e8382ad34ef517520b7b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_dishes_restaurant_id_is_available" ON "dishes" ("restaurant_id", "is_available") `);
        await queryRunner.query(`ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "FK_23c850a1ccc75383d9ce288736a" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_03558df2912bb5af97d697a56c3" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_222cd7bf166a2d7a6aad9cdebee" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_461fbe71d0a6906ecb99f9d4ed4" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_1e7814b20d15af2aa03320e0451" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trips" ADD CONSTRAINT "FK_8b3534829163c67172ad780549d" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_messages" ADD CONSTRAINT "FK_d887fcb1d4f4c653518b6f93d0e" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_messages" ADD CONSTRAINT "FK_9f68cf624dea9b8201894c97117" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "driver_bonus_rules" ADD CONSTRAINT "FK_ae782344cfe27724ac4c368736e" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_3cb0558ed36997f1d9ecc1118e7" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_cbcda5364525a8206f2f7706649" FOREIGN KEY ("bonus_rule_id") REFERENCES "driver_bonus_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "FK_153cd654cd5a0772924e5d08ef2" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "FK_13217019959c92eafc432e7f89a" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tariff_change_requests" ADD CONSTRAINT "FK_bc486b3f4266e0f9868180feb02" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "support_threads" ADD CONSTRAINT "FK_33c3d54fa7458b1ee3395f5c411" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "support_threads" ADD CONSTRAINT "FK_64a5c85a12298967a1205161edc" FOREIGN KEY ("assigned_manager_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "support_messages" ADD CONSTRAINT "FK_0275cf8d73cc01f87da8ffcf77f" FOREIGN KEY ("thread_id") REFERENCES "support_threads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "support_messages" ADD CONSTRAINT "FK_db9f9d46849e30b9ac570db6eb6" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stores" ADD CONSTRAINT "FK_ba95f3c2644552c72431cfb0c78" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "market_categories" ADD CONSTRAINT "FK_1019918052dce3a0711139d61bf" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_68863607048a1abd43772b314ef" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "market_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_5914e3685851db1a0be9733594f" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sos_alerts" ADD CONSTRAINT "FK_0634e7d11e4c179022a317d0717" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sos_alerts" ADD CONSTRAINT "FK_f94bbeee793bd2d169a5534d726" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD CONSTRAINT "FK_d429be1535b3d5f184061afb749" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_678aeb7d6df2fdcba5052b32ecb" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_753b8e7442994cffcdf77581f4e" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_0ab402c56fa2eb451efa04c76fc" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "push_notification_logs" ADD CONSTRAINT "FK_d2a33b3685c278832b67cdd10e1" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "promo_code_usages" ADD CONSTRAINT "FK_e44c9f212a0ac8c77868f6c0bac" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "promo_code_usages" ADD CONSTRAINT "FK_b2a9368ad108f5fd2296b9d3526" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "promo_code_usages" ADD CONSTRAINT "FK_92bc7045cfd51466c0f7826a0d4" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification_logs" ADD CONSTRAINT "FK_f803d5e1bd85942b24ee4248701" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "menu_categories" ADD CONSTRAINT "FK_a1650861201d802c0ad078fff8e" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "market_orders" ADD CONSTRAINT "FK_4a8a96296fbe9dd5f509610e945" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "market_orders" ADD CONSTRAINT "FK_ee02892f57579345c3c81500406" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "food_orders" ADD CONSTRAINT "FK_ad925a428f615269eda0861e683" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "food_orders" ADD CONSTRAINT "FK_2e7d122882ddd9d7510c964a2b2" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "drivers" ADD CONSTRAINT "FK_8e224f1b8f05ace7cfc7c76d03b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "driver_documents" ADD CONSTRAINT "FK_dc156b37dfa0fcda0ef1974bab8" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "driver_bonus_awards" ADD CONSTRAINT "FK_f9bcd486f5321382377de214c33" FOREIGN KEY ("bonus_rule_id") REFERENCES "driver_bonus_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "driver_bonus_awards" ADD CONSTRAINT "FK_f8bf8f089c327dade71534698c8" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dispatch_overrides" ADD CONSTRAINT "FK_9a457ffd98527da38b4dd5fa028" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dispatch_overrides" ADD CONSTRAINT "FK_58cf71185772413a0dad07cc6f0" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dishes" ADD CONSTRAINT "FK_70771174ec44463b0478c85915b" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dishes" ADD CONSTRAINT "FK_078dfd20b43f0efe2b4e5fc520c" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Intentionally destructive and only safe on a database this migration
        // actually built; guarded so a mistaken revert on a baselined server
        // does not drop live tables.
        if (process.env.ALLOW_BASELINE_REVERT !== 'true') {
            throw new Error(
                'Reverting the baseline drops every table. Set ALLOW_BASELINE_REVERT=true to confirm.',
            );
        }

        await queryRunner.query(`ALTER TABLE "dishes" DROP CONSTRAINT "FK_078dfd20b43f0efe2b4e5fc520c"`);
        await queryRunner.query(`ALTER TABLE "dishes" DROP CONSTRAINT "FK_70771174ec44463b0478c85915b"`);
        await queryRunner.query(`ALTER TABLE "dispatch_overrides" DROP CONSTRAINT "FK_58cf71185772413a0dad07cc6f0"`);
        await queryRunner.query(`ALTER TABLE "dispatch_overrides" DROP CONSTRAINT "FK_9a457ffd98527da38b4dd5fa028"`);
        await queryRunner.query(`ALTER TABLE "driver_bonus_awards" DROP CONSTRAINT "FK_f8bf8f089c327dade71534698c8"`);
        await queryRunner.query(`ALTER TABLE "driver_bonus_awards" DROP CONSTRAINT "FK_f9bcd486f5321382377de214c33"`);
        await queryRunner.query(`ALTER TABLE "driver_documents" DROP CONSTRAINT "FK_dc156b37dfa0fcda0ef1974bab8"`);
        await queryRunner.query(`ALTER TABLE "drivers" DROP CONSTRAINT "FK_8e224f1b8f05ace7cfc7c76d03b"`);
        await queryRunner.query(`ALTER TABLE "food_orders" DROP CONSTRAINT "FK_2e7d122882ddd9d7510c964a2b2"`);
        await queryRunner.query(`ALTER TABLE "food_orders" DROP CONSTRAINT "FK_ad925a428f615269eda0861e683"`);
        await queryRunner.query(`ALTER TABLE "market_orders" DROP CONSTRAINT "FK_ee02892f57579345c3c81500406"`);
        await queryRunner.query(`ALTER TABLE "market_orders" DROP CONSTRAINT "FK_4a8a96296fbe9dd5f509610e945"`);
        await queryRunner.query(`ALTER TABLE "menu_categories" DROP CONSTRAINT "FK_a1650861201d802c0ad078fff8e"`);
        await queryRunner.query(`ALTER TABLE "notification_logs" DROP CONSTRAINT "FK_f803d5e1bd85942b24ee4248701"`);
        await queryRunner.query(`ALTER TABLE "promo_code_usages" DROP CONSTRAINT "FK_92bc7045cfd51466c0f7826a0d4"`);
        await queryRunner.query(`ALTER TABLE "promo_code_usages" DROP CONSTRAINT "FK_b2a9368ad108f5fd2296b9d3526"`);
        await queryRunner.query(`ALTER TABLE "promo_code_usages" DROP CONSTRAINT "FK_e44c9f212a0ac8c77868f6c0bac"`);
        await queryRunner.query(`ALTER TABLE "push_notification_logs" DROP CONSTRAINT "FK_d2a33b3685c278832b67cdd10e1"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_0ab402c56fa2eb451efa04c76fc"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_753b8e7442994cffcdf77581f4e"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_678aeb7d6df2fdcba5052b32ecb"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP CONSTRAINT "FK_d429be1535b3d5f184061afb749"`);
        await queryRunner.query(`ALTER TABLE "sos_alerts" DROP CONSTRAINT "FK_f94bbeee793bd2d169a5534d726"`);
        await queryRunner.query(`ALTER TABLE "sos_alerts" DROP CONSTRAINT "FK_0634e7d11e4c179022a317d0717"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_5914e3685851db1a0be9733594f"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_9a5f6868c96e0069e699f33e124"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_68863607048a1abd43772b314ef"`);
        await queryRunner.query(`ALTER TABLE "market_categories" DROP CONSTRAINT "FK_1019918052dce3a0711139d61bf"`);
        await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "FK_ba95f3c2644552c72431cfb0c78"`);
        await queryRunner.query(`ALTER TABLE "support_messages" DROP CONSTRAINT "FK_db9f9d46849e30b9ac570db6eb6"`);
        await queryRunner.query(`ALTER TABLE "support_messages" DROP CONSTRAINT "FK_0275cf8d73cc01f87da8ffcf77f"`);
        await queryRunner.query(`ALTER TABLE "support_threads" DROP CONSTRAINT "FK_64a5c85a12298967a1205161edc"`);
        await queryRunner.query(`ALTER TABLE "support_threads" DROP CONSTRAINT "FK_33c3d54fa7458b1ee3395f5c411"`);
        await queryRunner.query(`ALTER TABLE "tariff_change_requests" DROP CONSTRAINT "FK_bc486b3f4266e0f9868180feb02"`);
        await queryRunner.query(`ALTER TABLE "tariff_change_requests" DROP CONSTRAINT "FK_13217019959c92eafc432e7f89a"`);
        await queryRunner.query(`ALTER TABLE "tariff_change_requests" DROP CONSTRAINT "FK_153cd654cd5a0772924e5d08ef2"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_cbcda5364525a8206f2f7706649"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_3cb0558ed36997f1d9ecc1118e7"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`);
        await queryRunner.query(`ALTER TABLE "driver_bonus_rules" DROP CONSTRAINT "FK_ae782344cfe27724ac4c368736e"`);
        await queryRunner.query(`ALTER TABLE "trip_messages" DROP CONSTRAINT "FK_9f68cf624dea9b8201894c97117"`);
        await queryRunner.query(`ALTER TABLE "trip_messages" DROP CONSTRAINT "FK_d887fcb1d4f4c653518b6f93d0e"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP CONSTRAINT "FK_8b3534829163c67172ad780549d"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_1e7814b20d15af2aa03320e0451"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_461fbe71d0a6906ecb99f9d4ed4"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_222cd7bf166a2d7a6aad9cdebee"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_03558df2912bb5af97d697a56c3"`);
        await queryRunner.query(`ALTER TABLE "withdrawal_requests" DROP CONSTRAINT "FK_23c850a1ccc75383d9ce288736a"`);
        await queryRunner.query(`DROP INDEX "public"."idx_dishes_restaurant_id_is_available"`);
        await queryRunner.query(`DROP TABLE "dishes"`);
        await queryRunner.query(`DROP TABLE "dispatch_overrides"`);
        await queryRunner.query(`DROP TABLE "driver_bonus_awards"`);
        await queryRunner.query(`DROP INDEX "public"."idx_driver_documents_driver_id"`);
        await queryRunner.query(`DROP TABLE "driver_documents"`);
        await queryRunner.query(`DROP TYPE "public"."driver_documents_review_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."driver_documents_document_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_drivers_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_drivers_is_online_updated_at"`);
        await queryRunner.query(`DROP TABLE "drivers"`);
        await queryRunner.query(`DROP INDEX "public"."idx_favorite_addresses_user_id"`);
        await queryRunner.query(`DROP TABLE "favorite_addresses"`);
        await queryRunner.query(`DROP INDEX "public"."idx_food_orders_restaurant_id_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_food_orders_restaurant_id_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_food_orders_customer_id_created_at"`);
        await queryRunner.query(`DROP TABLE "food_orders"`);
        await queryRunner.query(`DROP TYPE "public"."food_orders_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."food_orders_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_market_orders_store_id_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_market_orders_store_id_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_market_orders_customer_id_created_at"`);
        await queryRunner.query(`DROP TABLE "market_orders"`);
        await queryRunner.query(`DROP TYPE "public"."market_orders_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."market_orders_delivery_mode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."market_orders_status_enum"`);
        await queryRunner.query(`DROP TABLE "menu_categories"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f803d5e1bd85942b24ee424870"`);
        await queryRunner.query(`DROP TABLE "notification_logs"`);
        await queryRunner.query(`DROP INDEX "public"."idx_otps_phone"`);
        await queryRunner.query(`DROP TABLE "otps"`);
        await queryRunner.query(`DROP TABLE "platform_settings"`);
        await queryRunner.query(`DROP TABLE "promo_code_usages"`);
        await queryRunner.query(`DROP TABLE "push_notification_logs"`);
        await queryRunner.query(`DROP TYPE "public"."push_notification_logs_audience_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ratings_to_user_id"`);
        await queryRunner.query(`DROP TABLE "ratings"`);
        await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_token_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_user_id"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP TABLE "restaurants"`);
        await queryRunner.query(`DROP TYPE "public"."restaurants_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sos_alerts_status_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sos_alerts_status_resolved_at"`);
        await queryRunner.query(`DROP TABLE "sos_alerts"`);
        await queryRunner.query(`DROP TABLE "stock_movements"`);
        await queryRunner.query(`DROP INDEX "public"."idx_products_store_id_status"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TYPE "public"."products_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."products_unit_enum"`);
        await queryRunner.query(`DROP TABLE "market_categories"`);
        await queryRunner.query(`DROP TABLE "stores"`);
        await queryRunner.query(`DROP TYPE "public"."stores_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."stores_delivery_mode_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_support_messages_thread_id_created_at"`);
        await queryRunner.query(`DROP TABLE "support_messages"`);
        await queryRunner.query(`DROP INDEX "public"."idx_support_threads_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_support_threads_status_last_message_at"`);
        await queryRunner.query(`DROP TABLE "support_threads"`);
        await queryRunner.query(`DROP TABLE "tariff_change_requests"`);
        await queryRunner.query(`DROP TYPE "public"."tariff_change_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tariff_change_requests_action_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_transactions_user_id_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_transactions_order_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_transactions_external_id"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`DROP TABLE "driver_bonus_rules"`);
        await queryRunner.query(`DROP TYPE "public"."driver_bonus_rules_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."driver_bonus_rules_rule_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d887fcb1d4f4c653518b6f93d0"`);
        await queryRunner.query(`DROP TABLE "trip_messages"`);
        await queryRunner.query(`DROP INDEX "public"."idx_trips_order_id"`);
        await queryRunner.query(`DROP TABLE "trips"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_driver_id_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_passenger_id_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_status_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_created_at"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_service_type_enum"`);
        await queryRunner.query(`DROP TABLE "promo_codes"`);
        await queryRunner.query(`DROP TABLE "tariffs"`);
        await queryRunner.query(`DROP INDEX "public"."idx_withdrawal_requests_driver_id_requested_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_withdrawal_requests_status_requested_at"`);
        await queryRunner.query(`DROP TABLE "withdrawal_requests"`);
        await queryRunner.query(`DROP TYPE "public"."withdrawal_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."withdrawal_requests_owner_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_role_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_referred_by_user_id"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
