import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';
import { UzcardProvider } from './uzcard.provider';
import { Transaction } from '../../database/entities/transaction.entity';
import { Order } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import { WithdrawalRequest } from '../../database/entities/withdrawal-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Order, User, WithdrawalRequest])],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymeProvider, ClickProvider, UzcardProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
