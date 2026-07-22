import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EskizService } from './eskiz.service';
import { FirebaseService } from './firebase.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { UsersModule } from '../users/users.module';
import { NotificationLog } from '../../database/entities/notification-log.entity';
import { User } from '../../database/entities/user.entity';
import { PushNotificationLog } from '../../database/entities/push-notification-log.entity';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([NotificationLog, User, PushNotificationLog])],
  controllers: [NotificationsController],
  providers: [EskizService, FirebaseService, NotificationsService],
  exports: [EskizService, FirebaseService, NotificationsService],
})
export class NotificationsModule {}
