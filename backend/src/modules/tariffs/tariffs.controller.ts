import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TariffsService } from './tariffs.service';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Tariffs')
@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active tariffs' })
  @ApiResponse({ status: 200, description: 'List of active tariffs' })
  async findAll(): Promise<Tariff[]> {
    return this.tariffsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tariff by ID' })
  @ApiParam({ name: 'id', description: 'Tariff UUID' })
  @ApiResponse({ status: 200, description: 'Tariff found' })
  @ApiResponse({ status: 404, description: 'Tariff not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Tariff> {
    return this.tariffsService.findById(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create tariff (admin only)' })
  @ApiResponse({ status: 201, description: 'Tariff created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() dto: CreateTariffDto): Promise<Tariff> {
    return this.tariffsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update tariff (admin only)' })
  @ApiParam({ name: 'id', description: 'Tariff UUID' })
  @ApiResponse({ status: 200, description: 'Tariff updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tariff not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTariffDto,
  ): Promise<Tariff> {
    return this.tariffsService.update(id, dto);
  }

  @Patch(':id/surge')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Set surge multiplier for a tariff (manager/admin only)' })
  @ApiParam({ name: 'id', description: 'Tariff UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { multiplier: { type: 'number', minimum: 1.0, maximum: 3.0, example: 1.5 } },
      required: ['multiplier'],
    },
  })
  @ApiResponse({ status: 200, description: 'Surge multiplier updated' })
  @ApiResponse({ status: 400, description: 'Multiplier out of range (1.0 – 3.0)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tariff not found' })
  async setSurge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('multiplier') multiplier: number,
  ): Promise<Tariff> {
    return this.tariffsService.setSurgeMultiplier(id, multiplier);
  }
}
