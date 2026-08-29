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
    ]),
    // settleOrderPayout credits drivers.balance when a card payment lands.
    DriversModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymeProvider,
    ClickProvider,
    UzcardProvider,
    // Pul CHIQARISH yo'li. Payme/Click payout kalitlari kelganda faqat shu
    // bog'lanish o'zgaradi — `PaymentsService` ga tegilmaydi
    // (`payout.interface.ts` dagi izohga qarang).
    { provide: PAYOUT_PROVIDER, useClass: ManualPayoutProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
