import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { ReportSosDto } from './dto/report-sos.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { User, UserRole } from '../../database/entities/user.entity';
import { SosAlert, SosReporterRole } from '../../database/entities/sos-alert.entity';

@ApiTags('Safety')
@ApiBearerAuth('JWT-auth')
@Controller()
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  // Any authenticated passenger/driver may report; SafetyService.reportSos
  // is what actually verifies they belong to this specific order.
  @Post('orders/:orderId/sos')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Raise an emergency SOS alert on a trip (passenger or driver)' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 201, description: 'SOS alert created and pushed to dispatchers' })
  @ApiResponse({ status: 403, description: 'Caller is not a party to this order' })
  async reportSos(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
    @Body() dto: ReportSosDto,
  ): Promise<SosAlert> {
    const role =
      user.role === UserRole.DRIVER ? SosReporterRole.DRIVER : SosReporterRole.PASSENGER;
    return this.safetyService.reportSos(orderId, user.id, role, dto);
  }

  @Patch('sos/:id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mark an SOS alert resolved (admin/manager only)' })
  @ApiParam({ name: 'id', description: 'SOS alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert marked resolved' })
  async resolveSos(@Param('id', ParseUUIDPipe) id: string): Promise<SosAlert> {
    return this.safetyService.resolveSos(id);
  }

  @Get('sos/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List all currently active SOS alerts, newest first (admin/manager only)' })
  @ApiResponse({ status: 200, description: 'Active SOS alerts' })
  async listActive(): Promise<SosAlert[]> {
    return this.safetyService.listActive();
  }
}
