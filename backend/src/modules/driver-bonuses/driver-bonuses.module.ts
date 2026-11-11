import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverBonusesController } from './driver-bonuses.controller';
import { DriverBonusesService } from './driver-bonuses.service';
import { DriverBonusRule } from '../../database/entities/driver-bonus-rule.entity';
import { DriverBonusAward } from '../../database/entities/driver-bonus-award.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { Order } from '../../database/entities/order.entity';
import { DriversModule } from '../drivers/drivers.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverBonusRule, DriverBonusAward, Transaction, Order]),
    DriversModule,
    // Bonus berilganda haydovchiga xabar berish uchun: socket (ilova ochiq
    // bo'lsa) va push (yopiq bo'lsa). UsersModule — push uchun FCM tokenni
    // olishga kerak. Aylanma bog'liqlik yo'q: bu uchtasining hech biri
    // DriverBonusesModule ni import qilmaydi.
    RealtimeModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [DriverBonusesController],
  providers: [DriverBonusesService],
  exports: [DriverBonusesService],
})
export class DriverBonusesModule {}
