import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalPaginationDto } from '../../common/dto/optional-pagination.dto';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { User, UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CreateIntercityBookingDto } from './dto/create-intercity-booking.dto';
import { IntercityBookingPage, IntercityBookingsService } from './intercity-bookings.service';
import { IntercityBookingView } from './intercity-booking-view';
import { IntercityLifecycleService } from './intercity-lifecycle.service';
import { IntercityTripView } from './intercity-trip-view';

/**
 * Shaharlararo band (yo'lovchi) va qatnov hayot sikli (haydovchi).
 * Har bir band bo'yicha yetib kelish va yakunlash — mavjud
 * `/orders/:id/arrived` va `/orders/:id/complete` orqali.
 */
@ApiTags('Intercity — bookings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('intercity')
export class IntercityBookingsController {
  constructor(
    private readonly bookings: IntercityBookingsService,
    private readonly lifecycle: IntercityLifecycleService,
  ) {}

  // ---------------------------------------------------------------- yo'lovchi

  @Post('trips/:id/bookings')
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: "O'rindiq(lar) yoki butun mashinani band qilish (hozircha naqd)" })
  @ApiResponse({ status: 400, description: 'INTERCITY_BOOKING_INVALID — sabablar `reasons[]` da' })
  @ApiResponse({ status: 409, description: 'INTERCITY_SEATS_UNAVAILABLE | INTERCITY_ALREADY_BOOKED' })
  book(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) tripId: string,
    @Body() dto: CreateIntercityBookingDto,
  ): Promise<IntercityBookingView> {
    return this.bookings.book(user.id, tripId, dto);
  }

  @Get('bookings/me')
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: "Yo'lovchining bandlari (haydovchi telefoni jo'nashga 60 daqiqa qolganda ochiladi)" })
  listMine(@CurrentUser() user: User, @Query() pagination: OptionalPaginationDto): Promise<IntercityBookingPage> {
    return this.bookings.listMine(user.id, pagination);
  }

  @Post('bookings/:orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: "Bandni bekor qilish — yig'ish boshlanmaguncha; joylar qatnovga qaytadi" })
  @ApiResponse({ status: 409, description: 'INTERCITY_BOOKING_NOT_CANCELLABLE' })
  cancel(@CurrentUser() user: User, @Param('orderId', ParseUUIDPipe) orderId: string): Promise<IntercityBookingView> {
    return this.bookings.cancel(user.id, orderId);
  }

  // ---------------------------------------------------------------- haydovchi

  @Post('trips/:id/start-boarding')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Yo'lovchilarni yig'ishni boshlash (jo'nashdan 60 daqiqa oldin yoki to'lganda)" })
  @ApiResponse({ status: 409, description: 'INTERCITY_TRIP_ACTION_NOT_ALLOWED — `details.reason`' })
  startBoarding(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) tripId: string): Promise<IntercityTripView> {
    return this.lifecycle.startBoarding(user.id, tripId);
  }

  @Post('trips/:id/depart')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Jo'nash — barcha faol yo'lovchilar olingan bo'lishi kerak" })
  @ApiResponse({ status: 409, description: 'INTERCITY_TRIP_ACTION_NOT_ALLOWED — `details.reason`' })
  depart(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) tripId: string): Promise<IntercityTripView> {
    return this.lifecycle.depart(user.id, tripId);
  }

  @Post('bookings/:orderId/no-show')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Yo'lovchi kelmadi — band bekor, joy qaytarilmaydi" })
  noShow(@CurrentUser() user: User, @Param('orderId', ParseUUIDPipe) orderId: string): Promise<IntercityTripView> {
    return this.lifecycle.markNoShow(user.id, orderId);
  }
}
