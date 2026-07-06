import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverBonusesController } from './driver-bonuses.controller';
import { DriverBonusesService } from './driver-bonuses.service';
import { DriverBonusRule } from '../../database/entities/driver-bonus-rule.entity';
import { DriverBonusAward } from '../../database/entities/driver-bonus-award.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { Order } from '../../database/entities/order.entity';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverBonusRule, DriverBonusAward, Transaction, Order]),
    DriversModule,
  ],
  controllers: [DriverBonusesController],
  providers: [DriverBonusesService],
  exports: [DriverBonusesService],
})
export class DriverBonusesModule {}
