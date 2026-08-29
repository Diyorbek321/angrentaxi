import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ORDERS_PROVIDERS } from './orders.providers';
import { ScheduledOrdersService } from './scheduled-orders.service';
import { Order } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { TariffsModule } from '../tariffs/tariffs.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { DriversModule } from '../drivers/drivers.module';
import { MatchingModule } from '../matching/matching.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { DriverBonusesModule } from '../driver-bonuses/driver-bonuses.module';
import { SurgeModule } from '../surge/surge.module';
import { CitiesModule } from '../cities/cities.module';
import { RoutingModule } from '../routing/routing.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Trip, Transaction, DispatchOverride]),
    TariffsModule,
    RealtimeModule,
    NotificationsModule,
    UsersModule,
    DriversModule,
    MatchingModule,
    PromoCodesModule,
    DriverBonusesModule,
    SettingsModule,
    SurgeModule,
    RoutingModule,
    // `OrdersCreationService` olib ketish nuqtasini shaharga bog'laydi
    // (`resolveCityIdForPickup`). Modul eng quyi qatlamda — hech qanday
    // feature modulini olmaydi — shuning uchun aylanma bog'liqlik yo'q.
    CitiesModule,
  ],
  controllers: [OrdersController],
  // ⚠️ `ScheduledOrdersService` ATAYLAB `ORDERS_PROVIDERS` dan TASHQARIDA.
  // U massiv 13 ta spec faylida ham ishlatiladi va faqat shu servis
  // `MatchingService` ga bog'liq — uni umumiy ro'yxatga qo'shish har bir
  // spec faylga tegishsiz mock qo'shishni talab qilardi. Fasad
  // (`OrdersService`) unga bog'lanmaydi: o'qish `OrdersQueryService` da,
  // bekor qilish esa mavjud `cancelOrder` orqali ishlaydi.
  providers: [...ORDERS_PROVIDERS, ScheduledOrdersService],
  // Only the facade is exported — other modules must keep depending on
  // OrdersService, not on the internal collaborator services.
  exports: [OrdersService],
})
export class OrdersModule {}
