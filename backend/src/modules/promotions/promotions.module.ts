import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from '../../database/entities/promotion.entity';
import { Dish } from '../../database/entities/dish.entity';
import { MenuCategory } from '../../database/entities/menu-category.entity';
import { Product } from '../../database/entities/product.entity';
import { MarketCategory } from '../../database/entities/market-category.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Promotion, Dish, MenuCategory, Product, MarketCategory, Restaurant, Store]),
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
