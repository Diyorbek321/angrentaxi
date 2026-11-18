import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalPaginationDto } from '../../common/dto/optional-pagination.dto';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { User, UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import {
  AcceptIntercityRequestDto,
  CreateIntercityRequestDto,
  IntercityRequestBoardQueryDto,
  ManageIntercityRequestsQueryDto,
  RaiseIntercityRequestBonusDto,
} from './dto/intercity-request.dto';
import { IntercityRequestAcceptService, IntercityRequestAcceptView } from './intercity-request-accept.service';
import { IntercityRequestManageView, IntercityRequestView } from './intercity-request-view';
import { IntercityRequestPage, IntercityRequestQuoteView, IntercityRequestsService } from './intercity-requests.service';

/**
 * Yo'lovchi so'rovlari doskasi: qatnov topmagan yo'lovchi so'rov qoldiradi,
 * haydovchi qabul qiladi — band uning qatnoviga tushadi.
 *
 * ⚠️ `requests/board`, `requests/me`, `requests/manage` — `requests/:id/...`
 * dan OLDIN e'lon qilinadi (Nest marshrutlarni tartib bilan moslaydi).
 */
@ApiTags('Intercity — requests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('intercity/requests')
export class IntercityRequestsController {
  constructor(
    private readonly requests: IntercityRequestsService,
    private readonly acceptance: IntercityRequestAcceptService,
  ) {}

  // ---------------------------------------------------------------- yo'lovchi

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: "So'rov narxi: qat'iy narx + shahar ichiga davom + oshirish — saqlamaydi" })
  @ApiResponse({ status: 400, description: 'INTERCITY_REQUEST_INVALID | INTERCITY_BOOKING_INVALID — `reasons[]`' })
  quote(@Body() dto: CreateIntercityRequestDto): Promise<IntercityRequestQuoteView> {
    return this.requests.quote(dto);
  }

  @Post()
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: "So'rov qoldirish (vaqt oralig'i bilan); haydovchilarga push boradi" })
  @ApiResponse({ status: 409, description: 'INTERCITY_REQUEST_ALREADY_OPEN' })
  create(@CurrentUser() user: User, @Body() dto: CreateIntercityRequestDto): Promise<IntercityRequestView> {
    return this.requests.create(user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: "Yo'lovchining so'rovlari (yangisi birinchi)" })
  listMine(@CurrentUser() user: User, @Query() pagination: OptionalPaginationDto): Promise<IntercityRequestPage> {
    return this.requests.listMine(user.id, pagination);
  }

  // ---------------------------------------------------------------- haydovchi

  @Get('board')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Haydovchi doskasi: ochiq so'rovlar, eng erta boshlanadigani birinchi" })
  board(@CurrentUser() user: User, @Query() query: IntercityRequestBoardQueryDto): Promise<IntercityRequestView[]> {
    return this.requests.board(user.id, query);
  }

  // ---------------------------------------------------------------- menejer

  @Get('manage')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Dispetcher: barcha so'rovlar, yo'lovchi telefoni bilan" })
  listForManage(@Query() query: ManageIntercityRequestsQueryDto): Promise<IntercityRequestPage<IntercityRequestManageView>> {
    return this.requests.listForManage(query);
  }

  // ---------------------------------------------------------------- :id

  @Post(':id/bonus')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: "Narxni oshirish — yangi qo'shimcha summa (faqat yuqoriga)" })
  @ApiResponse({ status: 409, description: 'INTERCITY_REQUEST_CLOSED' })
  raiseBonus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: RaiseIntercityRequestBonusDto,
  ): Promise<IntercityRequestView> {
    return this.requests.raiseBonus(user.id, requestId, dto.bonus);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: "So'rovni bekor qilish (faqat ochiq bo'lsa)" })
  @ApiResponse({ status: 409, description: 'INTERCITY_REQUEST_CLOSED' })
  cancel(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) requestId: string): Promise<IntercityRequestView> {
    return this.requests.cancel(user.id, requestId);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Haydovchi qabul qiladi — mos qatnoviga yoki yangi qatnovga band bo'ladi" })
  @ApiResponse({ status: 409, description: 'INTERCITY_REQUEST_CLOSED | INTERCITY_TRIP_OVERLAP | INTERCITY_SEATS_UNAVAILABLE' })
  accept(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: AcceptIntercityRequestDto,
  ): Promise<IntercityRequestAcceptView> {
    return this.acceptance.accept(user.id, requestId, dto);
  }
}
