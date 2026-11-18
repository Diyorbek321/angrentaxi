import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurgeService } from './surge.service';
import { SurgeController } from './surge.controller';
import { TaxiSupplyService } from './taxi-supply.service';
import { Order } from '../../database/entities/order.entity';
import { Driver } from '../../database/entities/driver.entity';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  // DriversModule — umumiy REDIS_CLIENT ulanishi (u yerdan qayta eksport).
  imports: [TypeOrmModule.forFeature([Order, Driver]), DriversModule],
  controllers: [SurgeController],
  providers: [SurgeService, TaxiSupplyService],
  exports: [SurgeService],
})
export class SurgeModule {}
