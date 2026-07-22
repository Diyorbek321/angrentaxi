import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { NotificationsService } from './notifications.service';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { BroadcastDto } from './dto/broadcast.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { NotificationLog } from '../../database/entities/notification-log.entity';

// This endpoint is the one missing link in an otherwise fully-built push
// pipeline: NotificationsService already sends FCM pushes for order-offer/
// driver-assigned/arrived/completed/cancelled events (see
// notifications.service.ts), all gated on `user.fcmToken` being set. Without
// this route, the mobile client's token registration call
// (main_passenger.dart/main_driver.dart) always 404'd, fcmToken stayed null
// forever, and every one of those pushes silently no-opped.
//
// GET/PATCH below back the in-app notifications list: NotificationsService
// now persists a NotificationLog row for every notify* call (see
// notifications.service.ts), independent of whether the push itself could be
// delivered, so a user always has something to see here.
@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('register-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register/update the FCM push token for the current user' })
  @ApiResponse({ status: 204, description: 'Token stored' })
  async registerToken(
    @CurrentUser() user: User,
    @Body() dto: RegisterFcmTokenDto,
  ): Promise<void> {
    await this.usersService.updateFcmToken(user.id, dto.token);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's notification history, newest first (max 50)" })
  @ApiResponse({ status: 200, description: 'Notification history' })
  async list(@CurrentUser() user: User): Promise<NotificationLog[]> {
    return this.notificationsService.listForUser(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'NotificationLog UUID' })
  @ApiResponse({ status: 200, description: 'Notification marked read' })
  @ApiResponse({ status: 404, description: 'Not found or not owned by the caller' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<NotificationLog> {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post('read-all')
  @ApiOperation({ summary: "Mark all of the caller's unread notifications as read" })
  @ApiResponse({ status: 200, description: 'Count of notifications marked read' })
  async markAllRead(@CurrentUser() user: User): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.PROMO_MANAGE)
  @ApiOperation({ summary: 'Send a push notification to an audience (admin, or manager with PROMO_MANAGE)' })
  async broadcast(@CurrentUser() user: User, @Body() dto: BroadcastDto) {
    return this.notificationsService.broadcast(dto.title, dto.body, dto.audience, user.id);
  }

  @Get('broadcast/history')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.PROMO_MANAGE)
  @ApiOperation({ summary: 'List past broadcast pushes (admin, or manager with PROMO_MANAGE)' })
  async broadcastHistory(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.notificationsService.getBroadcastHistory(Number(page), Number(limit));
  }
}
