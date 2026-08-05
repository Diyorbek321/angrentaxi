import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { BlockUserDto } from './dto/block-user.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { OptionalEnumPipe } from '../../common/pipes/optional-enum.pipe';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.USERS_VIEW)
  @ApiOperation({ summary: 'List all users (admin/manager only)' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('role', new OptionalEnumPipe(UserRole, 'role')) role?: UserRole,
  ) {
    return this.usersService.findAll(Number(page), Number(limit), role);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@CurrentUser() user: User): User {
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Updated user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(user.id, dto);
  }

  @Get(':id')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.USERS_VIEW)
  @ApiOperation({ summary: 'Get user by ID (manager/admin only)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findByIdOrThrow(id);
  }

  @Patch(':id/block')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Block a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User blocked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async blockUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockUserDto,
  ): Promise<User> {
    return this.usersService.blockUser(id, dto.reason);
  }

  @Patch(':id/unblock')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Unblock a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User unblocked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unblockUser(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.unblockUser(id);
  }

  // Staff & Roles — an admin decides which of the fine-grained Permission
  // values a given MANAGER account gets (see PermissionsGuard). No effect on
  // non-manager accounts (ADMIN always has everything; other roles don't
  // consult this list at all).
  @Patch(':id/permissions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Set a manager's fine-grained permissions (admin only)" })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Permissions updated' })
  async updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
  ): Promise<User> {
    return this.usersService.updatePermissions(id, dto.permissions);
  }
}
