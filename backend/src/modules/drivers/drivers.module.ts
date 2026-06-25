import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { Driver } from '../../database/entities/driver.entity';
import { redisProvider } from '../../config/redis.config';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Driver]), forwardRef(() => UsersModule)],
  controllers: [DriversController],
  providers: [DriversService, redisProvider],
  exports: [DriversService],
})
export class DriversModule {}
