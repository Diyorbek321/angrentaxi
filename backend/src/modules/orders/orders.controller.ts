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
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReassignDriverDto } from './dto/reassign-driver.dto';
import { PaginationDto } from './dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Order } from '../../database/entities/order.entity';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly matchingService: MatchingService,
  ) {}

  @Post('calculate-price')
  @ApiOperation({ summary: 'Calculate estimated trip price' })
  @ApiResponse({ status: 200, description: 'Price estimate' })
  async calculatePrice(@Body() dto: CalculatePriceDto) {
    return this.ordersService.calculatePrice(dto);
  }

  @Post()
  @Roles(UserRole.PASSENGER)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createOrder(
    @CurrentUser() user: User,
    @Body() dto: CreateOrderDto,
  ): Promise<Order> {
    const order = await this.ordersService.create(user.id, dto);

    // Start matching asynchronously
    this.matchingService.startSearch(order.id).catch((err: unknown) => {
      this.logger.error(`Matching failed for order ${order.id}:`, (err as Error).message);
    });

    return order;
  }

  @Post('dispatch')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an order on behalf of a passenger (manager/admin only)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createDispatchOrder(@Body() dto: CreateDispatchOrderDto): Promise<Order> {
    const order = await this.ordersService.createForDispatch(dto);

    this.matchingService.startSearch(order.id).catch((err: unknown) => {
      this.logger.error(`Matching failed for order ${order.id}:`, (err as Error).message);
    });

    return order;
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List all orders (admin/manager only)' })
  async listAll(
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
  ) {
    return this.ordersService.getAllOrders(pagination.page ?? 1, pagination.limit ?? 20, status);
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
  @ApiOperation({ summary: 'Get all active orders (manager/admin)' })
  @ApiResponse({ status: 200, description: 'List of active orders' })
  async getActiveOrders(): Promise<Order[]> {
    return this.ordersService.getActiveOrders();
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

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    return this.ordersService.findByIdOrThrow(id);
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
  ): Promise<Order> {
    return this.ordersService.completeTrip(user.id, id);
  }

  @Patch(':id/reassign')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign or reassign the driver on an order (manager/admin only)' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order reassigned' })
  @ApiResponse({ status: 400, description: 'Order not in a reassignable state, or driver not online' })
  async reassignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignDriverDto,
  ): Promise<Order> {
    return this.ordersService.reassignDriver(id, dto.driverId);
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
