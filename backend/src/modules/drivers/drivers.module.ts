import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { Driver } from '../../database/entities/driver.entity';
import { redisProvider } from '../../config/redis.config';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver]),
    forwardRef(() => UsersModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [DriversController],
  providers: [DriversService, redisProvider],
  exports: [DriversService],
})
export class DriversModule {}
