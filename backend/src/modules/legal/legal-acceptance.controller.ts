import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { AcceptLegalDto } from './dto/accept-legal.dto';
import { LegalAcceptanceService, LegalDocumentSummary } from './legal-acceptance.service';
import { LegalStatus } from './legal-versions';

/**
 * Oferta roziligi (docs/LEGAL-COMPLIANCE.md §28).
 *   GET  /legal/acceptance — joriy versiyalar + nimani (qayta) qabul qilish kerak
 *   POST /legal/acceptance — `{ items: [{ document, version }], source? }`
 *
 * Ommaviy matn sahifalari (`/legal/terms` ...) — `LegalPagesController`.
 */
@ApiTags('Legal')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('legal/acceptance')
export class LegalAcceptanceController {
  constructor(private readonly service: LegalAcceptanceService) {}

  @Get()
  @ApiOperation({ summary: 'Current legal document versions and whether the user must (re)accept them' })
  status(@CurrentUser() user: User): Promise<LegalStatus> {
    return this.service.getStatus(user);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept the current versions of the listed legal documents' })
  @ApiResponse({ status: 409, description: 'LEGAL_VERSION_OUTDATED — reload status and show the new text' })
  accept(@CurrentUser() user: User, @Body() dto: AcceptLegalDto, @Req() req: Request): Promise<LegalStatus> {
    return this.service.accept(user, dto.items, {
      ip: (req.ip || '').slice(0, 64) || null,
      userAgent: (req.headers['user-agent'] || '').slice(0, 256) || null,
      source: dto.source ?? 'sheet',
    });
  }
}

/** Admin: hujjat versiyalari va rozilik sonlari (faqat o'qish). */
@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/legal')
export class AdminLegalController {
  constructor(private readonly service: LegalAcceptanceService) {}

  @Get('acceptances')
  @ApiOperation({ summary: 'Legal document versions and acceptance counts (admin, read-only)' })
  acceptances(): Promise<{ documents: LegalDocumentSummary[] }> {
    return this.service.summary();
  }
}
