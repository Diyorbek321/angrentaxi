import { Body, Controller, Get, Headers, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { DriverLegalService, DriverLegalSummary, maskLegalProfile } from './driver-legal.service';
import { UpdateDriverLegalDto } from './dto/update-driver-legal.dto';
import { resolveLanguage } from '../../common/i18n/error-messages';

/**
 * Huquqiy profil (VMQ 200 / PQ-247) — docs/LEGAL-COMPLIANCE.md.
 * ⚠️ `DriversController` dan OLDIN ro'yxatdan o'tadi (drivers.module.ts).
 */
@ApiTags('Drivers — legal profile')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('drivers')
export class DriverLegalController {
  constructor(private readonly legalService: DriverLegalService) {}

  @Get('me/legal')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'My legal profile + taxi eligibility (reasons are warnings until enforced)' })
  async getMine(
    @CurrentUser() user: User,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<DriverLegalSummary> {
    // Sabab matnlari ilova tilida (UZ/RU); kodlar o'zgarmaydi.
    const summary = await this.legalService.getForUser(user.id);
    return this.legalService.localizeSummary(summary, resolveLanguage(acceptLanguage));
  }

  @Patch('me/legal')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Update my legal profile (PINFL, TIN, tax status, licence dates...)' })
  async updateMine(
    @CurrentUser() user: User,
    @Body() dto: UpdateDriverLegalDto,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<DriverLegalSummary> {
    const summary = await this.legalService.updateForUser(user.id, dto);
    return this.legalService.localizeSummary(summary, resolveLanguage(acceptLanguage));
  }

  @Get(':id/legal')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DRIVERS_VIEW)
  @ApiParam({ name: 'id', description: 'Driver UUID' })
  @ApiOperation({ summary: "A driver's legal profile + eligibility (manager/admin)" })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<DriverLegalSummary> {
    const summary = await this.legalService.getForDriverId(id);
    // PINFL/STIR to'liq — faqat DRIVERS_APPROVE (yoki admin); qolganlarga
    // niqoblangan `**********1234` (security review #2).
    const canSeeFull =
      user?.role === UserRole.ADMIN || (user?.permissions ?? []).includes(Permission.DRIVERS_APPROVE);
    return canSeeFull ? summary : { ...summary, profile: maskLegalProfile(summary.profile) };
  }

  @Patch(':id/legal')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DRIVERS_APPROVE)
  @ApiParam({ name: 'id', description: 'Driver UUID' })
  @ApiOperation({ summary: "Correct a driver's legal profile (manager with DRIVERS_APPROVE / admin)" })
  updateOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverLegalDto,
    @CurrentUser() user: User,
  ): Promise<DriverLegalSummary> {
    // Aktyor — `audit_logs` uchun (#4).
    return this.legalService.updateForDriverId(id, dto, user?.id ?? null);
  }
}
