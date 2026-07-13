import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripChatController } from './trip-chat.controller';
import { TripChatService } from './trip-chat.service';
import { TripMessage } from '../../database/entities/trip-message.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([TripMessage]), RealtimeModule, OrdersModule],
  controllers: [TripChatController],
  providers: [TripChatService],
  exports: [TripChatService],
})
export class TripChatModule {}
