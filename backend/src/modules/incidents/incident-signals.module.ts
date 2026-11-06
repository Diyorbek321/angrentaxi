import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from '../../database/entities/incident.entity';
import { SettingsModule } from '../settings/settings.module';
import { IncidentSignalsService } from './incident-signals.service';

/**
 * Reyting signallari — alohida kichik modul: `RatingsModule` uni import
 * qiladi, butun incidents modulini (haydovchi, hamyon, push) emas.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Incident]), SettingsModule],
  providers: [IncidentSignalsService],
  exports: [IncidentSignalsService],
})
export class IncidentSignalsModule {}
