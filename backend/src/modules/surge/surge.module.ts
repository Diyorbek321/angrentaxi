import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurgeService } from './surge.service';
import { SurgeController } from './surge.controller';
import { Order } from '../../database/entities/order.entity';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), DriversModule],
  controllers: [SurgeController],
  providers: [SurgeService],
  exports: [SurgeService],
})
export class SurgeModule {}
