import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, UserRole } from '../../database/entities/user.entity';
import { AuditLogPage, AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('Audit log')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/audit-log')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DRIVERS_FINANCE)
  @ApiOperation({ summary: 'Manual money actions (balance adjustments, shift pass cancellations), newest first' })
  list(@Query() query: AuditLogQueryDto): Promise<AuditLogPage> {
    return this.auditLog.list({
      action: query.action,
      targetType: query.targetType,
      targetId: query.targetId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
