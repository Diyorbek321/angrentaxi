// Exception-path transitions driven by a human (dispatcher/manager) or by the
// passenger: manual driver (re)assignment with its audit trail, and order
// cancellation with its role-based permission rules. Both walk an order
// *backwards or sideways* out of the automated matching flow, which is why
// they sit apart from the forward driver lifecycle.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { UserRole } from '../../database/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { OrdersQueryService } from './orders-query.service';
import { OrderStatusTransitionService } from './order-status-transition.service';

@Injectable()
export class OrdersDispatchService {
  private readonly logger = new Logger(OrdersDispatchService.name);

  constructor(
    @InjectRepository(DispatchOverride)
    private readonly dispatchOverrideRepository: Repository<DispatchOverride>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
    private readonly queryService: OrdersQueryService,
    private readonly statusTransition: OrderStatusTransitionService,
  ) {}

  // Manual driver assignment/reassignment — the exception path under the
  // automated-dispatch model (MatchingService handles the normal case with
  // zero human input, see MatchingService.startSearch). `performedByUserId`
  // and `reason` are required so every use of this override is attributable
  // and durably logged in dispatch_overrides, not just a REST access log
  // line.
  async reassignDriver(
    orderId: string,
    newDriverProfileId: string,
    performedByUserId: string,
    reason: string,
  ): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    const reassignableStatuses: OrderStatus[] = [
      OrderStatus.CREATED,
      OrderStatus.SEARCHING,
      OrderStatus.ACCEPTED,
      OrderStatus.ARRIVED,
    ];

    if (!reassignableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot assign a driver to order with status ${order.status}`,
      );
    }

    const newDriver = await this.driversService.findByIdOrThrow(newDriverProfileId);

    if (!newDriver.isOnline) {
      throw new BadRequestException('Selected driver is not online');
    }

    if (order.driverId === newDriver.userId) {
      throw new BadRequestException('Order is already assigned to this driver');
    }

    const previousDriverId = order.driverId;

    // The reassignment and its audit row commit together.
    //
    // These used to be two independent writes, so anything that failed after
    // the status update — the audit insert itself, a lost connection — left
    // the order silently moved to a new driver with no record of who did it,
    // while the dispatcher saw a 500 and assumed nothing had happened.
    //
    // The conditional update keeps its TOCTOU guard: it touches 0 rows and
    // throws ConflictException if another request already moved the order out
    // of a reassignable status, which rolls the transaction back so no audit
    // entry is written for an override that didn't happen.
    await this.dispatchOverrideRepository.manager.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Order)
        .set({ driverId: newDriver.userId, status: OrderStatus.ACCEPTED })
        .where('id = :id', { id: orderId })
        .andWhere('status IN (:...expectedStatuses)', {
          expectedStatuses: reassignableStatuses,
        })
        .execute();

      if (!result.affected) {
        throw new ConflictException('Order is no longer in the expected state');
      }

      await manager.save(DispatchOverride, {
        orderId,
        performedByUserId,
        previousDriverId,
        newDriverId: newDriver.userId,
        reason,
      });
    });

    const updatedOrder = await this.queryService.findByIdOrThrow(orderId);

    // The previous driver (if any) loses this order — reuse the cancellation
    // event so the driver app's existing handler dismisses it immediately.
    if (previousDriverId) {
      this.realtimeGateway.emitToUser(previousDriverId, 'order:cancelled', {
        orderId,
        reason: 'Reassigned to another driver',
        cancelledBy: UserRole.MANAGER,
      });
    }

    this.realtimeGateway.emitToUser(newDriver.userId, 'order:accepted', {
      orderId,
      driverId: newDriver.userId,
      driver: {
        id: newDriver.id,
        userId: newDriver.userId,
        carModel: newDriver.carModel,
        carNumber: newDriver.carNumber,
        rating: newDriver.rating,
      },
    });

    const passenger = await this.usersService.findById(order.passengerId);
    if (passenger) {
      this.realtimeGateway.emitToUser(order.passengerId, 'order:accepted', {
        orderId,
        driverId: newDriver.userId,
        driver: {
          id: newDriver.id,
          userId: newDriver.userId,
          carModel: newDriver.carModel,
          carNumber: newDriver.carNumber,
          rating: newDriver.rating,
        },
      });
      await this.notificationsService.notifyOrderAccepted(passenger, newDriver, updatedOrder);
    }

    this.realtimeGateway.emitToManagers('order:updated', updatedOrder);
    this.realtimeGateway.emitToManagers('driver:status_changed', {
      driverId: newDriver.id,
      status: 'busy',
    });

    if (previousDriverId) {
      const previousDriver = await this.driversService.findByUserId(previousDriverId);
      if (previousDriver) {
        this.realtimeGateway.emitToManagers('driver:status_changed', {
          driverId: previousDriver.id,
          status: 'online',
        });
      }
    }

    this.logger.log(
      `Order ${orderId} reassigned from driver ${previousDriverId ?? 'none'} to ${newDriver.userId}`,
    );

    return updatedOrder;
  }

  async cancelOrder(
    userId: string,
    userRole: UserRole,
    orderId: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.CREATED,
      OrderStatus.SEARCHING,
      OrderStatus.ACCEPTED,
      OrderStatus.ARRIVED,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}`,
      );
    }

    // Permission check: passenger can cancel their own, driver can cancel their assigned order
    const isPassenger = userRole === UserRole.PASSENGER && order.passengerId === userId;
    const isDriver = userRole === UserRole.DRIVER && order.driverId === userId;
    const isManagerOrAdmin =
      userRole === UserRole.MANAGER || userRole === UserRole.ADMIN;

    if (!isPassenger && !isDriver && !isManagerOrAdmin) {
      throw new ForbiddenException('You are not authorized to cancel this order');
    }

    await this.statusTransition.updateOrderStatusAtomic(orderId, cancellableStatuses, {
      status: OrderStatus.CANCELLED,
      cancelReason: reason ?? null,
    });

    const updatedOrder = await this.queryService.findByIdOrThrow(orderId);

    // Notify both parties
    if (order.passengerId !== userId) {
      const passenger = await this.usersService.findById(order.passengerId);
      if (passenger) {
        this.realtimeGateway.emitToUser(order.passengerId, 'order:cancelled', {
          orderId,
          reason,
          cancelledBy: userRole,
        });
        await this.notificationsService.notifyOrderCancelled(passenger, updatedOrder, reason);
      }
    }

    if (order.driverId && order.driverId !== userId) {
      const driver = await this.usersService.findById(order.driverId);
      if (driver) {
        this.realtimeGateway.emitToUser(order.driverId, 'order:cancelled', {
          orderId,
          reason,
          cancelledBy: userRole,
        });
        await this.notificationsService.notifyOrderCancelled(driver, updatedOrder, reason);
      }
    }

    this.realtimeGateway.emitToManagers('order:cancelled', updatedOrder);

    if (order.driverId) {
      const freedDriver = await this.driversService.findByUserId(order.driverId);
      if (freedDriver) {
        this.realtimeGateway.emitToManagers('driver:status_changed', {
          driverId: freedDriver.id,
          status: 'online',
        });
      }
    }

    return updatedOrder;
  }
}
