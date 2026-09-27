import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LostItemReport } from '../../database/entities/lost-item-report.entity';
import { Order } from '../../database/entities/order.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { LostItemsController } from './lost-items.controller';
import { LostItemsService } from './lost-items.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LostItemReport, Order]),
    forwardRef(() => RealtimeModule),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [LostItemsController],
  providers: [LostItemsService],
})
export class LostItemsModule {}
