import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { AnalyticsService, FunnelReport } from './analytics.service';
import { RecordFunnelDto } from './dto/record-funnel.dto';

/** Bitta qurilma voronkani daqiqasiga bir necha marta yuboradi, xolos. */
const RECORD_THROTTLE = { long: { limit: 30, ttl: 60000 } };

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  // Ochiq (JWT'siz): voronka kirishdan OLDIN boshlanadi (ilova ochildi).
  // Hech qanday shaxsiy ma'lumot qabul qilinmaydi — faqat bosqich nomlari.
  @Post('funnel')
  @HttpCode(204)
  @Throttle(RECORD_THROTTLE)
  @ApiOperation({ summary: 'Anonim voronka bosqichlarini qayd etish' })
  async record(@Body() dto: RecordFunnelDto): Promise<void> {
    await this.analytics.record(dto.app, dto.steps);
  }

  @Get('funnel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Yo'lovchi voronkasi: ilova + server bosqichlari (manager/admin)" })
  @ApiQuery({ name: 'from', required: true, example: '2026-10-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-10-27' })
  getFunnel(@Query('from') from: string, @Query('to') to: string): Promise<FunnelReport> {
    return this.analytics.getFunnel(from, to);
  }
}
