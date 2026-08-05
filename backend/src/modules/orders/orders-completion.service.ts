// Trip completion and everything money-related that hangs off it: final fare
// from actual distance/duration, promo re-validation and consumption, the
// commission split, the passenger charge and the two-legged driver payout
// ledger entries, wallet adjustment, bonus evaluation, and the first-trip
// referral bonus. Separated from OrdersLifecycleService because this single
// transition carries far more business rules than all the others combined.
import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { DriverBonusesService } from '../driver-bonuses/driver-bonuses.service';
import { SettingsService } from '../settings/settings.service';
import { OrdersQueryService } from './orders-query.service';

// Flat bonus (in so'm) credited to both a referred passenger and their
// referrer the first time the referred passenger completes a trip. See the
// referral-bonus block at the end of completeTrip, and
// ReferralsService.getMyReferralInfo which sums these by externalId prefix.
const REFERRAL_BONUS_AMOUNT = 5000;

@Injectable()
export class OrdersCompletionService {
  private readonly logger = new Logger(OrdersCompletionService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly tariffsService: TariffsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
    private readonly promoCodesService: PromoCodesService,
    private readonly driverBonusesService: DriverBonusesService,
    private readonly settingsService: SettingsService,
    private readonly queryService: OrdersQueryService,
    private readonly dataSource: DataSource,
  ) {}

  async completeTrip(driverId: string, orderId: string): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete order with status ${order.status}`,
      );
    }

    if (order.driverId !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }

    // Get trip record
    const trip = await this.tripRepository.findOne({ where: { orderId } });

    const now = new Date();
    let actualDurationMin = 0;
    let actualDistanceKm = 0;

    if (trip?.startTime) {
      actualDurationMin = Math.ceil(
        (now.getTime() - trip.startTime.getTime()) / (1000 * 60),
      );
    }

    // Compute actual distance using PostGIS straight-line distance as fallback
    const distResult = await this.orderRepository.query(
      `SELECT ST_Distance(pickup_location::geography, dropoff_location::geography) as distance_meters FROM orders WHERE id = $1`,
      [orderId],
    );

    actualDistanceKm =
      parseFloat((distResult as Array<{ distance_meters: string }>)[0]?.distance_meters || '0') /
      1000;

    // Compute final price
    const tariff = await this.tariffsService.findById(order.tariffId);
    const finalPrice = this.tariffsService.calculatePrice(
      tariff,
      actualDistanceKm,
      actualDurationMin,
    );

    // Update trip
    if (trip) {
      await this.tripRepository.update(trip.id, {
        endTime: now,
        actualDistanceKm,
        actualDurationMin,
      });
    }

    // Re-apply the promo discount against the final amount (may differ from the
    // original estimate since it's recomputed from actual distance/duration), and
    // only now record actual usage — a cancelled trip never consumed the promo.
    let finalDiscountAmount = 0;
    if (order.promoCodeId) {
      try {
        const promoCode = await this.promoCodesService.findById(order.promoCodeId);
        const promoResult = await this.promoCodesService.validate(
          promoCode.code,
          order.passengerId,
          finalPrice,
        );
        finalDiscountAmount = promoResult.discountAmount;
        await this.promoCodesService.apply(order.promoCodeId, order.passengerId, orderId);
      } catch (err) {
        // Promo became invalid between order creation and completion (expired,
        // limit hit by a concurrent order) — degrade gracefully to full price
        // rather than failing trip completion.
        this.logger.warn(
          `Promo code re-validation failed at completion for order ${orderId}, charging full price: ${err}`,
        );
      }
    }
    const discountedFinalPrice = Math.max(0, finalPrice - finalDiscountAmount);

    // Commission: driver's own override rate if set, else the platform default.
    const payoutDriver = order.driverId
      ? await this.driversService.findByUserId(order.driverId)
      : null;
    const commissionRate =
      payoutDriver?.commissionRate ?? (await this.settingsService.getDefaultCommissionRate());
    const commissionAmount = Math.round((discountedFinalPrice * commissionRate) / 100);
    const netDriverEarning = discountedFinalPrice - commissionAmount;

    // Settlement — the order status, the passenger charge, both driver payout
    // legs and the wallet movement all describe the same money event, so they
    // commit or roll back together. Previously these were five independent
    // writes: a failure partway through left a trip marked COMPLETED with only
    // some of its ledger rows, or a wallet balance with nothing backing it.
    //
    // Deliberately outside this transaction: Redis (not transactional — applied
    // after commit below), the realtime/notification fan-out, bonus evaluation
    // and the referral bonus, which are all best-effort by design.
    let wentOffline = false;
    let payoutDriverId: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, orderId, {
        status: OrderStatus.COMPLETED,
        finalPrice: discountedFinalPrice,
        discountAmount: finalDiscountAmount || null,
        driverEarning: netDriverEarning,
      });

      // Passenger charge.
      await manager.save(Transaction, {
        userId: order.passengerId,
        orderId,
        amount: discountedFinalPrice,
        type: TransactionType.DEBIT,
        paymentMethod: order.paymentMethod,
        status: order.paymentMethod === PaymentMethod.CASH
          ? TransactionStatus.COMPLETED
          : TransactionStatus.PENDING,
        externalId: null,
      });

      // Driver payout: gross CREDIT for the fare, then a DEBIT for the
      // platform's commission share — the ledger records both legs rather than
      // only the net.
      if (order.driverId && payoutDriver) {
        await manager.save(Transaction, {
          userId: order.driverId,
          orderId,
          amount: discountedFinalPrice,
          type: TransactionType.CREDIT,
          paymentMethod: order.paymentMethod,
          status: TransactionStatus.COMPLETED,
          externalId: null,
        });

        if (commissionAmount > 0) {
          await manager.save(Transaction, {
            userId: order.driverId,
            orderId,
            amount: commissionAmount,
            type: TransactionType.DEBIT,
            paymentMethod: order.paymentMethod,
            status: TransactionStatus.COMPLETED,
            externalId: 'commission',
          });
        }

        // For a CASH trip the driver already pocketed the fare directly from
        // the passenger — the app never held that money, so only the commission
        // owed to the platform hits the wallet (balance trends negative over
        // time, which is the point: it's what the driver must eventually top
        // up). For CARD/WALLET trips the platform holds the funds, so the
        // wallet is credited the net payout the platform still owes.
        const balanceDelta =
          order.paymentMethod === PaymentMethod.CASH ? -commissionAmount : netDriverEarning;
        const adjustment = await this.driversService.adjustBalanceWithin(
          manager,
          order.driverId,
          balanceDelta,
        );

        wentOffline = adjustment.wentOffline;
        payoutDriverId = adjustment.driverId;
      }
    });

    // Redis is not part of the transaction, so the driver is only dropped from
    // the online set once the negative balance is actually durable.
    if (wentOffline && payoutDriverId) {
      await this.driversService.takeOfflineInRedis(
        payoutDriverId,
        'balance went negative after settlement',
      );
    }

    if (order.driverId && payoutDriver) {
      // Best-effort — a bonus-evaluation failure must never block trip completion.
      this.driverBonusesService.evaluateForDriver(order.driverId).catch((err) => {
        this.logger.error(`Bonus evaluation failed for driver ${order.driverId}: ${err}`);
      });
    }

    const updatedOrder = await this.queryService.findByIdOrThrow(orderId);

    // Notify passenger
    const passenger = await this.usersService.findById(order.passengerId);

    if (passenger) {
      this.realtimeGateway.emitToUser(order.passengerId, 'order:completed', {
        orderId,
        finalPrice: discountedFinalPrice,
        actualDistanceKm,
        actualDurationMin,
      });

      await this.notificationsService.notifyTripCompleted(passenger, discountedFinalPrice, updatedOrder);
    }

    this.realtimeGateway.emitToManagers('order:completed', updatedOrder);

    // Re-fetch: adjustBalance may have just flipped isOnline to false if the
    // commission deduction pushed the driver negative.
    const finishedDriver = await this.driversService.findByUserId(driverId);
    if (finishedDriver) {
      if (finishedDriver.isOnline) {
        this.realtimeGateway.emitToManagers('driver:status_changed', {
          driverId: finishedDriver.id,
          status: 'online',
        });
      } else {
        this.realtimeGateway.emitToManagers('driver:offline', { driverId: finishedDriver.id });
      }
    }

    // Referral bonus: if this passenger was referred by another user and this
    // is their first-ever completed trip, credit both the passenger and their
    // referrer a fixed bonus. Best-effort — a bonus-crediting bug must never
    // break trip completion, which is the actually critical operation here.
    try {
      if (passenger?.referredByUserId) {
        const completedOrdersCount = await this.orderRepository.count({
          where: { passengerId: order.passengerId, status: OrderStatus.COMPLETED },
        });

        if (completedOrdersCount === 1) {
          await this.transactionRepository.save({
            userId: order.passengerId,
            orderId,
            amount: REFERRAL_BONUS_AMOUNT,
            type: TransactionType.CREDIT,
            paymentMethod: PaymentMethod.WALLET,
            status: TransactionStatus.COMPLETED,
            externalId: `referral_bonus_passenger_${order.id}`,
          });

          await this.transactionRepository.save({
            userId: passenger.referredByUserId,
            orderId,
            amount: REFERRAL_BONUS_AMOUNT,
            type: TransactionType.CREDIT,
            paymentMethod: PaymentMethod.WALLET,
            status: TransactionStatus.COMPLETED,
            externalId: `referral_bonus_referrer_${order.id}`,
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Referral bonus crediting failed for order ${orderId}: ${err}`);
    }

    this.logger.log(
      `Order ${orderId} completed. Distance: ${actualDistanceKm.toFixed(2)}km, Price: ${discountedFinalPrice} UZS`,
    );

    return updatedOrder;
  }
}
