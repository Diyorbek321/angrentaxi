import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permission, UserRole } from '../../database/entities/user.entity';
import { Lead } from '../../database/entities/lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LEAD_THROTTLE } from './leads.constants';
import { LeadsPage, LeadsService } from './leads.service';

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // Ochiq: korporativ sayt (bosh domen, Caddy orqali bir xil origin).
  @Post()
  @HttpCode(201)
  @Throttle(LEAD_THROTTLE)
  @ApiOperation({ summary: "Saytdan ariza: haydovchi / kuryer / hamkor bo'lish" })
  async create(@Body() dto: CreateLeadDto): Promise<{ received: true }> {
    await this.leads.create(dto);
    return { received: true };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  // Arizalar — yollash ishi: haydovchilar ro'yxatini ko'radigan menejer.
  @RequirePermissions(Permission.DRIVERS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arizalar ro‘yxati (manager/admin)' })
  list(@Query() query: ListLeadsDto): Promise<LeadsPage> {
    return this.leads.list(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  // Arizalar — yollash ishi: haydovchilar ro'yxatini ko'radigan menejer.
  @RequirePermissions(Permission.DRIVERS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ariza holati / izoh (manager/admin)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto): Promise<Lead> {
    return this.leads.update(id, dto);
  }
}
