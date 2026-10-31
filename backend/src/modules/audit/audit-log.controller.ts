import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
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
  @ApiOperation({ summary: 'Staff actions (money, payouts, blocks, permissions, KYC), newest first' })
  list(@CurrentUser() user: User, @Query() query: AuditLogQueryDto): Promise<AuditLogPage> {
    return this.auditLog.list({
      action: query.action,
      targetType: query.targetType,
      targetId: query.targetId,
      actorUserId: query.actorUserId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      // Ruxsatlar/bloklash yozuvlari va xodim bo'yicha kuzatuv — faqat ADMIN.
      restricted: user.role !== UserRole.ADMIN,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
