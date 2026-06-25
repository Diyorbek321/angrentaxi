import { Module } from '@nestjs/common';
import { EskizService } from './eskiz.service';
import { FirebaseService } from './firebase.service';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [EskizService, FirebaseService, NotificationsService],
  exports: [EskizService, FirebaseService, NotificationsService],
})
export class NotificationsModule {}
