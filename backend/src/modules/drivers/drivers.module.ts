import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { DriverDocumentsController } from './driver-documents.controller';
import { DriverDocumentsService } from './driver-documents.service';
import { DriverServicesController } from './driver-services.controller';
import { DriverServicesService } from './driver-services.service';
import { DriverVerificationController } from './driver-verification.controller';
import { DriverVerificationService } from './driver-verification.service';
import { DriverVerificationRemindersService } from './driver-verification-reminders.service';
import { RoadSpeedController } from './road-speed.controller';
import { RoadSpeedService } from './road-speed.service';
import { Driver } from '../../database/entities/driver.entity';
import { DriverDocument } from '../../database/entities/driver-document.entity';
import { DriverVerificationRequirement } from '../../database/entities/driver-verification-requirement.entity';
import { DriverVerificationSubmission } from '../../database/entities/driver-verification-submission.entity';
import { Order } from '../../database/entities/order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RoadSpeedSample } from '../../database/entities/road-speed-sample.entity';
import { redisProvider, REDIS_CLIENT } from '../../config/redis.config';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Driver,
      DriverDocument,
      DriverVerificationRequirement,
      DriverVerificationSubmission,
      // Faqat O'QISH uchun: xizmat turini o'chirishdan oldin haydovchining
      // yarim yo'ldagi buyurtmasi bor-yo'qligi tekshiriladi. `OrdersModule`
      // ni olib kelish aylanma bog'liqlik yasagan bo'lardi (u matching
      // orqali allaqachon shu modulga tayanadi).
      Order,
      Transaction,
      RoadSpeedSample,
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => RealtimeModule),
    // Tekshiruv eslatmalari (cron) uchun push kanali. Aylanma bog'liqlik
    // yo'q: NotificationsModule faqat UsersModule ni oladi.
    NotificationsModule,
  ],
  // RoadSpeed* shu modulda turadi (alohida modul emas): u DriversService
  // yozadigan REDIS_CLIENT ning AYNI o'zidan foydalanadi. Alohida modulda
  // bo'lganida yo ikkinchi Redis ulanishi ochilardi, yo DriversModule bilan
  // aylanma bog'liqlik paydo bo'lardi.
  //
  // DriverVerificationController ATAYLAB DriversController dan OLDIN: ikkalasi
  // ham `drivers` prefiksida, va aniq yo'llar parametrli yo'llardan oldin
  // ro'yxatdan o'tishi marshrutlashni bir ma'noli qiladi.
  controllers: [
    DriverVerificationController,
    DriverServicesController,
    DriversController,
    DriverDocumentsController,
    RoadSpeedController,
  ],
  providers: [
    DriversService,
    DriverDocumentsService,
    DriverVerificationService,
    DriverServicesService,
    DriverVerificationRemindersService,
    RoadSpeedService,
    redisProvider,
  ],
  // REDIS_CLIENT is re-exported so other feature modules (e.g. MatchingModule)
  // can share this one ioredis connection instead of opening their own.
  exports: [
    DriversService,
    DriverDocumentsService,
    DriverVerificationService,
    DriverServicesService,
    RoadSpeedService,
    REDIS_CLIENT,
  ],
})
export class DriversModule {}
