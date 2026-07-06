import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { TariffsModule } from '../tariffs/tariffs.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { DriversModule } from '../drivers/drivers.module';
import { MatchingModule } from '../matching/matching.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { DriverBonusesModule } from '../driver-bonuses/driver-bonuses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Trip, Transaction]),
    TariffsModule,
    RealtimeModule,
    NotificationsModule,
    UsersModule,
    DriversModule,
    MatchingModule,
    PromoCodesModule,
    DriverBonusesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
