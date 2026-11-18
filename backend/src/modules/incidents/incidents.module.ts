import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from '../../database/entities/incident.entity';
import { User } from '../../database/entities/user.entity';
import { AuditModule } from '../audit/audit.module';
import { DriversModule } from '../drivers/drivers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { IncidentsController, ManagerIncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentReviewService } from './incident-review.service';
import { IncidentResolutionService } from './incident-resolution.service';
import { IncidentOutcomeExecutor } from './incident-outcome-executor';
import { IncidentPhotosStore } from './incident-photos';
import { IncidentBlockNotifier } from './incident-block-notifier';

/** Shikoyat va hodisa — yagona `incidents` (docs/INCIDENT-POLICY.md §3, migratsiya 050). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, User]),
    AuditModule,
    DriversModule,
    NotificationsModule,
    SettingsModule,
    StorageModule,
    UsersModule,
  ],
  controllers: [IncidentsController, ManagerIncidentsController],
  providers: [
    IncidentsService,
    IncidentReviewService,
    IncidentResolutionService,
    IncidentOutcomeExecutor,
    IncidentPhotosStore,
    IncidentBlockNotifier,
  ],
})
export class IncidentsModule {}
