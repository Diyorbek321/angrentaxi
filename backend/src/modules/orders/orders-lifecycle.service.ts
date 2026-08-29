// Driver-driven forward transitions of a ride: accept -> arrived -> in
// progress. Each step validates the current status, applies the transition
// atomically (TOCTOU guard), and fans the result out to the passenger and the
// dispatcher board. Trip completion is heavy enough (settlement, promo,
// referral bonuses) that it lives in OrdersCompletionService instead.
import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { OrdersQueryService } from './orders-query.service';
import { OrderStatusTransitionService } from './order-status-transition.service';
import { waitingSettingsOf } from '../tariffs/waiting-charge';

@Injectable()
export class OrdersLifecycleService {
  private readonly logger = new Logger(OrdersLifecycleService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
    private readonly queryService: OrdersQueryService,
    private readonly statusTransition: OrderStatusTransitionService,
  ) {}

  async acceptOrder(driverId: string, orderId: string): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.SEARCHING) {
      throw new BadRequestException(
        `Cannot accept order with status ${order.status}`,
      );
    }

    if (order.driverId) {
      throw new BadRequestException('Order already has a driver');
    }

    await this.statusTransition.updateOrderStatusAtomic(orderId, OrderStatus.SEARCHING, {
      driverId,
      status: OrderStatus.ACCEPTED,
    });

    const updatedOrder = await this.queryService.findByIdOrThrow(orderId);

    // Notify passenger
    const passenger = await this.usersService.findById(order.passengerId);
    const driver = await this.driversService.findByUserId(driverId);

    if (passenger && driver) {
      // Emit via WebSocket
      this.realtimeGateway.emitToUser(order.passengerId, 'order:accepted', {
        orderId,
        driverId,
        driver: {
          id: driver.id,
          userId: driver.userId,
          carModel: driver.carModel,
          carNumber: driver.carNumber,
          rating: driver.rating,
        },
      });

      // Send push notification
      await this.notificationsService.notifyOrderAccepted(passenger, driver, updatedOrder);
    }

    this.realtimeGateway.emitToManagers('order:updated', updatedOrder);
    if (driver) {
      this.realtimeGateway.emitToManagers('driver:status_changed', {
        driverId: driver.id,
        status: 'busy',
      });
    }

    return updatedOrder;
  }

  async driverArrived(driverId: string, orderId: string): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.ACCEPTED) {
      throw new BadRequestException(
        `Cannot mark arrived for order with status ${order.status}`,
      );
    }

    if (order.driverId !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }

    // Geofence check — driver must be within 500m of pickup
    const geofenceCheck = await this.orderRepository.query(
      `SELECT ST_Distance(
        ST_SetSRID(
          (SELECT current_location::geometry FROM drivers WHERE user_id = $1),
          4326
        )::geography,
        (SELECT pickup_location::geometry FROM orders WHERE id = $2)::geography
      ) as distance_meters`,
      [driverId, orderId],
    );

    // NOTE: was `?? '9999'` written as `|| '9999'` — pg returns ST_Distance's
    // result as a JS number, and a driver standing exactly on the pickup point
    // (distance 0) is falsy, so `||` incorrectly fell back to the 9999m sentinel
    // and rejected a driver who was precisely at the pickup location.
    const rawDistance = (geofenceCheck as Array<{ distance_meters: number | string | null }>)[0]
      ?.distance_meters;
    const distanceMeters = rawDistance != null ? parseFloat(String(rawDistance)) : 9999;

    if (distanceMeters > 500) {
      this.logger.warn(
        `Driver ${driverId} is ${distanceMeters.toFixed(0)}m away from pickup, rejecting arrived status`,
      );
      throw new BadRequestException(
        `You must be within 500m of the pickup location (currently ${distanceMeters.toFixed(0)}m away)`,
      );
    }

    // ⚠️ KUTISH HISOBI SHU YERDA BOSHLANADI. `arrived_at` — pul undiriladigan
    // maydon (`orders-completion.service.ts` uni safar boshlanishigacha
    // bo'lgan kutish haqiga aylantiradi), shuning uchun uni yozish
    // qoidalari status o'zgarishidan qat'iyroq.
    //
    // ⚠️ IDEMPOTENT — `COALESCE("arrived_at", :arrivedAt)`: qiymat FAQAT
    // bo'sh bo'lganda yoziladi. Aks holda haydovchi "Yetib keldim" tugmasini
    // qayta bosib kutish hisobini nolga tushira olardi, ya'ni yo'lovchi
    // qancha kutdirgani ahamiyatsiz bo'lib qolardi. Status qo'riqchisi
    // (`status IN ('accepted')`) ham takroriy chaqiruvni to'sadi; COALESCE
    // esa qoidani MA'LUMOTLAR BAZASI darajasida saqlaydi va kelajakda status
    // sharti yumshatilsa ham buzilmaydi.
    //
    // Vaqt JS'dan olinadi, SQL `NOW()` dan emas: kutish daqiqalari shu
    // maydon bilan `trips.start_time` orasidagi FARQ, va u ham JS `Date`
    // sifatida yoziladi. Ikkalasi bitta soatdan chiqishi shart — aks holda
    // baza va Node vaqt mintaqasi farq qilganda kutish soatlab noto'g'ri
    // hisoblanardi.
    const arrivedAt = new Date();

    await this.statusTransition.updateOrderStatusAtomic(
      orderId,
      OrderStatus.ACCEPTED,
      {
        status: OrderStatus.ARRIVED,
        arrivedAt: () => 'COALESCE("arrived_at", :arrivedAt)',
      },
      { arrivedAt },
    );

    const updatedOrder = await this.queryService.findByIdOrThrow(orderId);
    const waiting = waitingSettingsOf(updatedOrder.tariff ?? {});

    // Notify passenger
    const passenger = await this.usersService.findById(order.passengerId);

    if (passenger) {
      // ⚠️ PAKETDA KUTISH SHARTNOMASI TO'LIQ UZATILADI. Yo'lovchi ilovasi
      // hisoblagichni O'Z soatidan emas, shu uch maydondan yuritadi —
      // aks holda haydovchi va yo'lovchi har xil raqam ko'radi va bu aynan
      // tuzatilayotgan nuqson edi. `arrivedAt` serverdan kelgani uchun
      // ilova qayta ishga tushsa ham hisob nolga qaytmaydi.
      this.realtimeGateway.emitToUser(order.passengerId, 'order:arrived', {
        orderId,
        arrivedAt: updatedOrder.arrivedAt,
        freeWaitMinutes: waiting.freeWaitMinutes,
        waitingPricePerMinute: waiting.waitingPricePerMinute,
        message: 'Your driver has arrived',
      });

      await this.notificationsService.notifyDriverArrived(passenger, updatedOrder);
    }

    this.realtimeGateway.emitToManagers('order:updated', updatedOrder);

    return updatedOrder;
  }

  async startTrip(driverId: string, orderId: string): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.ARRIVED) {
      throw new BadRequestException(
        `Cannot start trip for order with status ${order.status}`,
      );
    }

    if (order.driverId !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }

    await this.statusTransition.updateOrderStatusAtomic(orderId, OrderStatus.ARRIVED, {
      status: OrderStatus.IN_PROGRESS,
    });

    // Create Trip record
    await this.tripRepository.save({
      orderId,
      startTime: new Date(),
      endTime: null,
      actualDistanceKm: null,
      actualDurationMin: null,
    });

    const updatedOrder = await this.queryService.findByIdOrThrow(orderId);

    // Notify passenger
    this.realtimeGateway.emitToUser(order.passengerId, 'order:in_progress', {
      orderId,
      message: 'Trip started',
    });

    this.realtimeGateway.emitToManagers('order:updated', updatedOrder);

    return updatedOrder;
  }
}
