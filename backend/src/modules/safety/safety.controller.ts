import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { CallRelayResult, OrderCallsService } from './order-calls.service';
import { RequestCallDto } from './dto/request-call.dto';
import { OrderEvidence, OrderEvidenceService } from './order-evidence.service';
import { ReportSosDto } from './dto/report-sos.dto';
import { ResolveSosDto } from './dto/resolve-sos.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { SosAlert, SosReporterRole } from '../../database/entities/sos-alert.entity';

@ApiTags('Safety')
@ApiBearerAuth('JWT-auth')
@Controller()
export class SafetyController {
  constructor(
    private readonly safetyService: SafetyService,
    private readonly orderCalls: OrderCallsService,
    private readonly evidence: OrderEvidenceService,
  ) {}

  /**
   * Ilova orqali qo'ng'iroq (INCIDENT-POLICY §4): qarshi tomon raqami faqat
   * faol buyurtmada, faqat ishtirokchiga; har so'rov jurnalga.
   */
  @Post('orders/:orderId/call')
  @UseGuards(JwtAuthGuard)
  @Throttle({ long: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Participant: get the counterparty's phone for an active order (logged)" })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 400, description: 'Order is not active' })
  @ApiResponse({ status: 403, description: 'Caller is not a party to this order' })
  async requestCall(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
    @Body() dto: RequestCallDto,
  ): Promise<CallRelayResult> {
    return this.orderCalls.requestCall(orderId, user, dto?.target ?? 'counterparty');
  }

  /** Nizoli buyurtma dalillari — har ko'rish audit jurnaliga. */
  @Get('manager/orders/:orderId/evidence')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'Order evidence: GPS track, trip chat, SOS, ratings, calls, incidents (audited)' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  async getEvidence(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ): Promise<OrderEvidence> {
    return this.evidence.getEvidence(orderId, user.id);
  }

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
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'Mark an SOS alert resolved with a mandatory note (admin/manager only)' })
  @ApiParam({ name: 'id', description: 'SOS alert UUID' })
  @ApiResponse({ status: 200, description: 'Alert marked resolved' })
  @ApiResponse({ status: 409, description: 'Already resolved' })
  async resolveSos(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: ResolveSosDto,
  ): Promise<SosAlert> {
    return this.safetyService.resolveSos(id, user.id, dto.note);
  }

  @Get('sos/active')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'List all currently active SOS alerts, newest first (admin/manager only)' })
  @ApiResponse({ status: 200, description: 'Active SOS alerts' })
  async listActive(): Promise<SosAlert[]> {
    return this.safetyService.listActive();
  }

  @Get('sos/today-summary')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: "Today's SOS resolved/still-open counts, for the shift report (admin/manager only)" })
  async getTodaySummary(): Promise<{ resolvedToday: number; stillOpen: number }> {
    return this.safetyService.getTodaySummary();
  }
}
