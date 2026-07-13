import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { DriverDocumentsController } from './driver-documents.controller';
import { DriverDocumentsService } from './driver-documents.service';
import { Driver } from '../../database/entities/driver.entity';
import { DriverDocument } from '../../database/entities/driver-document.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { redisProvider } from '../../config/redis.config';
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
  exports: [DriversService, DriverDocumentsService],
})
export class DriversModule {}
