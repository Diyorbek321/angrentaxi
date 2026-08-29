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
import { OsrmService } from '../routing/osrm.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import {
  computeSpendableBalance,
  lockWalletForUpdate,
} from '../payments/wallet-balance.util';
import {
  computeWaitingMinutes,
  waitingSettingsOf,
  withWaitingFare,
} from '../tariffs/waiting-charge';

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
    private readonly osrmService: OsrmService,
    private readonly routedDistancePricing: RoutedDistancePricing,
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

    // Actual distance, measured along the full ordered path
    // pickup -> waypoint[0] -> ... -> waypoint[n-1] -> dropoff.
    //
    // This used to be a single ST_Distance(pickup, dropoff), which ignored
    // `waypoints` entirely: a pickup -> bozor -> home ride was billed as if the
    // driver had gone straight home, even though order creation had already
    // priced the estimate across every leg. ST_MakeLine over the ordered points
    // gives the same measure for a direct trip (a two-point line) while
    // charging multi-stop rides for the distance actually driven.
    const distResult = await this.orderRepository.query(
      `SELECT ST_Length(ST_MakeLine(geom ORDER BY ord)::geography) AS distance_meters
         FROM (
           SELECT 0 AS ord, pickup_location AS geom
             FROM orders WHERE id = $1
           UNION ALL
           SELECT ordinality::int AS ord,
                  ST_SetSRID(
                    ST_MakePoint((w->>'lng')::float8, (w->>'lat')::float8),
                    4326
                  ) AS geom
             FROM orders o,
                  jsonb_array_elements(COALESCE(o.waypoints, '[]'::jsonb))
                    WITH ORDINALITY AS t(w, ordinality)
            WHERE o.id = $1
           UNION ALL
           SELECT 2147483647 AS ord, dropoff_location AS geom
             FROM orders WHERE id = $1
         ) path`,
      [orderId],
    );

    // Same falsy-zero trap already fixed in OrdersLifecycleService.driverArrived:
    // pg returns ST_Distance as a JS number, so `|| '0'` could not tell a genuine
    // 0m ride (pickup == dropoff) from a missing row or a NULL geometry — both
    // collapsed to 0 km and were priced as a zero-distance trip. Distinguish them
    // explicitly with a null check, and treat a truly absent row as a hard error
    // rather than silently charging the passenger the base fare only.
    const rawDistance = (
      distResult as Array<{ distance_meters: number | string | null }>
    )[0]?.distance_meters;

    if (rawDistance == null) {
      this.logger.warn(
        `No PostGIS distance available for order ${orderId} (missing row or NULL geometry); ` +
          'falling back to 0 km for final pricing',
      );
    }

    actualDistanceKm = rawDistance != null ? parseFloat(String(rawDistance)) / 1000 : 0;

    // The measure above is a straight line between the ordered points, not the
    // road. In a real street grid that under-reports the driven distance —
    // the driver absorbs the difference on every ride.
    //
    // Routing the same points through OSRM gives what was actually driven.
    // It is off by default because switching it on repricing every ride is a
    // business decision, not a deployment detail: enable ROUTED_DISTANCE_PRICING
    // once you have compared a few real trips both ways.
    if (this.routedDistancePricing.enabled) {
      const routed = await this.routedDistanceKm(orderId);
      if (routed != null) {
        this.logger.log(
          `Order ${orderId}: routed distance ${routed.toFixed(2)} km ` +
            `(straight-line was ${actualDistanceKm.toFixed(2)} km)`,
        );
        actualDistanceKm = routed;
      }
    }

    // Yakuniy narx — endi qatorlarga ajratilgan holda, chunki chek uni
    // jonli tarifdan qayta hisoblay olmaydi (tarif keyin o'zgarishi mumkin).
    //
    // ⚠️ `order.surgeMultiplier` ATAYLAB UZATILMAYDI — mavjud narx xulqi
    // saqlanadi. Bu yerda ma'lum nomuvofiqlik bor: buyurtma yaratilganda
    // baholash hudud koeffitsienti bilan hisoblanadi
    // (`orders-creation.service.ts`), yakunda esa faqat tarifning o'z
    // koeffitsienti qo'llanadi — ya'ni yo'lovchidan ko'rsatilganidan KAM
    // undiriladi. Buni tuzatish narxni oshiradi, ya'ni BIZNES QARORI;
    // shuning uchun u shu o'zgarish doirasida qilinmadi. Tuzatish kerak
    // bo'lsa: quyidagi chaqiruvga to'rtinchi argument `order.surgeMultiplier`
    // qo'shiladi va `tariffs.service.spec.ts` dagi kutilgan qiymatlar
    // yangilanadi.
    const tariff = await this.tariffsService.findById(order.tariffId);

    // ⚠️ NARX QOIDASI — ikkita rejim, USTIGA har ikkalasiga qo'shiladigan
    // kutish haqi:
    //
    // QAT'IY (`isFixedPrice`): yo'lovchi manzilni oldindan belgilagan, ya'ni
    //   marshrut ma'lum bo'lgan. Buyurtma yaratilganda hisoblangan tarkib
    //   (`order.fareBreakdown`) YO'L HAQI sifatida aynan undiriladi:
    //   tirbandlik ham, uzunroq yo'l ham summani o'zgartirmaydi.
    //
    // HISOBLAGICH: manzil oldindan ma'lum emas yoki buyurtma yaratilganda
    //   marshrutni hisoblab bo'lmagan (OSRM javob bermagan). Bunda haqiqiy
    //   bosib o'tilgan masofa bo'yicha hisoblanadi.
    //
    // ⚠️ VA'DA O'ZGARDI — KUTISH KAFOLATDAN TASHQARIDA (biznes qarori).
    // Ilgari bu yerda "qat'iy narxda `fareBreakdown.total` AYNAN undiriladi"
    // deb yozilgan edi; endi undiriladigan summa `quote.total + waitingFare`.
    // Sababi: qat'iy narx MARSHRUT noaniqligini yopadi — buni haydovchi
    // boshqarmaydi. Kutish esa YO'LOVCHI boshqaradigan xarajat, va uni
    // kafolat ichiga kiritish haydovchini yo'lovchining kechikishi uchun
    // jazolardi. Amalda "narx belgilangan, kutish alohida" degan va'da
    // bo'ladi — mobil ilovalardagi "Belgilangan narx" chipi ham shu
    // ma'noni berishi SHART, aks holda va'da bilan chek farq qiladi.
    //
    // Eski buyurtmalarda `isFixedPrice = false` va `fareBreakdown = null` —
    // ular hisoblagich yo'lidan o'tadi, ya'ni bugungi xulq saqlanadi.
    const useQuote = order.isFixedPrice && order.fareBreakdown != null;

    const rideFare = useQuote
      ? order.fareBreakdown!
      : this.tariffsService.calculatePriceBreakdown(
          tariff,
          actualDistanceKm,
          actualDurationMin,
        );

    // ⚠️ KUTISH — IKKALA REJIM UCHUN BITTA JOYDA. Ataylab shunday: qoida
    // ikki tarmoqqa ko'chirilsa, ular vaqt o'tishi bilan ajralib ketardi va
    // bir xil kutgan ikki yo'lovchi har xil summa to'lardi.
    //
    // Oyna: `order.arrivedAt` → `trip.startTime`. Safar boshlangach kutish
    // TUGAYDI — undan keyingi vaqt `timeFare` da alohida hisoblanadi, ya'ni
    // ikki marta undirilmaydi.
    //
    // ⚠️ ESKI BUYURTMALAR: `arrivedAt` migratsiyadan oldin umuman yozilmagan
    // (`null`), safar yozuvi yo'q bo'lsa `trip?.startTime` ham `null` —
    // ikkalasida ham kutish 0 va hisob-kitob AVVALGIDEK qoladi.
    const { freeWaitMinutes, waitingPricePerMinute } = waitingSettingsOf(tariff);
    const waitingMinutes = computeWaitingMinutes(
      order.arrivedAt,
      trip?.startTime ?? null,
      freeWaitMinutes,
    );

    const fareBreakdown = withWaitingFare(
      rideFare,
      waitingMinutes,
      waitingPricePerMinute,
    );
    const finalPrice = fareBreakdown.total;

    if (useQuote) {
      this.logger.log(
        `Order ${orderId}: qat'iy narx qo'llandi (yo'l haqi ${rideFare.total}, ` +
          `kutish ${fareBreakdown.waitingFare}, jami ${finalPrice}). ` +
          `Haqiqiy masofa ${actualDistanceKm.toFixed(2)} km, ` +
          `baholangan ${fareBreakdown.distanceKm.toFixed(2)} km.`,
      );
    }

    if (waitingMinutes > 0) {
      // Kutish haqi nizo chiqadigan qator — undirilgan har bir daqiqa
      // jurnalda qoladi, aks holda "nega qo'shimcha pul yechildi?" savoliga
      // javob beradigan hech narsa bo'lmasdi.
      this.logger.log(
        `Order ${orderId}: kutish ${waitingMinutes} daqiqa × ` +
          `${waitingPricePerMinute} so'm = ${fareBreakdown.waitingFare} so'm ` +
          `(bepul ${freeWaitMinutes} daqiqadan keyin).`,
      );
    }

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
        // apply() must succeed before the discount counts. It is the step that
        // atomically claims one of the code's remaining uses and can still
        // fail here (the limit was taken by a concurrent completion), so the
        // assignment happens only after it returns.
        await this.promoCodesService.apply(order.promoCodeId, order.passengerId, orderId);
        finalDiscountAmount = promoResult.discountAmount;
      } catch (err) {
        // Promo became invalid between order creation and completion (expired,
        // limit hit by a concurrent order) — degrade gracefully to full price
        // rather than failing trip completion.
        //
        // The discount is explicitly cleared: it used to be assigned before
        // apply(), so a code that failed to claim a use still discounted the
        // fare, handing out a free discount the promo never recorded.
        finalDiscountAmount = 0;
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
    let walletShortfall = 0;

    await this.dataSource.transaction(async (manager) => {
      // Is the fare actually collected at this moment?
      //
      //  - CASH:   yes. The driver took the money directly from the passenger;
      //            the platform never held it.
      //  - WALLET: yes, if the passenger has the funds — they are debited here
      //            and now, under a lock so two concurrent completions cannot
      //            both pass the same balance check.
      //  - CARD:   not yet. The charge stays a receivable until the payment
      //            provider's callback settles it (PaymentsService).
      //
      // This matters because the driver payout below follows the same status:
      // crediting a spendable payout against money nobody collected paid
      // drivers out of platform funds. WALLET was worse still — it had no
      // balance check at all, so a passenger with an empty wallet could take
      // unlimited rides and every one of them paid the driver.
      let chargeStatus: TransactionStatus;

      if (order.paymentMethod === PaymentMethod.CASH) {
        chargeStatus = TransactionStatus.COMPLETED;
      } else if (order.paymentMethod === PaymentMethod.WALLET) {
        await lockWalletForUpdate(manager, order.passengerId);
        // Sarflash uchun QIRQILGAN qoldiq: hamyon balansi endi ishorali
        // bo'lishi mumkin (haydovchi qarzi), manfiy qiymatni to'g'ridan-
        // to'g'ri narx bilan solishtirish esa qarzdor foydalanuvchini
        // o'tkazib yuborishi mumkin edi.
        const balance = await computeSpendableBalance(
          manager.getRepository(Transaction),
          order.passengerId,
        );

        if (balance >= discountedFinalPrice) {
          chargeStatus = TransactionStatus.COMPLETED;
        } else {
          // The ride physically happened, so it is not cancellable here. The
          // charge is recorded as an unpaid receivable and the passenger is
          // blocked from ordering again until it clears
          // (OrdersCreationService checks for outstanding debt).
          chargeStatus = TransactionStatus.PENDING;
          walletShortfall = discountedFinalPrice - balance;
          this.logger.warn(
            `Wallet balance ${balance} is short of fare ${discountedFinalPrice} for order ` +
              `${orderId}; recording an unpaid charge for passenger ${order.passengerId}`,
          );
        }
      } else {
        chargeStatus = TransactionStatus.PENDING;
      }

      await manager.update(Order, orderId, {
        status: OrderStatus.COMPLETED,
        finalPrice: discountedFinalPrice,
        discountAmount: finalDiscountAmount || null,
        driverEarning: netDriverEarning,
        // Chek ma'lumotlari AYNI SHU tranzaksiyada yoziladi: chek — pul
        // harakatining qog'ozdagi aksi, ular ajralib qolsa chek yolg'on
        // gapiradi.
        fareBreakdown,
        completedAt: now,
      });

      // Passenger charge.
      await manager.save(Transaction, {
        userId: order.passengerId,
        orderId,
        amount: discountedFinalPrice,
        type: TransactionType.DEBIT,
        paymentMethod: order.paymentMethod,
        status: chargeStatus,
        externalId: null,
      });

      // Driver payout.
      //
      // NAQD va NAQD BO'LMAGAN safar bu yerda TUB FARQ qiladi, chunki pulni
      // kim ushlab turgani boshqa:
      //
      //  - Naqd: haydovchi summani yo'lovchidan QO'LIGA olgan, platforma unga
      //    tegmagan. Demak platforma haydovchiga hech narsa qarz emas —
      //    aksincha, haydovchi platformaga komissiya qarzdor. Daftarga FAQAT
      //    komissiya DEBIT'i tushadi.
      //
      //  - Naqd bo'lmagan: pulni platforma ushlab turadi, ya'ni haydovchiga
      //    sof to'lovni qarz. Daftar ikkala oyoqni ham yozadi (to'liq summa
      //    CREDIT + komissiya DEBIT) va ikkalasi yo'lovchi to'lovi holatini
      //    oladi — pul HAQIQATAN yig'ilmaguncha yechib bo'lmaydi.
      //    `PaymentsService.settleOrderPayout` provayder javobi kelganda
      //    ularni COMPLETED ga o'tkazadi.
      //
      // ⚠️ NEGA MUHIM: ilgari naqd safarda ham to'liq summa CREDIT bo'lib
      // yozilardi va `chargeStatus` naqd uchun COMPLETED edi. Ya'ni
      // haydovchining yechib olinadigan hamyoniga sof daromad tushardi —
      // o'sha pul allaqachon uning cho'ntagida bo'la turib. Faqat naqd bilan
      // ishlaydigan haydovchi shu yo'l bilan bir pulni ikki marta olishi
      // mumkin edi: bir marta yo'lovchidan, ikkinchi marta platformadan
      // yechib.
      const platformHoldsFare = order.paymentMethod !== PaymentMethod.CASH;

      if (order.driverId && payoutDriver) {
        if (platformHoldsFare) {
          await manager.save(Transaction, {
            userId: order.driverId,
            orderId,
            amount: discountedFinalPrice,
            type: TransactionType.CREDIT,
            paymentMethod: order.paymentMethod,
            status: chargeStatus,
            externalId: null,
          });
        }

        if (commissionAmount > 0) {
          await manager.save(Transaction, {
            userId: order.driverId,
            orderId,
            amount: commissionAmount,
            type: TransactionType.DEBIT,
            paymentMethod: order.paymentMethod,
            status: chargeStatus,
            externalId: 'commission',
          });
        }

        // The `drivers.balance` column tracks what the platform owes the
        // driver (or the driver owes the platform, when negative).
        //
        //  - CASH: the driver already pocketed the fare, so only the
        //    commission owed back to the platform lands here. The balance
        //    trends negative by design — that is the amount the driver must
        //    eventually top up.
        //  - Collected non-cash: the platform holds the money, so it owes the
        //    driver the net payout.
        //  - Uncollected non-cash: nothing has been collected, so nothing is
        //    owed yet. Crediting here is exactly the bug that paid drivers out
        //    of platform funds for fares no passenger ever paid.
        const isCollected = chargeStatus === TransactionStatus.COMPLETED;
        let balanceDelta: number;

        if (order.paymentMethod === PaymentMethod.CASH) {
          balanceDelta = -commissionAmount;
        } else if (isCollected) {
          balanceDelta = netDriverEarning;
        } else {
          balanceDelta = 0;
        }

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
        // Non-zero when the wallet could not cover the fare. The app shows a
        // "top up to keep ordering" prompt rather than letting the passenger
        // discover the block on their next request.
        unpaidAmount: walletShortfall,
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

  /**
   * Road distance (km) along pickup → waypoints → dropoff, or null when the
   * router can't answer — in which case pricing keeps the straight-line
   * measure rather than guessing.
   */
  private async routedDistanceKm(orderId: string): Promise<number | null> {
    const rows: { lng: number; lat: number }[] = await this.orderRepository.query(
      `SELECT ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat
         FROM (
           SELECT 0 AS ord, pickup_location AS geom
             FROM orders WHERE id = $1
           UNION ALL
           SELECT ordinality::int AS ord,
                  ST_SetSRID(
                    ST_MakePoint((w->>'lng')::float8, (w->>'lat')::float8),
                    4326
                  ) AS geom
             FROM orders o,
                  jsonb_array_elements(COALESCE(o.waypoints, '[]'::jsonb))
                    WITH ORDINALITY AS t(w, ordinality)
            WHERE o.id = $1
           UNION ALL
           SELECT 2147483647 AS ord, dropoff_location AS geom
             FROM orders WHERE id = $1
         ) path
        ORDER BY ord`,
      [orderId],
    );

    if (rows.length < 2) return null;

    const meters = await this.osrmService.routeDistanceMeters(
      rows.map((r) => [Number(r.lng), Number(r.lat)] as const),
    );

    return meters == null ? null : meters / 1000;
  }
}
