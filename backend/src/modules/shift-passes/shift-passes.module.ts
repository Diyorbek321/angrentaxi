import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverShiftPass } from '../../database/entities/driver-shift-pass.entity';
import { DriversModule } from '../drivers/drivers.module';
import { SettingsModule } from '../settings/settings.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { ShiftPassesService } from './shift-passes.service';
import { AdminShiftPassesController, DriverShiftPassController } from './shift-passes.controller';

/**
 * Haydovchi smenasi. `OrdersModule` uni import qiladi (komissiya siyosati
 * `hasActivePassFor` ni so'raydi); bu modul orders'ni import qilmaydi —
 * aylanma bog'liqlik yo'q.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DriverShiftPass]), DriversModule, SettingsModule, FiscalModule],
  controllers: [DriverShiftPassController, AdminShiftPassesController],
  providers: [ShiftPassesService],
  exports: [ShiftPassesService],
})
export class ShiftPassesModule {}
