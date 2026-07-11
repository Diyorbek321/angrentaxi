import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('commission')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
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
}
