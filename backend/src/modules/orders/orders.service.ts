// Public entry point of the orders module. The implementation lives in the
// focused services below (creation, driver lifecycle, completion/settlement,
// dispatcher overrides, reads, earnings, stats); this class is a thin facade
// that preserves the single injectable surface every other module already
// depends on (controller, matching, realtime, safety, trip-chat, food,
// market...) so splitting the implementation stayed a no-op for callers.
import { Injectable } from '@nestjs/common';
import { Order } from '../../database/entities/order.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { OrdersCreationService } from './orders-creation.service';
import { OrdersLifecycleService } from './orders-lifecycle.service';
import { OrdersCompletionService } from './orders-completion.service';
import { OrdersDispatchService } from './orders-dispatch.service';
import { OrdersQueryService } from './orders-query.service';
import { OrdersEarningsService } from './orders-earnings.service';
import { OrdersStatsService } from './orders-stats.service';
import { DriverEarningsBreakdown, PaginatedOrders } from './orders.types';

// Re-exported so existing `import { PaginatedOrders } from './orders.service'`
// call sites keep compiling.
export { PaginatedOrders, DriverEarningsPeriod, DriverEarningsBreakdown } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(
    private readonly creationService: OrdersCreationService,
    private readonly lifecycleService: OrdersLifecycleService,
    private readonly completionService: OrdersCompletionService,
    private readonly dispatchService: OrdersDispatchService,
    private readonly queryService: OrdersQueryService,
    private readonly earningsService: OrdersEarningsService,
    private readonly statsService: OrdersStatsService,
  ) {}

  // --- Creation & pricing ---

  calculatePrice(
    dto: CalculatePriceDto,
  ): Promise<{ price: number; tariffId: string; distanceKm: number; durationMin: number }> {
    return this.creationService.calculatePrice(dto);
  }

  create(passengerId: string, dto: CreateOrderDto): Promise<Order> {
    return this.creationService.create(passengerId, dto);
  }

  createForDispatch(dto: CreateDispatchOrderDto): Promise<Order> {
    return this.creationService.createForDispatch(dto);
  }

  // --- Driver lifecycle ---

  acceptOrder(driverId: string, orderId: string): Promise<Order> {
    return this.lifecycleService.acceptOrder(driverId, orderId);
  }

  driverArrived(driverId: string, orderId: string): Promise<Order> {
    return this.lifecycleService.driverArrived(driverId, orderId);
  }

  startTrip(driverId: string, orderId: string): Promise<Order> {
    return this.lifecycleService.startTrip(driverId, orderId);
  }

  completeTrip(driverId: string, orderId: string): Promise<Order> {
    return this.completionService.completeTrip(driverId, orderId);
  }

  // --- Dispatcher overrides & cancellation ---

  reassignDriver(
    orderId: string,
    newDriverProfileId: string,
    performedByUserId: string,
    reason: string,
  ): Promise<Order> {
    return this.dispatchService.reassignDriver(
      orderId,
      newDriverProfileId,
      performedByUserId,
      reason,
    );
  }

  cancelOrder(
    userId: string,
    userRole: UserRole,
    orderId: string,
    reason?: string,
  ): Promise<Order> {
    return this.dispatchService.cancelOrder(userId, userRole, orderId, reason);
  }

  // --- Reads ---

  findByIdOrThrow(id: string): Promise<Order> {
    return this.queryService.findByIdOrThrow(id);
  }

  findByIdForUser(id: string, user: { id: string; role: UserRole }): Promise<Order> {
    return this.queryService.findByIdForUser(id, user);
  }

  getPassengerHistory(
    passengerId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedOrders> {
    return this.queryService.getPassengerHistory(passengerId, page, limit);
  }

  getDriverHistory(
    driverId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedOrders> {
    return this.queryService.getDriverHistory(driverId, page, limit);
  }

  getActiveOrders(): Promise<Order[]> {
    return this.queryService.getActiveOrders();
  }

  getAllOrders(
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<PaginatedOrders> {
    return this.queryService.getAllOrders(page, limit, status);
  }

  getNoDriversFoundExceptions(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedOrders> {
    return this.queryService.getNoDriversFoundExceptions(page, limit);
  }

  getDispatchOverrides(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ overrides: DispatchOverride[]; total: number; page: number; limit: number }> {
    return this.queryService.getDispatchOverrides(page, limit);
  }

  // --- Earnings & analytics ---

  getDriverEarningsToday(driverId: string): Promise<{ today: number }> {
    return this.earningsService.getDriverEarningsToday(driverId);
  }

  getDriverEarningsBreakdown(driverId: string): Promise<DriverEarningsBreakdown> {
    return this.earningsService.getDriverEarningsBreakdown(driverId);
  }

  getDashboardStats() {
    return this.statsService.getDashboardStats();
  }

  getReports(from: string, to: string) {
    return this.statsService.getReports(from, to);
  }
}
