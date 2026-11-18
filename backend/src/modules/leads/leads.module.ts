import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../../database/entities/lead.entity';
import { BusinessReportsModule } from '../business-reports/business-reports.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lead]), BusinessReportsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
