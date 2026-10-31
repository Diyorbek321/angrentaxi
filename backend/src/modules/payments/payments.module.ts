import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PAYOUT_PROVIDER } from './payout.interface';
import { ManualPayoutProvider } from './manual-payout.provider';
import { PaymentsService } from './payments.service';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';
import { Transaction } from '../../database/entities/transaction.entity';
import { Order } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import { WithdrawalRequest } from '../../database/entities/withdrawal-request.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { DriversModule } from '../drivers/drivers.module';
import { SettingsModule } from '../settings/settings.module';
import { WalletTopup } from '../../database/entities/wallet-topup.entity';
import { WalletTopupsService } from './wallet-topups.service';
import { WalletTopupCallbacksService } from './wallet-topup-callbacks.service';
import { MerchantTransaction } from '../../database/entities/merchant-transaction.entity';
import { PaymentTargetsService } from './merchant/payment-targets.service';
import { PaymeMerchantService } from './merchant/payme-merchant.service';
import { ClickShopService } from './merchant/click-shop.service';
import { FiscalModule } from '../fiscal/fiscal.module';
import { OrderRefundClawbackService } from './order-refund-clawback.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Order,
      User,
      WithdrawalRequest,
      // Card checkout must work for the super-app verticals too, not just
      // taxi rides.
      MarketOrder,
      FoodOrder,
      WalletTopup,
      MerchantTransaction,
    ]),
    // settleOrderPayout credits drivers.balance when a card payment lands.
    DriversModule,
    // Hamyonni to'ldirish sozlamalari (yoqilgan, min/max).
    SettingsModule,
    // Karta to'lovi qaytarilganda fiskal qaytarish cheki (§23).
    FiscalModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymeProvider,
    ClickProvider,
    UzcardProvider,
    WalletTopupsService,
    WalletTopupCallbacksService,
    // Payme Merchant API / Click SHOP API — buyurtma va to'ldirish uchun umumiy.
    PaymentTargetsService,
    PaymeMerchantService,
    ClickShopService,
    // To'langan buyurtma qaytarilganda ulushni qaytarib olish (§23).
    OrderRefundClawbackService,
    // Pul CHIQARISH yo'li. Payme/Click payout kalitlari kelganda faqat shu
    // bog'lanish o'zgaradi — `PaymentsService` ga tegilmaydi
    // (`payout.interface.ts` dagi izohga qarang).
    { provide: PAYOUT_PROVIDER, useClass: ManualPayoutProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
