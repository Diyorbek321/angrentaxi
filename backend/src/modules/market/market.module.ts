import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketService } from './market.service';
import { MarketVendorController } from './market-vendor.controller';
import { MarketStorefrontController } from './market-storefront.controller';
import { MarketAdminController } from './market-admin.controller';
import { Store } from '../../database/entities/store.entity';
import { MarketCategory } from '../../database/entities/market-category.entity';
import { Product } from '../../database/entities/product.entity';
import { StockMovement } from '../../database/entities/stock-movement.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { MatchingModule } from '../matching/matching.module';
import { TariffsModule } from '../tariffs/tariffs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, MarketCategory, Product, StockMovement, MarketOrder]),
    forwardRef(() => RealtimeModule),
    UsersModule,
    forwardRef(() => OrdersModule),
    MatchingModule,
    TariffsModule,
  ],
  controllers: [MarketVendorController, MarketStorefrontController, MarketAdminController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
