import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { DriverDocumentsController } from './driver-documents.controller';
import { DriverDocumentsService } from './driver-documents.service';
import { Driver } from '../../database/entities/driver.entity';
import { DriverDocument } from '../../database/entities/driver-document.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { redisProvider, REDIS_CLIENT } from '../../config/redis.config';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, DriverDocument, Transaction]),
    forwardRef(() => UsersModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [DriversController, DriverDocumentsController],
  providers: [DriversService, DriverDocumentsService, redisProvider],
  // REDIS_CLIENT is re-exported so other feature modules (e.g. MatchingModule)
  // can share this one ioredis connection instead of opening their own.
  exports: [DriversService, DriverDocumentsService, REDIS_CLIENT],
})
export class DriversModule {}
