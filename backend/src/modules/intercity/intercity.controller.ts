import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { IntercityRoutesService } from './intercity-routes.service';
import { IntercityPointsService } from './intercity-points.service';
import { IntercityRouteView } from './intercity-route-view';
import { CreateIntercityPointDto } from './dto/create-intercity-point.dto';
import { UpdateIntercityPointDto } from './dto/update-intercity-point.dto';
import { CreateIntercityRouteDto } from './dto/create-intercity-route.dto';
import { UpdateIntercityRouteDto } from './dto/update-intercity-route.dto';
import { CreateIntercityZoneDto } from './dto/create-intercity-zone.dto';
import { UpdateIntercityZoneDto } from './dto/update-intercity-zone.dto';
import { IntercityZonesService } from './intercity-zones.service';
import { IntercityZone } from '../../database/entities/intercity-zone.entity';

/** Ommaviy: yo'lovchi va haydovchi ilovasi uchun yo'nalishlar va narxlar. */
@ApiTags('Intercity')
@Controller('intercity')
export class IntercityController {
  constructor(private readonly routes: IntercityRoutesService) {}

  @Get('routes')
  @ApiOperation({ summary: "Faol shaharlararo yo'nalishlar va qat'iy narxlar — ochiq" })
  @ApiResponse({ status: 404, description: 'INTERCITY_DISABLED — funksiya o‘chiq' })
  listRoutes(): Promise<IntercityRouteView[]> {
    return this.routes.listPublic();
  }
}

/**
 * Boshqaruv: nuqtalar va yo'nalishlar. Huquq — tariflar bilan bir xil
 * (`TARIFFS_MANAGE`): qat'iy narx ham tarif.
 *
 * O'chirish endpointi ATAYLAB yo'q — `isActive: false` (tarix saqlansin).
 */
@ApiTags('Intercity (manage)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@RequirePermissions(Permission.TARIFFS_MANAGE)
@Controller('intercity')
export class IntercityManageController {
  constructor(
    private readonly routes: IntercityRoutesService,
    private readonly points: IntercityPointsService,
    private readonly zones: IntercityZonesService,
  ) {}

  @Get('points/manage')
  @ApiOperation({ summary: 'Barcha nuqtalar, nofaollari bilan' })
  listPoints(): Promise<IntercityPoint[]> {
    return this.points.findAll();
  }

  @Post('points/manage')
  @ApiOperation({ summary: "Nuqta qo'shish (Angren, Rohat krugi (Toshkent)...)" })
  createPoint(@Body() dto: CreateIntercityPointDto): Promise<IntercityPoint> {
    return this.points.create(dto);
  }

  @Patch('points/manage/:id')
  @ApiParam({ name: 'id', description: 'Nuqta UUID' })
  @ApiOperation({ summary: 'Nuqtani yangilash / faolsizlantirish' })
  updatePoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntercityPointDto,
  ): Promise<IntercityPoint> {
    return this.points.update(id, dto);
  }

  @Get('points/manage/:id/zones')
  @ApiParam({ name: 'id', description: 'Nuqta UUID' })
  @ApiOperation({ summary: 'Nuqta tumanlari, nofaollari bilan' })
  listZones(@Param('id', ParseUUIDPipe) id: string): Promise<IntercityZone[]> {
    return this.zones.listForPoint(id);
  }

  @Post('points/manage/:id/zones')
  @ApiParam({ name: 'id', description: 'Nuqta UUID' })
  @ApiOperation({ summary: "Nuqtaga tuman qo'shish (Yunusobod, Chilonzor...)" })
  @ApiResponse({ status: 409, description: 'Shu nomli tuman allaqachon bor' })
  createZone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateIntercityZoneDto): Promise<IntercityZone> {
    return this.zones.create(id, dto);
  }

  @Patch('zones/manage/:id')
  @ApiParam({ name: 'id', description: 'Tuman UUID' })
  @ApiOperation({ summary: 'Tumanni yangilash / faolsizlantirish' })
  updateZone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIntercityZoneDto): Promise<IntercityZone> {
    return this.zones.update(id, dto);
  }

  @Get('routes/manage')
  @ApiOperation({ summary: "Barcha yo'nalishlar, nofaollari bilan" })
  listAllRoutes(): Promise<IntercityRoute[]> {
    return this.routes.findAll();
  }

  @Post('routes/manage')
  @ApiOperation({ summary: "Yo'nalish qo'shish (har bir yo'nalish alohida qator)" })
  @ApiResponse({ status: 400, description: 'INTERCITY_ROUTE_INVALID — narxlar qoidaga zid' })
  @ApiResponse({ status: 409, description: "Yo'nalish allaqachon bor" })
  createRoute(
    @CurrentUser() user: User,
    @Body() dto: CreateIntercityRouteDto,
  ): Promise<IntercityRoute> {
    return this.routes.create(user.id, dto);
  }

  @Patch('routes/manage/:id')
  @ApiParam({ name: 'id', description: "Yo'nalish UUID" })
  @ApiOperation({ summary: "Narx / o'rindiqlar / faollikni o'zgartirish (uchlar o'zgarmaydi)" })
  updateRoute(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntercityRouteDto,
  ): Promise<IntercityRoute> {
    return this.routes.update(user.id, id, dto);
  }
}
