import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SosAlert } from '../../database/entities/sos-alert.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([SosAlert]), RealtimeModule, OrdersModule],
  controllers: [SafetyController],
  providers: [SafetyService],
  exports: [SafetyService],
})
export class SafetyModule {}
