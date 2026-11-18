import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SosAlert } from '../../database/entities/sos-alert.entity';
import { Order } from '../../database/entities/order.entity';
import { TripShareLink } from '../../database/entities/trip-share-link.entity';
import { OrderCallLog } from '../../database/entities/order-call-log.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersModule } from '../orders/orders.module';
import { DriversModule } from '../drivers/drivers.module';
import { SettingsModule } from '../settings/settings.module';
import { TripShareService } from './trip-share.service';
import { TripShareController } from './trip-share.controller';
import { OrderCallsService } from './order-calls.service';
import { OrderEvidenceService } from './order-evidence.service';
import { EvidenceRetentionService } from './evidence-retention.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SosAlert, Order, TripShareLink, OrderCallLog]),
    RealtimeModule,
    OrdersModule,
    DriversModule,
    SettingsModule,
  ],
  controllers: [SafetyController, TripShareController],
  providers: [SafetyService, TripShareService, OrderCallsService, OrderEvidenceService, EvidenceRetentionService],
  exports: [SafetyService, EvidenceRetentionService],
})
export class SafetyModule {}
