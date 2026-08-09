import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodService } from './food.service';
import { FoodVendorController } from './food-vendor.controller';
import { FoodStorefrontController } from './food-storefront.controller';
import { FoodAdminController } from './food-admin.controller';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { MenuCategory } from '../../database/entities/menu-category.entity';
import { Dish } from '../../database/entities/dish.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { MatchingModule } from '../matching/matching.module';
import { TariffsModule } from '../tariffs/tariffs.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, MenuCategory, Dish, FoodOrder, Transaction]),
    forwardRef(() => RealtimeModule),
    UsersModule,
    forwardRef(() => OrdersModule),
    MatchingModule,
    TariffsModule,
    SettingsModule,
  ],
  controllers: [FoodVendorController, FoodStorefrontController, FoodAdminController],
  providers: [FoodService],
  exports: [FoodService],
})
export class FoodModule {}
