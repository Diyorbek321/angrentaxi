import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { UpdateGlobalSettingsDto } from './dto/update-global-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, UserRole } from '../../database/entities/user.entity';

@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('commission')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.TARIFFS_MANAGE)
  @ApiOperation({ summary: 'Get the platform default commission rate (manager/admin only)' })
  async getCommission() {
    return this.settingsService.getCommissionSettings();
  }

  @Patch('commission')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set the platform default commission rate (admin only)' })
  async updateCommission(@Body() dto: UpdateCommissionDto) {
    return this.settingsService.setDefaultCommissionRate(dto.defaultCommissionRate);
  }

  @Get('global')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get platform name/support contact/maintenance-mode flag (manager/admin only)' })
  async getGlobal() {
    return this.settingsService.getGlobalSettings();
  }

  @Patch('global')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update platform name/support contact/maintenance-mode flag (admin only)' })
  async updateGlobal(@Body() dto: UpdateGlobalSettingsDto) {
    return this.settingsService.updateGlobalSettings(dto);
  }
}
