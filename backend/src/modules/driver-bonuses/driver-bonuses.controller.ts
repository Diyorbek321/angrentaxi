import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DriverBonusesService, DriverBonusProgress } from './driver-bonuses.service';
import { CreateBonusRuleDto } from './dto/create-bonus-rule.dto';
import { UpdateBonusRuleDto } from './dto/update-bonus-rule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { DriverBonusRule } from '../../database/entities/driver-bonus-rule.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { DriversService } from '../drivers/drivers.service';

@ApiTags('Driver Bonus Rules')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('driver-bonus-rules')
export class DriverBonusesController {
  constructor(
    private readonly bonusesService: DriverBonusesService,
    private readonly driversService: DriversService,
  ) {}

  @Get('me/progress')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Get the current driver\'s own bonus progress' })
  async getMyProgress(@CurrentUser() user: User): Promise<DriverBonusProgress[]> {
    return this.bonusesService.getProgressForDriver(user.id);
  }

  @Get('driver/:driverId/progress')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a driver\'s bonus progress (manager/admin only)' })
  @ApiParam({ name: 'driverId', description: 'Driver profile UUID' })
  async getDriverProgress(
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<DriverBonusProgress[]> {
    const driver = await this.driversService.findByIdOrThrow(driverId);
    return this.bonusesService.getProgressForDriver(driver.userId);
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List driver bonus rules (manager/admin only)' })
  async findAll(): Promise<DriverBonusRule[]> {
    return this.bonusesService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a bonus rule by ID (manager/admin only)' })
  @ApiParam({ name: 'id', description: 'Bonus rule UUID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<DriverBonusRule> {
    return this.bonusesService.findByIdOrThrow(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a driver bonus rule (admin only)' })
  @ApiResponse({ status: 201, description: 'Bonus rule created' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateBonusRuleDto,
  ): Promise<DriverBonusRule> {
    return this.bonusesService.create(user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a driver bonus rule (admin only)' })
  @ApiParam({ name: 'id', description: 'Bonus rule UUID' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBonusRuleDto,
  ): Promise<DriverBonusRule> {
    return this.bonusesService.update(id, dto);
  }
}
