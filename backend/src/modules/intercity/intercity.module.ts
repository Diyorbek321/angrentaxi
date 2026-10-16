import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../../database/entities/driver.entity';
import { Order } from '../../database/entities/order.entity';
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
import { IntercityBookingsController } from './intercity-bookings.controller';
import { IntercityBookingsService } from './intercity-bookings.service';
import { IntercityLifecycleService } from './intercity-lifecycle.service';
import { IntercityTripsCron } from './intercity-trips.cron';

/**
 * Shaharlararo qatnov. 1-qadam: nuqtalar, yo'nalishlar, qat'iy narxlar.
 * 2–3-qadam: haydovchi e'lon qiladigan qatnovlar va yo'lovchi qidiruvi.
 * 4–5-qadam: band qilish/bekor qilish (atomik o'rindiq hisobi —
 * `intercity-seat-ledger.ts`), yig'ish → jo'nash, avtomatik yopish cron'i.
 * Har bir band — `orders` qatori; yakunlash `OrdersCompletionService` da
 * (u bu modulni import QILMAYDI — faqat sof `intercity-seat-ledger` funksiyasini).
 *
 * `DriversModule` — haydovchi darvozasi (tekshiruv, VMQ 200). Aylanma
 * bog'liqlik yo'q: drivers bu modulni import qilmaydi.
 * `AuditModule` global — import shart emas.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([IntercityPoint, IntercityRoute, IntercityTrip, Driver, Tariff, Transaction, Order]),
    SettingsModule,
    DriversModule,
  ],
  controllers: [IntercityController, IntercityManageController, IntercityTripsController, IntercityBookingsController],
  providers: [
    IntercityPointsService,
    IntercityRoutesService,
    IntercityTripsService,
    IntercityDriverGate,
    IntercityBookingsService,
    IntercityLifecycleService,
    IntercityTripsCron,
  ],
  exports: [IntercityPointsService, IntercityRoutesService, IntercityTripsService],
})
export class IntercityModule {}
