import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessReportsService, FinanceReport, SupplyReport } from './business-reports.service';
import { ReportsKeyGuard } from './reports-key.guard';
import { ReportPeriodQuery } from './dto/report-period.query';
import { ReportPeriod, periodDays, yesterday } from './report-period';

/** Bir so'rovda ko'pi bilan bir yil — og'ir skanerdan himoya. */
const MAX_PERIOD_DAYS = 366;

@ApiTags('Business reports')
@ApiHeader({ name: 'X-Reports-Key', required: true })
@UseGuards(ReportsKeyGuard)
@Controller('business-reports')
export class BusinessReportsController {
  constructor(private readonly reports: BusinessReportsService) {}

  @Get('finance')
  @ApiOperation({ summary: 'Finance snapshot for a Tashkent date range (owner skills)' })
  finance(@Query() query: ReportPeriodQuery): Promise<FinanceReport> {
    return this.reports.report(toPeriod(query));
  }

  @Get('supply')
  @ApiOperation({ summary: 'Drivers department (supply) snapshot for a Tashkent date range' })
  supply(@Query() query: ReportPeriodQuery): Promise<SupplyReport> {
    return this.reports.supplyReport(toPeriod(query));
  }

  @Post('finance/send-daily')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send yesterday's finance + drivers reports to Telegram now (setup check)" })
  async sendDaily(): Promise<{ sent: boolean }> {
    return { sent: await this.reports.sendDaily() };
  }
}

function toPeriod(query: ReportPeriodQuery): ReportPeriod {
  if (!query.from && !query.to) return yesterday();
  if (!query.from || !query.to) throw new BadRequestException('from and to must be given together');
  const period = { from: query.from, to: query.to };
  const days = periodDays(period);
  if (Number.isNaN(days) || days < 1 || days > MAX_PERIOD_DAYS) {
    throw new BadRequestException(`period must be 1..${MAX_PERIOD_DAYS} days`);
  }
  return period;
}
