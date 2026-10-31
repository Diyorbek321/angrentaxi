import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiscalReceipt } from '../../database/entities/fiscal-receipt.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';
import { FISCAL_PROVIDER, createFiscalProvider } from './fiscal-provider';
import { FiscalReceiptsService } from './fiscal-receipts.service';
import { FiscalReceiptsController } from './fiscal-receipts.controller';
import { SettingsModule } from '../settings/settings.module';

/**
 * Fiskal cheklar. Eng quyi qatlamda: faqat entity'larga va global
 * `DeliveryEventsModule` ga tayanadi — `OrdersModule` uni import qiladi,
 * teskarisi yo'q, aylanma bog'liqlik yo'q.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FiscalReceipt, FoodOrder, MarketOrder, Restaurant, Store]),
    // Platforma STIR'i (§15). SettingsModule faqat TypeORM'ga tayanadi.
    SettingsModule,
  ],
  controllers: [FiscalReceiptsController],
  providers: [
    {
      provide: FISCAL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createFiscalProvider(config.get<string>('FISCAL_PROVIDER'), new Logger('FiscalProvider')),
    },
    FiscalReceiptsService,
  ],
  exports: [FiscalReceiptsService],
})
export class FiscalModule {}
