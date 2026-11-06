import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { WithdrawalRequest } from '../../database/entities/withdrawal-request.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';
import { LegalPagesController } from './legal-pages.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, FoodOrder, MarketOrder, WithdrawalRequest, Transaction, RefreshToken]),
    UsersModule,
    SettingsModule,
  ],
  controllers: [AccountDeletionController, LegalPagesController],
  providers: [AccountDeletionService],
})
export class AccountDeletionModule {}
