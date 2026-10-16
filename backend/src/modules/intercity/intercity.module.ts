import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { SettingsModule } from '../settings/settings.module';
import { IntercityController, IntercityManageController } from './intercity.controller';
import { IntercityPointsService } from './intercity-points.service';
import { IntercityRoutesService } from './intercity-routes.service';

/**
 * Shaharlararo qatnov. 1-qadam: nuqtalar, yo'nalishlar, qat'iy narxlar.
 * Qatnovlar va band qilish keyingi qadamlarda shu modulga qo'shiladi.
 *
 * `AuditModule` global — import shart emas.
 */
@Module({
  imports: [TypeOrmModule.forFeature([IntercityPoint, IntercityRoute]), SettingsModule],
  controllers: [IntercityController, IntercityManageController],
  providers: [IntercityPointsService, IntercityRoutesService],
  exports: [IntercityPointsService, IntercityRoutesService],
})
export class IntercityModule {}
