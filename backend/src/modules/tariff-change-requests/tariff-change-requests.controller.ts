import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TariffChangeRequestsService } from './tariff-change-requests.service';
import { ProposeTariffChangeDto } from './dto/propose-tariff-change.dto';
import { ReviewTariffChangeDto } from './dto/review-tariff-change.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import {
  TariffChangeRequest,
  TariffChangeRequestStatus,
} from '../../database/entities/tariff-change-request.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { OptionalEnumPipe } from '../../common/pipes/optional-enum.pipe';

@ApiTags('Tariff Change Requests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('tariff-change-requests')
export class TariffChangeRequestsController {
  constructor(private readonly requestsService: TariffChangeRequestsService) {}

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.TARIFFS_MANAGE)
  @ApiOperation({ summary: 'Propose a tariff create/update (manager/admin only)' })
  @ApiResponse({ status: 201, description: 'Proposal created, awaiting admin approval' })
  async propose(
    @CurrentUser() user: User,
    @Body() dto: ProposeTariffChangeDto,
  ): Promise<TariffChangeRequest> {
    return this.requestsService.propose(user.id, dto);
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.TARIFFS_MANAGE)
  @ApiOperation({ summary: 'List tariff change requests (manager/admin only)' })
  async findAll(
    @Query('status', new OptionalEnumPipe(TariffChangeRequestStatus, 'status'))
    status?: TariffChangeRequestStatus,
  ): Promise<TariffChangeRequest[]> {
    return this.requestsService.findAll(status);
  }

  @Get(':id')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.TARIFFS_MANAGE)
  @ApiOperation({ summary: 'Get a tariff change request by ID (manager/admin only)' })
  @ApiParam({ name: 'id', description: 'Tariff change request UUID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TariffChangeRequest> {
    return this.requestsService.findByIdOrThrow(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a tariff change request (admin only)' })
  @ApiParam({ name: 'id', description: 'Tariff change request UUID' })
  @ApiResponse({ status: 400, description: 'Request has already been reviewed' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewTariffChangeDto,
  ): Promise<TariffChangeRequest> {
    return this.requestsService.approve(id, user.id, dto.reviewNote);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a tariff change request (admin only)' })
  @ApiParam({ name: 'id', description: 'Tariff change request UUID' })
  @ApiResponse({ status: 400, description: 'Request has already been reviewed' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewTariffChangeDto,
  ): Promise<TariffChangeRequest> {
    return this.requestsService.reject(id, user.id, dto.reviewNote);
  }
}
