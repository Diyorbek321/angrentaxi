import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { validateEnv } from './config/env.validation';
import { resolveDbSynchronize } from './config/db-synchronize.util';
import { bootDataSource, schemaBootOptions } from './config/schema-boot';
import { SnakeNamingStrategy } from './config/snake-naming.strategy';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard';
import { MaintenanceGuard } from './common/guards/maintenance.guard';

// Entities

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TariffsModule } from './modules/tariffs/tariffs.module';
import { OrdersModule } from './modules/orders/orders.module';
import { MatchingModule } from './modules/matching/matching.module';
import { SurgeModule } from './modules/surge/surge.module';
import { StorageModule } from './modules/storage/storage.module';
import { DeliveryEventsModule } from './modules/delivery/delivery-events.service';
import { LostItemsModule } from './modules/lost-items/lost-items.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { PromoCodesModule } from './modules/promo-codes/promo-codes.module';
import { TariffChangeRequestsModule } from './modules/tariff-change-requests/tariff-change-requests.module';
import { DriverBonusesModule } from './modules/driver-bonuses/driver-bonuses.module';
import { SupportModule } from './modules/support/support.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MarketModule } from './modules/market/market.module';
import { FoodModule } from './modules/food/food.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { TripChatModule } from './modules/trip-chat/trip-chat.module';
import { SafetyModule } from './modules/safety/safety.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { AdsModule } from './modules/ads/ads.module';
import { ENTITIES } from './database/entities';

@Module({
  imports: [
    // Config Module (global)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASS', 'postgres'),
        database: configService.get<string>('DB_NAME', 'angren_taxi'),
        // Single list, checked against every @Entity by entities.spec.ts.
        entities: ENTITIES,
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        // Pending migrations always run on boot. The 000_baseline migration is
        // generated from the entities and no-ops on a database that already
        // has the schema, so this is safe both for a fresh deploy and for the
        // existing server whose tables were built by synchronize.
        // The actual ordering (synchronize first, then migrations) is done by
        // `dataSourceFactory` below — see config/schema-boot.ts.
        migrationsRun: true,
        // synchronize stays as a development convenience only. In production it
        // defaults OFF (it can silently alter or drop columns on deploy) —
        // migrations are the supported path there.
        synchronize: resolveDbSynchronize(
          configService.get<string>('NODE_ENV'),
          configService.get<string>('DB_SYNC'),
        ),
        // One-time clean slate: set DB_DROP_SCHEMA=true to drop all tables then rebuild from
        // entities, then REMOVE it so restarts don't wipe data.
        dropSchema: configService.get<string>('DB_DROP_SCHEMA') === 'true',
        namingStrategy: new SnakeNamingStrategy(),
        logging: configService.get<string>('NODE_ENV') === 'development',
        // SSL only when explicitly enabled (DB_SSL=true). Railway internal Postgres uses
        // private networking without SSL, so default off avoids "server does not support SSL".
        ssl:
          configService.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
      inject: [ConfigService],
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('TypeORM options missing');
        return bootDataSource(new DataSource(schemaBootOptions(options)), options.synchronize === true);
      },
    }),

    // Cron/interval scheduling. Registered at the root so every module's
    // @Cron/@Interval handlers are discovered regardless of import order —
    // notably AuthModule's refresh-token pruning. ScheduleModule.forRoot() is
    // idempotent (Nest dedupes identical dynamic modules), so MatchingModule's
    // own call remains harmless.
    ScheduleModule.forRoot(),

    // MaintenanceGuard verifies the bearer token itself to identify staff,
    // because as a global guard it runs before the controller-level
    // JwtAuthGuard that would otherwise populate request.user.
    JwtModule.register({}),

    // Rate Limiting. Three named windows apply to every HTTP route (see the
    // APP_GUARD registration below, without which none of this is enforced);
    // individual routes tighten a specific window with @Throttle({ <name>: ... }).
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),

    // Feature Modules
    //
    // FavoritesModule must come before UsersModule: Nest registers routes in
    // module-import order, and FavoritesController's literal path
    // 'users/favorite-addresses' needs to be matched before UsersController's
    // 'users/:id' wildcard would otherwise swallow it (treating
    // "favorite-addresses" as the :id param and wrongly enforcing that
    // route's @Roles(MANAGER, ADMIN) guard on every passenger).
    AuthModule,
    FavoritesModule,
    UsersModule,
    DriversModule,
    TariffsModule,
    OrdersModule,
    MatchingModule,
    // Listed here even though OrdersModule already imports it: the surge map is
    // an endpoint of its own now, and it should not go missing the day orders
    // stop needing surge pricing.
    SurgeModule,
    StorageModule,
    DeliveryEventsModule,
    LostItemsModule,
    RealtimeModule,
    PaymentsModule,
    NotificationsModule,
    RatingsModule,
    PromoCodesModule,
    TariffChangeRequestsModule,
    DriverBonusesModule,
    SupportModule,
    SettingsModule,
    MarketModule,
    FoodModule,
    TripChatModule,
    SafetyModule,
    ReferralsModule,
    AdsModule,
  ],
  providers: [
    // ThrottlerModule only configures the limits — nothing enforces them until
    // the guard is bound. Binding it here (rather than per-controller) makes the
    // limits the default for every HTTP route.
    {
      provide: APP_GUARD,
      useClass: HttpThrottlerGuard,
    },
    // Makes the Global Settings maintenance switch actually stop traffic.
    // Registered after the throttler so an admin flipping it off is never
    // blocked by the switch itself (see MaintenanceGuard's allow-list).
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
  ],
})
export class AppModule {}
