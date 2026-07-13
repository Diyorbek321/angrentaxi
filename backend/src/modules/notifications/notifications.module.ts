import { Module } from '@nestjs/common';
import { EskizService } from './eskiz.service';
import { FirebaseService } from './firebase.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [NotificationsController],
  providers: [EskizService, FirebaseService, NotificationsService],
  exports: [EskizService, FirebaseService, NotificationsService],
})
export class NotificationsModule {}
