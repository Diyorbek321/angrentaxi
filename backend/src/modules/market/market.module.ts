import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketService } from './market.service';
import { MarketImagesService } from './market-images.service';
import { MarketVendorController } from './market-vendor.controller';
import { MarketStorefrontController } from './market-storefront.controller';
import { MarketAdminController } from './market-admin.controller';
import { Store } from '../../database/entities/store.entity';
import { MarketCategory } from '../../database/entities/market-category.entity';
import { Product } from '../../database/entities/product.entity';
import { StockMovement } from '../../database/entities/stock-movement.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { MatchingModule } from '../matching/matching.module';
import { TariffsModule } from '../tariffs/tariffs.module';
import { SettingsModule } from '../settings/settings.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketPromotionsController } from './market-promotions.controller';
import { VendorTinModule } from '../vendor-tin/vendor-tin.module';
import { FiscalModule } from '../fiscal/fiscal.module';

@Module({
  imports: [
    // Sotuvchi o'zi yetkazgan buyurtma cheki (settleDelivered).
    FiscalModule,
    // Admin: sotuvchi STIR'i (audit bilan).
    VendorTinModule,
    TypeOrmModule.forFeature([Store, MarketCategory, Product, StockMovement, MarketOrder, Transaction]),
    forwardRef(() => RealtimeModule),
    UsersModule,
    forwardRef(() => OrdersModule),
    MatchingModule,
    TariffsModule,
    SettingsModule,
    PromotionsModule,
    PromoCodesModule,
    NotificationsModule,
  ],
  controllers: [MarketVendorController, MarketPromotionsController, MarketStorefrontController, MarketAdminController],
  providers: [MarketService, MarketImagesService],
  exports: [MarketService],
})
export class MarketModule {}
