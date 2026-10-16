import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../../database/entities/driver.entity';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { IntercityTrip } from '../../database/entities/intercity-trip.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { DriversModule } from '../drivers/drivers.module';
import { SettingsModule } from '../settings/settings.module';
import { IntercityController, IntercityManageController } from './intercity.controller';
import { IntercityDriverGate } from './intercity-driver-gate';
import { IntercityPointsService } from './intercity-points.service';
import { IntercityRoutesService } from './intercity-routes.service';
import { IntercityTripsController } from './intercity-trips.controller';
import { IntercityTripsService } from './intercity-trips.service';

/**
 * Shaharlararo qatnov. 1-qadam: nuqtalar, yo'nalishlar, qat'iy narxlar.
 * 2–3-qadam: haydovchi e'lon qiladigan qatnovlar va yo'lovchi qidiruvi.
 * Band qilish (o'rindiq hisobi) keyingi qadamda shu modulga qo'shiladi.
 *
 * `DriversModule` — haydovchi darvozasi (tekshiruv, VMQ 200). Aylanma
 * bog'liqlik yo'q: drivers bu modulni import qilmaydi.
 * `AuditModule` global — import shart emas.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([IntercityPoint, IntercityRoute, IntercityTrip, Driver, Tariff, Transaction]),
    SettingsModule,
    DriversModule,
  ],
  controllers: [IntercityController, IntercityManageController, IntercityTripsController],
  providers: [IntercityPointsService, IntercityRoutesService, IntercityTripsService, IntercityDriverGate],
  exports: [IntercityPointsService, IntercityRoutesService, IntercityTripsService],
})
export class IntercityModule {}
