import { Module } from '@nestjs/common';
import { BusinessReportsController } from './business-reports.controller';
import { BusinessReportsService } from './business-reports.service';
import { FinanceReportService } from './finance-report.service';
import { TelegramService } from './telegram.service';
import { SupplyReportService } from './supply-report.service';
import { FraudReportService } from './fraud-report.service';
import { ReportsKeyGuard } from './reports-key.guard';

@Module({
  controllers: [BusinessReportsController],
  providers: [
    BusinessReportsService,
    FinanceReportService,
    SupplyReportService,
    FraudReportService,
    TelegramService,
    ReportsKeyGuard,
  ],
  exports: [TelegramService],
})
export class BusinessReportsModule {}
