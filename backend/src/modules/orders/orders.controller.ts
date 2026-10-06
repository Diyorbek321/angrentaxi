import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService, DriverEarningsBreakdown } from './orders.service';
import { MatchingService } from '../matching/matching.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CompleteTripDto } from './dto/complete-trip.dto';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReassignDriverDto } from './dto/reassign-driver.dto';
import { PaginationDto } from './dto/pagination.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission, User, PASSENGER_APP_ROLES, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { AddTipDto } from './dto/add-tip.dto';
import { OrdersMeterService, type MeterReading } from './orders-meter.service';
import { OrderReceiptDto } from './dto/order-receipt.dto';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly matchingService: MatchingService,
    private readonly meterService: OrdersMeterService,
  ) {}

  @Post('calculate-price')
  @ApiOperation({ summary: 'Calculate estimated trip price' })
  @ApiResponse({ status: 200, description: 'Price estimate' })
  async calculatePrice(@Body() dto: CalculatePriceDto) {
    return this.ordersService.calculatePrice(dto);
  }

  @Post()
  @Roles(...PASSENGER_APP_ROLES)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createOrder(
    @CurrentUser() user: User,
    @Body() dto: CreateOrderDto,
  ): Promise<Order> {
    const order = await this.ordersService.create(user.id, dto);

    this.startSearchUnlessScheduled(order);

    return order;
  }

  /**
   * Rejalashtirilgan buyurtmada qidiruv HOZIR boshlanmaydi.
   *
   * Uni `ScheduledOrdersService` cron'i `scheduled_at` dan
   * SCHEDULED_DISPATCH_LEAD_MINUTES oldin ishga tushiradi. Bu yerda
   * `startSearch` chaqirilsa, ertangi safar uchun haydovchi BUGUN
   * qidirilardi va 60 soniyadan keyin "haydovchi topilmadi" deb bekor
   * bo'lardi.
   */
  private startSearchUnlessScheduled(order: Order): void {
    if (order.status === OrderStatus.SCHEDULED) {
      this.logger.log(
        `Order ${order.id} is scheduled for ${order.scheduledAt?.toISOString() ?? '?'} — ` +
          'matching deferred to ScheduledOrdersService',
      );
      return;
    }

    // Start matching asynchronously
    this.matchingService.startSearch(order.id).catch((err: unknown) => {
      this.logger.error(`Matching failed for order ${order.id}:`, (err as Error).message);
    });
  }

  @Post('dispatch')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'Create an order on behalf of a passenger (manager/admin only)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createDispatchOrder(@Body() dto: CreateDispatchOrderDto): Promise<Order> {
    const order = await this.ordersService.createForDispatch(dto);

    this.startSearchUnlessScheduled(order);

    return order;
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'List all orders (admin/manager only)' })
  async listAll(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.getAllOrders(query.page ?? 1, query.limit ?? 20, query.status);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get order history for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated order history' })
  async getHistory(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    if (user.role === UserRole.DRIVER) {
      return this.ordersService.getDriverHistory(user.id, page, limit);
    }

    return this.ordersService.getPassengerHistory(user.id, page, limit);
  }

  // No @RequirePermissions here on purpose: basic business-visibility stats
  // (revenue, order counts, driver counts) are the Manager Overview page and
  // should be visible to every manager regardless of which finer permissions
  // they've been granted — only role (MANAGER/ADMIN) gates this.
  @Get('stats')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Dashboard stats (admin/manager only)' })
  async getStats() {
    return this.ordersService.getDashboardStats();
  }

  @Get('reports')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reports with date range (admin/manager only)' })
  @ApiQuery({ name: 'from', required: true, type: String })
  @ApiQuery({ name: 'to', required: true, type: String })
  async getReports(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.ordersService.getReports(from, to);
  }

  @Get('active')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'Get all active orders (manager/admin)' })
  @ApiResponse({ status: 200, description: 'List of active orders' })
  async getActiveOrders(): Promise<Order[]> {
    return this.ordersService.getActiveOrders();
  }

  /**
   * ⚠️ MARSHRUT TARTIBI: bu handler `@Get(':id')` DAN OLDIN turishi SHART.
   *
   * Nest marshrutlarni e'lon tartibida ro'yxatdan o'tkazadi. Pastroqqa
   * qo'yilsa `GET /orders/scheduled` `findOne('scheduled')` ga tushadi va
   * `ParseUUIDPipe` "Validation failed (uuid is expected)" bilan 400
   * qaytaradi — endpoint umuman ishlamaydi, lekin xato xabari boshqa
   * narsani ko'rsatadi.
   */
  @Get('scheduled')
  @Roles(...PASSENGER_APP_ROLES)
  @ApiOperation({ summary: "Yo'lovchining kelgusi rejalashtirilgan safarlari" })
  @ApiResponse({ status: 200, description: 'Rejalashtirilgan safarlar ro\'yxati' })
  async getScheduled(@CurrentUser() user: User): Promise<Order[]> {
    return this.ordersService.getScheduledOrders(user.id);
  }

  @Get('earnings')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: "Get the current driver's earnings for today" })
  async getEarnings(@CurrentUser() user: User): Promise<{ today: number }> {
    return this.ordersService.getDriverEarningsToday(user.id);
  }

  @Get('earnings/breakdown')
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary:
      "Get the current driver's earnings breakdown (today / last 7 days / last 30 days), including commission",
  })
  async getEarningsBreakdown(
    @CurrentUser() user: User,
  ): Promise<DriverEarningsBreakdown> {
    return this.ordersService.getDriverEarningsBreakdown(user.id);
  }

  @Get('dispatch-overrides')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'List the manual dispatch override audit log (manager/admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated dispatch override list' })
  async getDispatchOverrides(@Query() pagination: PaginationDto) {
    return this.ordersService.getDispatchOverrides(pagination.page ?? 1, pagination.limit ?? 20);
  }

  @Get('exceptions/no-drivers-found')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({
    summary:
      'List orders auto-cancelled because MatchingService found no available driver (manager/admin only)',
  })
  @ApiResponse({ status: 200, description: 'Paginated no-drivers-found order list' })
  async getNoDriversFoundExceptions(@Query() pagination: PaginationDto) {
    return this.ordersService.getNoDriversFoundExceptions(pagination.page ?? 1, pagination.limit ?? 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 403, description: 'Not authorized to view this order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    // Only the order's passenger, its assigned driver, or a manager/admin may
    // read an order — the response embeds passenger/driver PII and addresses.
    return this.ordersService.findByIdForUser(id, user);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Tugagan safar cheki' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Chek', type: OrderReceiptDto })
  @ApiResponse({ status: 400, description: 'Safar hali tugamagan' })
  @ApiResponse({ status: 403, description: 'Bu chek sizga tegishli emas' })
  async getReceipt(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderReceiptDto> {
    // Rol guard yo'q — huquq `findByIdForUser` ichida tekshiriladi
    // (yo'lovchi / tayinlangan haydovchi / manager).
    return this.ordersService.getReceipt(id, user);
  }

  @Get(':id/meter')
  @ApiOperation({ summary: 'Taksometr: joriy masofa, vaqt va summa (safar davomida)' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 400, description: 'Taksometrli emas yoki safar davom etmayapti' })
  @ApiResponse({ status: 403, description: 'Bu buyurtma sizga tegishli emas' })
  async getMeter(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MeterReading> {
    // Rol guard yo'q — huquq `findByIdForUser` ichida (chek bilan bir xil).
    return this.meterService.reading(id, user);
  }

  @Post(':id/tip')
  @Roles(...PASSENGER_APP_ROLES)
  @ApiOperation({ summary: "Haydovchiga chaqim (komissiyasiz, hamyondan)" })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 201, description: 'Chaqim berildi' })
  @ApiResponse({
    status: 400,
    description: "Safar tugamagan, 24 soat o'tgan yoki hamyonda mablag' yetarli emas",
  })
  @ApiResponse({ status: 409, description: 'Chaqim allaqachon berilgan' })
  async addTip(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTipDto,
  ): Promise<{ tipAmount: number; walletBalance: number }> {
    return this.ordersService.addTip(user.id, id, dto);
  }

  @Patch(':id/accept')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver accepts an order' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order accepted' })
  async acceptOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    const order = await this.ordersService.acceptOrder(user.id, id);
    await this.matchingService.driverAccepted(user.id, id);
    return order;
  }

  @Patch(':id/decline')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver declines an offered order' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Decline recorded, order re-offered to the next driver' })
  async declineOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true }> {
    await this.matchingService.driverDeclined(user.id, id);
    return { success: true };
  }

  @Patch(':id/arrived')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver marks arrived at pickup' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Arrived status set' })
  @ApiResponse({ status: 400, description: 'Not within 500m of pickup location' })
  async driverArrived(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    return this.ordersService.driverArrived(user.id, id);
  }

  @Patch(':id/start')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver starts the trip' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Trip started' })
  async startTrip(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    return this.ordersService.startTrip(user.id, id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver completes the trip' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Trip completed' })
  async completeTrip(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTripDto,
  ): Promise<Order> {
    return this.ordersService.completeTrip(user.id, id, dto.deliveryPin);
  }

  // The dispatcher panel's "Yakunlash" used to call the driver-only route
  // above and always got 403. Separate route: a dispatcher completes for the
  // assigned driver (and, for a parcel, after speaking to the recipient).
  @Patch(':id/force-complete')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: "Dispatcher completes a ride on the driver's behalf (manager/admin)" })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Trip completed' })
  async forceComplete(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    return this.ordersService.completeByDispatcher(id);
  }

  @Patch(':id/reassign')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({
    summary:
      'Manually assign or reassign the driver on an order (manager/admin only) — an exception ' +
      'path now that MatchingService handles normal dispatch automatically; requires a reason ' +
      'and is recorded in the dispatch_overrides audit log',
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order reassigned' })
  @ApiResponse({ status: 400, description: 'Order not in a reassignable state, or driver not online' })
  async reassignDriver(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignDriverDto,
  ): Promise<Order> {
    return this.ordersService.reassignDriver(id, dto.driverId, user.id, dto.reason);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order (passenger, driver, or manager)' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 403, description: 'Not authorized to cancel this order' })
  async cancelOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<Order> {
    return this.ordersService.cancelOrder(user.id, user.role, id, dto.reason);
  }
}
