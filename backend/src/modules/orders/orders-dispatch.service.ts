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
  Optional,
} from '@nestjs/common';
import { DeliveryEventsService } from '../delivery/delivery-events.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  DRIVER_ACTIVE_ORDER_STATUSES,
  NO_SHOW_CANCEL_REASON,
  Order,
  OrderCancelledBy,
  OrderStatus,
} from '../../database/entities/order.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { UserRole } from '../../database/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { OrdersQueryService } from './orders-query.service';
import { OrderStatusTransitionService } from './order-status-transition.service';
import { MatchingService } from '../matching/matching.service';
import { ERROR_CODES, codedBadRequest, codedConflict } from '../../common/errors/coded-error';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_SAFETY_POLICY_SETTINGS } from '../settings/safety-policy-settings';
import { AuditLogService } from '../audit/audit-log.service';
import { IncidentSignalsService } from '../incidents/incident-signals.service';
import {
  CancelFeeQuote,
  checkNoShow,
  penaltiesApply,
  quoteCancelFee,
  TaxiPenaltySettings,
} from './taxi-cancel-policy';
import { chargeTaxiFee, TaxiFeeKind } from './taxi-fee-ledger';

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
    // Optional only so unit tests that build this service by hand keep
    // compiling; DeliveryEventsModule is global, so the app always has it.
    @Optional() private readonly deliveryEvents?: DeliveryEventsService,
    // Qidiruvdagi buyurtma bekor/qo'lda biriktirilganda matching navbatini
    // yopish uchun. Ilovada har doim bor (OrdersModule → MatchingModule).
    @Optional() private readonly matching?: MatchingService,
    // Taksi jarimalari (INCIDENT-POLICY §5). Ixtiyoriy — qo'lda yig'iladigan
    // spec'lar uchun (u holda standart sozlamalar, jarima audit'siz yozilmaydi).
    @Optional() private readonly settingsService?: SettingsService,
    @Optional() private readonly auditLog?: AuditLogService,
    @Optional() private readonly incidentSignals?: IncidentSignalsService,
  ) {}

  /** Statuses in which MatchingService may still be offering the order. */
  private static isInSearch(status: OrderStatus): boolean {
    return status === OrderStatus.CREATED || status === OrderStatus.SEARCHING;
  }

  /** Never lets a matching hiccup fail a cancel/assignment that already committed. */
  private async closeSearch(orderId: string, reason?: string, exceptDriverId?: string): Promise<void> {
    if (!this.matching) return;
    try {
      await (exceptDriverId === undefined
        ? this.matching.cancelSearch(orderId, reason)
        : this.matching.cancelSearch(orderId, reason, exceptDriverId));
    } catch (err) {
      this.logger.warn(`Could not close matching search for ${orderId}: ${(err as Error).message}`);
    }
  }

  /**
   * Shaharlararo bandlar faqat `/intercity/...` yo'llari orqali bekor
   * qilinadi (yo'lovchi: `bookings/:id/cancel`, haydovchi: `no-show` yoki
   * qatnovni bekor qilish, dispetcher: `bookings/:id/cancel/manage`).
   */
  private static assertNotIntercity(order: Pick<Order, 'intercityTripId'>): void {
    if (order.intercityTripId) {
      throw codedBadRequest(
        ERROR_CODES.intercityUseIntercityEndpoint,
        "Shaharlararo band faqat «Shaharlararo» bo'limi orqali bekor qilinadi yoki o'zgartiriladi",
      );
    }
  }

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
    // Shaharlararo band qatnov egasiga bog'langan — boshqa haydovchiga
    // berilsa qatnov va band ajralib qoladi.
    OrdersDispatchService.assertNotIntercity(order);

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
      // Qo'lda biriktirish ataylab taklif darvozasini chetlab o'tadi, lekin
      // band haydovchiga IKKINCHI safarni bermaydi. Qulf kaliti
      // `acceptForDriver` niki bilan bir xil — bir vaqtdagi qabul va
      // biriktirish bitta haydovchi uchun navbatma-navbat bajariladi.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `order-accept:${newDriver.userId}`,
      ]);
      const active = await manager.count(Order, {
        where: { driverId: newDriver.userId, status: In([...DRIVER_ACTIVE_ORDER_STATUSES]) },
      });
      if (active > 0) {
        throw new ConflictException('Selected driver already has an active order');
      }

      const result = await manager
        .createQueryBuilder()
        .update(Order)
        // ⚠️ `arrivedAt` NOLLANADI. Yangi haydovchi hali yo'lda, ya'ni kutish
        // oynasi hali boshlanmagan. Tozalanmasa, oldingi haydovchi ARRIVED
        // bosgan buyurtmada eski vaqt qolib ketardi va yo'lovchi ALMASHTIRISH
        // jarayonida o'tgan butun vaqt uchun kutish haqi to'lardi — o'zi
        // sabab bo'lmagan kechikish uchun.
        .set({
          driverId: newDriver.userId,
          status: OrderStatus.ACCEPTED,
          arrivedAt: null,
          // Bepul bekor qilish oynasi YANGI haydovchidan boshlanadi — yo'lovchi
          // almashtirish uchun jarima to'lamasin (INCIDENT-POLICY §5).
          acceptedAt: new Date(),
        })
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

    // Matching hali shu buyurtmani boshqa haydovchiga taklif qilayotgan
    // bo'lishi mumkin — taklif yopiladi (yangi haydovchiga "bekor" bormaydi).
    if (OrdersDispatchService.isInSearch(order.status)) {
      await this.closeSearch(orderId, 'Assigned by dispatcher', newDriver.userId);
    }

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

    // Kuryer safari: oldingi kuryer sotuvchiga hamyondan to'lagan bo'lsa,
    // o'tkazmasi teskari qilinadi (VendorCashService, §19).
    if (previousDriverId) {
      await this.deliveryEvents?.publish(updatedOrder, 'reassigned', {
        previousCourierUserId: previousDriverId,
      });
    }

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

  /**
   * Yo'lovchi HOZIR bekor qilsa qancha jarima (INCIDENT-POLICY §5) — ilova
   * tasdiqlashdan OLDIN ko'rsatadi. Faqat buyurtma egasi so'raydi.
   */
  async quoteCancelFee(userId: string, userRole: UserRole, orderId: string, now: Date = new Date()): Promise<CancelFeeQuote> {
    const order = await this.queryService.findByIdOrThrow(orderId);
    if (userRole === UserRole.DRIVER || order.passengerId !== userId) {
      throw new ForbiddenException('You are not authorized to cancel this order');
    }
    return quoteCancelFee(order, await this.penaltySettings(), now);
  }

  async cancelOrder(
    userId: string,
    userRole: UserRole,
    orderId: string,
    reason?: string,
    // `expectedFee` — ilova ko'rsatgan jarima; server hisobi undan katta
    // bo'lsa 409 (qayta tasdiqlash). `legacyClient` — narxni ko'rsatmaydigan
    // eski APK: unga jarima QO'LLANMAYDI (ogohlantirilmagan odamdan pul
    // yechilmasin), jurnalda qoladi.
    options: { expectedFee?: number; legacyClient?: boolean } = {},
  ): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);
    // Bu yo'l o'rindiq hisobini (seats_taken) va kech bekor qilish/kelmaslik
    // belgilarini bilmaydi — qatnovda "arvoh" band joy qolardi.
    OrdersDispatchService.assertNotIntercity(order);

    const cancellableStatuses: OrderStatus[] = [
      // Rejalashtirilgan safar bajarilishidan OLDIN bekor qilinishi kerak —
      // aynan shu narsa uni rejaga aylantiradi. Haydovchi hali biriktirilmagan,
      // shuning uchun bekor qilish hech kimga zarar keltirmaydi.
      OrderStatus.SCHEDULED,
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
    // Buyurtma egasi — rolidan qat'i nazar (menejer/do'kon egasi ham yo'lovchi
    // bo'lib taksi chaqiradi, `PASSENGER_APP_ROLES`). Haydovchi o'z nomidan
    // buyurtma bera olmaydi, shuning uchun bu shart uni qamramaydi.
    const isPassenger = userRole !== UserRole.DRIVER && order.passengerId === userId;
    const isDriver = userRole === UserRole.DRIVER && order.driverId === userId;
    const isManagerOrAdmin =
      userRole === UserRole.MANAGER || userRole === UserRole.ADMIN;

    if (!isPassenger && !isDriver && !isManagerOrAdmin) {
      throw new ForbiddenException('You are not authorized to cancel this order');
    }

    const now = new Date();
    const fee = isPassenger ? await this.passengerCancelFee(order, now, options) : 0;

    await this.commitCancellation(order, cancellableStatuses, {
      reason: reason ?? null,
      cancelledBy: isDriver ? 'driver' : isPassenger ? 'passenger' : 'manager',
      now,
      fee,
      actorUserId: userId,
      feeKind: 'late_cancel',
    });

    const updatedOrder = await this.announceCancelled(order, userId, userRole, reason);

    // Haydovchi qabul qilgan buyurtmani bekor qildi — pul yo'q, signal bor (§5).
    if (isDriver && (order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.ARRIVED)) {
      try {
        await this.incidentSignals?.onDriverCancelled(userId, now);
      } catch (err) {
        this.logger.warn(`Driver cancel signal failed for ${userId}: ${(err as Error).message}`);
      }
    }

    return updatedOrder;
  }

  /**
   * Haydovchi: "Yo'lovchi chiqmadi" (INCIDENT-POLICY §5). Server vaqti
   * bo'yicha: yetib kelgandan `noShowWaitMinutes` o'tgach. Buyurtma
   * bekor (haydovchi, `no_show`), `noShowFee` to'liq haydovchiga.
   */
  async markNoShow(driverUserId: string, orderId: string): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);
    OrdersDispatchService.assertNotIntercity(order);
    if (order.driverId !== driverUserId) {
      throw new ForbiddenException('You are not authorized to cancel this order');
    }
    const now = new Date();
    const check = checkNoShow(order, await this.penaltySettings(), now);
    if (!check.allowed) {
      throw codedBadRequest(
        ERROR_CODES.noShowNotAllowed,
        check.reason === 'too_early'
          ? "Yo'lovchini yana biroz kuting — kelmaganini keyinroq belgilash mumkin"
          : check.reason === 'not_taxi'
            ? "Bu buyurtmada «yo'lovchi chiqmadi» belgilanmaydi"
            : 'Avval manzilga yetib kelganingizni belgilang',
        { details: { reason: check.reason, waitUntil: check.waitUntil } },
      );
    }

    await this.commitCancellation(order, [OrderStatus.ARRIVED], {
      reason: NO_SHOW_CANCEL_REASON,
      cancelledBy: 'driver',
      now,
      fee: check.fee,
      actorUserId: driverUserId,
      feeKind: 'no_show',
    });
    this.logger.log(`Order ${orderId}: passenger no-show marked by driver ${driverUserId}, fee ${check.fee}`);
    return this.announceCancelled(order, driverUserId, UserRole.DRIVER, NO_SHOW_CANCEL_REASON);
  }

  private async penaltySettings(): Promise<TaxiPenaltySettings> {
    return this.settingsService ? this.settingsService.getSafetyPolicySettings() : DEFAULT_SAFETY_POLICY_SETTINGS;
  }

  private async passengerCancelFee(
    order: Order,
    now: Date,
    options: { expectedFee?: number; legacyClient?: boolean },
  ): Promise<number> {
    // Jarima bo'lishi mumkin bo'lmagan holatda sozlama o'qilmaydi.
    const mayCharge =
      !!order.driverId &&
      penaltiesApply(order) &&
      (order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.ARRIVED);
    if (!mayCharge) return 0;
    const quote = quoteCancelFee(order, await this.penaltySettings(), now);
    if (quote.fee <= 0) return 0;
    if (options.expectedFee === undefined && options.legacyClient) {
      this.logger.warn(
        `Order ${order.id}: late-cancel fee ${quote.fee} waived — client does not show the fee (old app)`,
      );
      return 0;
    }
    if ((options.expectedFee ?? 0) < quote.fee) {
      throw codedConflict(
        ERROR_CODES.cancelFeeChanged,
        `Bekor qilish endi ${quote.fee} so'm turadi. Qayta tasdiqlang`,
        { details: { fee: quote.fee, reason: quote.reason } },
      );
    }
    return quote.fee;
  }

  /**
   * Holat + (bo'lsa) jarima BITTA tranzaksiyada: shartli UPDATE qatorni
   * qulflaydi, parallel bekor qilish/qabul 0 qator ko'radi va pul yozilmaydi.
   */
  private async commitCancellation(
    order: Order,
    expectedStatuses: OrderStatus[],
    input: {
      reason: string | null;
      cancelledBy: OrderCancelledBy;
      now: Date;
      fee: number;
      actorUserId: string;
      feeKind: TaxiFeeKind;
    },
  ): Promise<void> {
    const update = {
      status: OrderStatus.CANCELLED,
      cancelReason: input.reason,
      cancelledBy: input.cancelledBy,
      cancelledAt: input.now,
    };
    if (input.fee <= 0 || !order.driverId || !this.auditLog) {
      await this.statusTransition.updateOrderStatusAtomic(order.id, expectedStatuses, update);
      return;
    }
    const auditLog = this.auditLog;
    const driverUserId = order.driverId;
    // Haydovchiga faqat CREDIT — daftar manfiyga tushmaydi, oflayn qilish yo'q.
    await this.dispatchOverrideRepository.manager.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Order)
        .set(update)
        .where('id = :id', { id: order.id })
        .andWhere('status IN (:...expectedStatuses)', { expectedStatuses })
        .execute();
      if (!result.affected) throw new ConflictException('Order is no longer in the expected state');
      await chargeTaxiFee(manager, auditLog, {
        orderId: order.id,
        passengerId: order.passengerId,
        driverUserId,
        fee: input.fee,
        kind: input.feeKind,
        actorUserId: input.actorUserId,
      });
    });
  }

  /** Bekor qilingandan keyingi xabarlar — tomonlarga, dispetcherga, sotuvchiga. */
  private async announceCancelled(
    order: Order,
    userId: string,
    userRole: UserRole,
    reason: string | undefined,
  ): Promise<Order> {
    const orderId = order.id;
    const updatedOrder = await this.queryService.findByIdOrThrow(orderId);
    // ⚠️ Haydovchi YANGI o'qilgan qatordan. `order` qidiruv paytida o'qilgan
    // bo'lsa (driverId = null), shu orada haydovchi qabul qilib ulgurgan
    // bo'lishi mumkin — atomik bekor qilish ACCEPTED ni ham qabul qiladi.
    // Eski qiymat bilan o'sha haydovchiga "bekor" xabari bormas va u o'lik
    // safarda qolib ketardi.
    const assignedDriverId = updatedOrder.driverId ?? order.driverId;

    // ⚠️ Qidiruv paytida `order.driverId` hali null — taklifni ko'rib turgan
    // haydovchini faqat matching navbati biladi. Ilgari unga hech narsa
    // bormasdi: taklif ekranida qolib, "qabul" bosganda xato olardi.
    if (OrdersDispatchService.isInSearch(order.status)) {
      await this.closeSearch(orderId, reason);
    }

    const fee = updatedOrder.cancellationFee ?? null;

    // Notify both parties
    if (order.passengerId !== userId) {
      const passenger = await this.usersService.findById(order.passengerId);
      if (passenger) {
        this.realtimeGateway.emitToUser(order.passengerId, 'order:cancelled', {
          orderId,
          reason,
          cancelledBy: userRole,
          ...(fee ? { cancellationFee: fee } : {}),
        });
        await this.notificationsService.notifyOrderCancelled(passenger, updatedOrder, reason);
      }
    }

    if (assignedDriverId && assignedDriverId !== userId) {
      const driver = await this.usersService.findById(assignedDriverId);
      if (driver) {
        this.realtimeGateway.emitToUser(assignedDriverId, 'order:cancelled', {
          orderId,
          reason,
          cancelledBy: userRole,
          ...(fee ? { cancellationFee: fee } : {}),
        });
        await this.notificationsService.notifyOrderCancelled(driver, updatedOrder, reason);
      }
    }

    this.realtimeGateway.emitToManagers('order:cancelled', updatedOrder);
    // Food/market: the vendor needs a new courier.
    await this.deliveryEvents?.publish(updatedOrder, 'cancelled');

    if (assignedDriverId) {
      const freedDriver = await this.driversService.findByUserId(assignedDriverId);
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
