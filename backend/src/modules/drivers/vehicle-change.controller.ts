import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { VehicleChangeRequest } from '../../database/entities/vehicle-change-request.entity';
import { PendingVehicleChange, VehicleChangeService } from './vehicle-change.service';
import { RequestVehicleChangeDto, ReviewVehicleChangeDto } from './dto/vehicle-change.dto';

@ApiTags('Drivers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('drivers')
export class VehicleChangeController {
  constructor(private readonly vehicleChangeService: VehicleChangeService) {}

  @Get('me/vehicle-change')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Mashina o'zgartirish bo'yicha oxirgi so'rovim (yo'q bo'lsa null)" })
  async mine(@CurrentUser() user: User): Promise<VehicleChangeRequest | null> {
    return this.vehicleChangeService.latestForUser(user.id);
  }

  @Post('me/vehicle-change')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Mashinani almashtirish so'rovi — menejer tasdiqlagach kuchga kiradi" })
  @ApiResponse({ status: 409, description: "Ochiq so'rov allaqachon bor" })
  async request(
    @CurrentUser() user: User,
    @Body() dto: RequestVehicleChangeDto,
  ): Promise<VehicleChangeRequest> {
    return this.vehicleChangeService.request(user.id, dto);
  }

  @Get('vehicle-changes/pending')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DRIVERS_APPROVE)
  @ApiOperation({ summary: "Ko'rib chiqilmagan mashina o'zgarishlari, eng eskisi birinchi" })
  async pending(): Promise<PendingVehicleChange[]> {
    return this.vehicleChangeService.listPending();
  }

  @Patch('vehicle-changes/:id/review')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DRIVERS_APPROVE)
  @ApiOperation({ summary: "Mashina o'zgarishini tasdiqlash yoki rad etish" })
  async review(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVehicleChangeDto,
  ): Promise<VehicleChangeRequest> {
    return this.vehicleChangeService.review(id, user.id, dto);
  }
}
