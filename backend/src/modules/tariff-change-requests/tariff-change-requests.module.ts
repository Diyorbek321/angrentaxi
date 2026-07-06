import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TariffChangeRequestsController } from './tariff-change-requests.controller';
import { TariffChangeRequestsService } from './tariff-change-requests.service';
import { TariffChangeRequest } from '../../database/entities/tariff-change-request.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { TariffsModule } from '../tariffs/tariffs.module';

@Module({
  imports: [TypeOrmModule.forFeature([TariffChangeRequest, Tariff]), TariffsModule],
  controllers: [TariffChangeRequestsController],
  providers: [TariffChangeRequestsService],
  exports: [TariffChangeRequestsService],
})
export class TariffChangeRequestsModule {}
