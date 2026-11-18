import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { TaxWithholdingReportService } from './tax-withholding-report.service';
import { TaxReportQueryDto } from './dto/tax-report-query.dto';

/** Soliq agenti hisoboti (PQ-247) — faqat admin. */
@ApiTags('Tax withholding (admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/tax-withholding')
export class TaxWithholdingController {
  constructor(private readonly reports: TaxWithholdingReportService) {}

  @Get('report')
  @ApiOperation({ summary: 'Monthly per-driver/courier withholding report (admin only)' })
  report(@Query() query: TaxReportQueryDto) {
    return this.reports.getMonthlyReport(query.month);
  }

  /**
   * CSV fayl. `@Res()` orqali — aks holda global ResponseInterceptor matnni
   * `{ success, data }` konvertiga o'rab qo'yardi.
   */
  @Get('report.csv')
  @ApiOperation({ summary: 'Monthly withholding report as CSV (admin only)' })
  async reportCsv(@Query() query: TaxReportQueryDto, @Res() res: Response): Promise<void> {
    const csv = await this.reports.getMonthlyReportCsv(query.month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tax-withholding-${query.month}.csv"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(`﻿${csv}`);
  }
}
