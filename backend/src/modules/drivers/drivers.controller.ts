import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { SetOnlineStatusDto } from './dto/set-online-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { Driver } from '../../database/entities/driver.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { UsersService } from '../users/users.service';

@ApiTags('Drivers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List all drivers (admin/manager only)' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.driversService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get driver by ID (admin/manager only)' })
  @ApiParam({ name: 'id', description: 'Driver UUID' })
  @ApiResponse({ status: 200, description: 'Driver details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Driver | null> {
    return this.driversService.findById(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a driver (admin/manager only)' })
  @ApiParam({ name: 'id', description: 'Driver UUID' })
  async approveDriver(@Param('id', ParseUUIDPipe) id: string) {
    const driver = await this.driversService.findByIdOrThrow(id);
    await this.usersService.updateStatus(driver.userId, UserStatus.ACTIVE);
    return { ...driver, status: 'approved' };
  }

  @Post('profile')
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create driver profile' })
  @ApiResponse({ status: 201, description: 'Driver profile created' })
  @ApiResponse({ status: 409, description: 'Driver profile already exists' })
  async createProfile(
    @CurrentUser() user: User,
    @Body() dto: CreateDriverDto,
  ): Promise<Driver> {
    return this.driversService.createProfile(user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Get my driver profile' })
  @ApiResponse({ status: 200, description: 'Driver profile' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async getMyProfile(@CurrentUser() user: User): Promise<Driver> {
    return this.driversService.getProfile(user.id);
  }

  @Patch('me')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Update my driver profile' })
  @ApiResponse({ status: 200, description: 'Updated driver profile' })
  async updateMyProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateDriverDto,
  ): Promise<Driver> {
    return this.driversService.updateProfile(user.id, dto);
  }

  @Patch('status')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Set online/offline status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async setStatus(
    @CurrentUser() user: User,
    @Body() dto: SetOnlineStatusDto,
  ): Promise<Driver> {
    return this.driversService.setOnlineStatus(user.id, dto.isOnline);
  }

  @Post('location')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Update driver location (HTTP fallback)' })
  @ApiResponse({ status: 200, description: 'Location updated' })
  async updateLocation(
    @CurrentUser() user: User,
    @Body() dto: UpdateLocationDto,
  ): Promise<{ updated: boolean }> {
    await this.driversService.updateLocation(user.id, dto.lat, dto.lng);
    return { updated: true };
  }
}
