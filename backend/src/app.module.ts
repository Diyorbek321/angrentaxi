import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';
import { validateEnv } from './config/env.validation';

class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  columnName(propertyName: string, customName: string): string {
    return customName || propertyName.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
  relationName(propertyName: string): string {
    return propertyName.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
  joinColumnName(relationName: string, referencedColumnName: string): string {
    return `${relationName.replace(/([A-Z])/g, '_$1').toLowerCase()}_${referencedColumnName}`;
  }
}

// Entities
import { User } from './database/entities/user.entity';
import { Driver } from './database/entities/driver.entity';
import { Tariff } from './database/entities/tariff.entity';
import { Order } from './database/entities/order.entity';
import { Trip } from './database/entities/trip.entity';
import { Transaction } from './database/entities/transaction.entity';
import { Otp } from './database/entities/otp.entity';
import { Rating } from './database/entities/rating.entity';
import { PromoCode } from './database/entities/promo_code.entity';
import { PromoCodeUsage } from './database/entities/promo_code_usage.entity';
import { TariffChangeRequest } from './database/entities/tariff-change-request.entity';
import { DriverBonusRule } from './database/entities/driver-bonus-rule.entity';
import { DriverBonusAward } from './database/entities/driver-bonus-award.entity';
import { SupportThread } from './database/entities/support-thread.entity';
import { SupportMessage } from './database/entities/support-message.entity';
import { PlatformSettings } from './database/entities/platform-settings.entity';
import { Store } from './database/entities/store.entity';
import { MarketCategory } from './database/entities/market-category.entity';
import { Product } from './database/entities/product.entity';
import { StockMovement } from './database/entities/stock-movement.entity';
import { MarketOrder } from './database/entities/market-order.entity';
import { Restaurant } from './database/entities/restaurant.entity';
import { MenuCategory } from './database/entities/menu-category.entity';
import { Dish } from './database/entities/dish.entity';
import { FoodOrder } from './database/entities/food-order.entity';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TariffsModule } from './modules/tariffs/tariffs.module';
import { OrdersModule } from './modules/orders/orders.module';
import { MatchingModule } from './modules/matching/matching.module';
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
        entities: [
          User,
          Driver,
          Tariff,
          Order,
          Trip,
          Transaction,
          Otp,
          Rating,
          PromoCode,
          PromoCodeUsage,
          TariffChangeRequest,
          DriverBonusRule,
          DriverBonusAward,
          SupportThread,
          SupportMessage,
          PlatformSettings,
          Store,
          MarketCategory,
          Product,
          StockMovement,
          MarketOrder,
          Restaurant,
          MenuCategory,
          Dish,
          FoodOrder,
        ],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        // Schema is built from entities via synchronize (default on) for the test/MVP server,
        // since the hand-written migration drifted from the entities. Set DB_SYNC=false to
        // switch back to migrations for production.
        synchronize: configService.get<string>('DB_SYNC') !== 'false',
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
    }),

    // Rate Limiting
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
    AuthModule,
    UsersModule,
    DriversModule,
    TariffsModule,
    OrdersModule,
    MatchingModule,
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
  ],
})
export class AppModule {}
