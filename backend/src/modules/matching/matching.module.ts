import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchingService } from './matching.service';
import { Order } from '../../database/entities/order.entity';
import { DriversModule } from '../drivers/drivers.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ScheduleModule.forRoot(),
    DriversModule, // also re-exports REDIS_CLIENT, reused by MatchingService
    RealtimeModule,
    NotificationsModule,
    UsersModule,
  ],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
