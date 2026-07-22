import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupportService, SupportThreadListItem } from './support.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ListThreadsQueryDto } from './dto/list-threads-query.dto';
import { SetThreadStatusDto } from './dto/set-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { SupportThread } from '../../database/entities/support-thread.entity';
import { SupportMessage } from '../../database/entities/support-message.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Support Chat')
@ApiBearerAuth('JWT-auth')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('threads/me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get or create the current user\'s support thread' })
  async getMyThread(@CurrentUser() user: User): Promise<SupportThread> {
    return this.supportService.getOrCreateForUser(user);
  }

  @Get('threads')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: 'List support threads (manager/admin only)' })
  async listThreads(
    @Query() query: ListThreadsQueryDto,
  ): Promise<{ threads: SupportThreadListItem[]; total: number; page: number; limit: number }> {
    return this.supportService.listThreads(query.status, query.page, query.limit);
  }

  @Get('threads/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List messages in a thread (owner or manager/admin)' })
  @ApiParam({ name: 'id', description: 'Support thread UUID' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query() query: ListThreadsQueryDto,
  ): Promise<{ messages: SupportMessage[]; total: number; page: number; limit: number }> {
    return this.supportService.getMessages(id, user, query.page, query.limit);
  }

  @Post('threads/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send a message in a thread (owner or manager/admin)' })
  @ApiParam({ name: 'id', description: 'Support thread UUID' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: SendMessageDto,
  ): Promise<SupportMessage> {
    return this.supportService.postMessage(id, user, dto.body);
  }

  @Patch('threads/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark a thread as read for the current user' })
  @ApiParam({ name: 'id', description: 'Support thread UUID' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<{ success: true }> {
    await this.supportService.markRead(id, user);
    return { success: true };
  }

  @Patch('threads/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: 'Open or close a support thread (manager/admin only)' })
  @ApiParam({ name: 'id', description: 'Support thread UUID' })
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetThreadStatusDto,
  ): Promise<SupportThread> {
    return this.supportService.setStatus(id, dto.status);
  }
}
