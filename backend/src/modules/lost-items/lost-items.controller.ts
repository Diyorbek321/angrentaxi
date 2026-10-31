import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { OptionalEnumPipe } from '../../common/pipes/optional-enum.pipe';
import { Permission, User, PASSENGER_APP_ROLES, UserRole } from '../../database/entities/user.entity';
import { LostItemReport, LostItemStatus } from '../../database/entities/lost-item-report.entity';
import { LostItemsService, OperatorLostItemView } from './lost-items.service';
import { DriverLostItemResponseDto, OperatorLostItemUpdateDto, ReportLostItemDto } from './dto/lost-item.dto';

@ApiTags('Lost items')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('lost-items')
export class LostItemsController {
  constructor(private readonly lostItemsService: LostItemsService) {}

  @Post()
  @Roles(...PASSENGER_APP_ROLES)
  @ApiOperation({ summary: "Safarda qoldirilgan buyum haqida xabar (yakunlangan safar, 7 kun ichida)" })
  @ApiResponse({ status: 409, description: 'Bu safar uchun ochiq xabar allaqachon bor' })
  async report(@CurrentUser() user: User, @Body() dto: ReportLostItemDto): Promise<LostItemReport> {
    return this.lostItemsService.report(user.id, dto);
  }

  @Get('mine')
  @Roles(...PASSENGER_APP_ROLES, UserRole.DRIVER)
  @ApiOperation({ summary: "Yo'lovchi: o'z xabarlari · Haydovchi: o'z safarlari bo'yicha xabarlar" })
  async mine(@CurrentUser() user: User): Promise<LostItemReport[]> {
    return this.lostItemsService.listMine(user);
  }

  @Patch(':id/driver-response')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Haydovchi: buyum topildimi' })
  async driverRespond(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DriverLostItemResponseDto,
  ): Promise<LostItemReport> {
    return this.lostItemsService.driverRespond(user.id, id, dto);
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: "Dispetcher navbati, eng eskisi birinchi — ikkala tomon telefoni bilan" })
  @ApiQuery({ name: 'status', required: false, enum: LostItemStatus })
  async list(
    @Query('status', new OptionalEnumPipe(LostItemStatus)) status?: LostItemStatus,
  ): Promise<OperatorLostItemView[]> {
    return this.lostItemsService.listForOperators(status);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @ApiOperation({ summary: 'Dispetcher: qaytarildi yoki yopildi' })
  async operatorUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OperatorLostItemUpdateDto,
  ): Promise<LostItemReport> {
    return this.lostItemsService.operatorUpdate(id, dto);
  }
}
