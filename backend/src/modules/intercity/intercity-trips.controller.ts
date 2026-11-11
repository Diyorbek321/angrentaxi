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
import { IntercityBookingsService } from './intercity-bookings.service';
import { IntercityBookingManageView } from './intercity-booking-manage-view';
import { PublishIntercityTripDto } from './dto/publish-intercity-trip.dto';
import { SearchIntercityTripsDto } from './dto/search-intercity-trips.dto';
import {
  IntercityTripManagePage,
  IntercityTripPage,
  IntercityTripsService,
} from './intercity-trips.service';
import { IntercityTripView } from './intercity-trip-view';
import { RoutePlanQueryDto } from './dto/route-plan-query.dto';
import { IntercityRoutePlanService, IntercityRoutePlanView } from './intercity-route-plan.service';

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
  constructor(
    private readonly trips: IntercityTripsService,
    private readonly bookings: IntercityBookingsService,
    private readonly routePlan: IntercityRoutePlanService,
  ) {}

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
  listForManage(@Query() query: ManageIntercityTripsQueryDto): Promise<IntercityTripManagePage> {
    return this.trips.listForManage(query);
  }

  /** ⚠️ Yo'lovchi telefoni bor — faqat dispetcher yo'li. */
  @Get('trips/:id/bookings/manage')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiParam({ name: 'id', description: 'Qatnov UUID' })
  @ApiOperation({ summary: "Dispetcher: qatnovning bandlari (yo'lovchi ismi va telefoni bilan)" })
  listBookingsForManage(@Param('id', ParseUUIDPipe) id: string): Promise<IntercityBookingManageView[]> {
    return this.bookings.listForManage(id);
  }

  /** Joylar qaytadi (yo'lovchi yo'li bilan bir xil tranzaksiya), yo'lovchiga xabar boradi. */
  @Post('bookings/:orderId/cancel/manage')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiParam({ name: 'orderId', description: 'Band (buyurtma) UUID' })
  @ApiOperation({ summary: "Dispetcher: yo'lovchining bandini bekor qilish (faqat yig'ish boshlanmaguncha)" })
  @ApiResponse({ status: 409, description: 'INTERCITY_BOOKING_NOT_CANCELLABLE' })
  cancelBookingForManage(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CancelIntercityTripDto,
  ): Promise<IntercityBookingManageView> {
    return this.bookings.cancelForManage(orderId, dto.reason);
  }

  @Get('trips')
  @ApiOperation({
    summary: "Yo'nalish va Toshkent kuni bo'yicha ochiq qatnovlar",
    description: "Ixtiyoriy pickupLat/Lng, dropoffLat/Lng — har qatnovga `fit` (sizning tomonga / boshqa tumanga / aylanma)",
  })
  search(@Query() query: SearchIntercityTripsDto): Promise<IntercityTripView[]> {
    const pickup =
      query.pickupLat !== undefined && query.pickupLng !== undefined
        ? { lat: query.pickupLat, lng: query.pickupLng }
        : undefined;
    const dropoff =
      query.dropoffLat !== undefined && query.dropoffLng !== undefined
        ? { lat: query.dropoffLat, lng: query.dropoffLng }
        : undefined;
    return this.trips.search(query.routeId, query.date, new Date(), { pickup, dropoff });
  }

  /** Haydovchi: bekatlar tartibi (kimni birinchi olish/tushirish) — eng qisqa yo'l bo'yicha. */
  @Get('trips/:id/route-plan')
  @Roles(UserRole.DRIVER)
  @ApiParam({ name: 'id', description: 'Qatnov UUID' })
  @ApiOperation({ summary: "Haydovchi: shahar ichidagi bekatlar tartibi va oraliq vaqtlar" })
  getRoutePlan(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: RoutePlanQueryDto,
  ): Promise<IntercityRoutePlanView> {
    const from =
      query.fromLat !== undefined && query.fromLng !== undefined ? { lat: query.fromLat, lng: query.fromLng } : undefined;
    return this.routePlan.planForDriver(user.id, id, from);
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
