import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OptionalPaginationDto } from '../../common/dto/optional-pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CancelIntercityTripDto } from './dto/cancel-intercity-trip.dto';
import { ManageIntercityTripsQueryDto } from './dto/manage-intercity-trips-query.dto';
import { PublishIntercityTripDto } from './dto/publish-intercity-trip.dto';
import { SearchIntercityTripsDto } from './dto/search-intercity-trips.dto';
import { IntercityTripPage, IntercityTripsService } from './intercity-trips.service';
import { IntercityTripView } from './intercity-trip-view';

/**
 * Shaharlararo qatnovlar. Funksiya o'chiq bo'lsa hamma yo'l 404
 * (`INTERCITY_DISABLED`) — servis darajasida.
 *
 * ⚠️ MARSHRUT TARTIBI: literal `trips/mine` va `trips/manage` parametrli
 * `trips/:id` dan OLDIN e'lon qilinadi — aks holda "mine" UUID deb
 * o'qilib 400 qaytardi (spec tekshiradi).
 *
 * O'qish (`GET trips`, `trips/:id`) har qanday kirgan foydalanuvchiga ochiq:
 * haydovchi ham raqobatchilar narxini ko'rishi zararsiz, telefon esa
 * javobda yo'q (`intercity-trip-view.ts`).
 */
@ApiTags('Intercity — trips')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('intercity')
export class IntercityTripsController {
  constructor(private readonly trips: IntercityTripsService) {}

  @Post('trips')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Haydovchi qatnov e'lon qiladi (narx yo'nalishdan nusxalanadi)" })
  @ApiResponse({ status: 400, description: 'INTERCITY_TRIP_INVALID — sabablar `reasons[]` da' })
  @ApiResponse({ status: 403, description: 'INTERCITY_SERVICE_NOT_ENABLED' })
  @ApiResponse({ status: 409, description: 'INTERCITY_TRIP_OVERLAP — ±3 soatda boshqa qatnov' })
  publish(@CurrentUser() user: User, @Body() dto: PublishIntercityTripDto): Promise<IntercityTripView> {
    return this.trips.publish(user.id, dto);
  }

  @Get('trips/mine')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Haydovchining qatnovlari (yangilari birinchi)" })
  listMine(@CurrentUser() user: User, @Query() pagination: OptionalPaginationDto): Promise<IntercityTripPage> {
    return this.trips.listMine(user.id, pagination);
  }

  @Get('trips/manage')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'Dispetcher: qatnovlar holat/kun bo‘yicha' })
  listForManage(@Query() query: ManageIntercityTripsQueryDto): Promise<IntercityTripPage> {
    return this.trips.listForManage(query);
  }

  @Get('trips')
  @ApiOperation({ summary: "Yo'nalish va Toshkent kuni bo'yicha ochiq qatnovlar" })
  search(@Query() query: SearchIntercityTripsDto): Promise<IntercityTripView[]> {
    return this.trips.search(query.routeId, query.date);
  }

  @Get('trips/:id')
  @ApiParam({ name: 'id', description: 'Qatnov UUID' })
  @ApiOperation({ summary: 'Bitta qatnov' })
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<IntercityTripView> {
    return this.trips.getPublic(id);
  }

  @Post('trips/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.DRIVER)
  @ApiParam({ name: 'id', description: 'Qatnov UUID' })
  @ApiOperation({ summary: "Haydovchi o'z qatnovini bekor qiladi (yo'lga chiqmasdan)" })
  @ApiResponse({ status: 409, description: 'INTERCITY_TRIP_NOT_CANCELLABLE' })
  cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelIntercityTripDto,
  ): Promise<IntercityTripView> {
    return this.trips.cancelByDriver(user.id, id, dto.reason);
  }
}
