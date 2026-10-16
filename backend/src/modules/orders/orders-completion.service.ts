// Trip completion and everything money-related that hangs off it: final fare
// from actual distance/duration, promo re-validation and consumption, the
// commission split, the passenger charge and the two-legged driver payout
// ledger entries, wallet adjustment, bonus evaluation, and the first-trip
// referral bonus. Separated from OrdersLifecycleService because this single
// transition carries far more business rules than all the others combined.
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
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { TaximeterService } from '../taximeter/taximeter.service';
import { Order, OrderStatus, PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import {
  PARCEL_PIN_MAX_ATTEMPTS,
  assertPinGiven,
  checkDeliveryPin,
  deliveryPinLocked,
} from './parcel';
import { Trip } from '../../database/entities/trip.entity';
import {
  FARE_BONUS_LEDGER_TAG,
  FARE_BONUS_SPEND_LEDGER_TAG,
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
  computeBonusBalance,
  computeSpendableBalance,
  lockWalletForUpdate,
} from '../payments/wallet-balance.util';
import {
  computeWaitingMinutes,
  waitingSettingsOf,
  waitingStartOf,
  withWaitingFare,
} from '../tariffs/waiting-charge';
import { withOptionsFare } from './trip-option-fees';
import { meteredTariff } from '../tariffs/metered-rate';
import { OrderFraudService } from './order-fraud.service';
import { REFERRAL_BONUS_AMOUNT } from './referral-bonus';
import { RideFareSplit, resolveCommissionRate, splitRideFare } from './commission-policy';
import { FinancePolicyService } from '../settings/finance-policy.service';
import { CompletionFinancePolicy } from '../settings/legal-compliance-settings';
import { TAX_WITHHOLDING_LEDGER_TAG, computeTaxWithholding } from '../tax/tax-withholding';
import { FiscalReceiptsService } from '../fiscal/fiscal-receipts.service';
import { Driver } from '../../database/entities/driver.entity';
import { ShiftPassesService } from '../shift-passes/shift-passes.service';

// Flat bonus (in so'm) credited to both a referred passenger and their
// referrer the first time the referred passenger completes a trip. See
// `creditFirstRideReferralBonus`, and ReferralsService.getMyReferralInfo which
// sums these by externalId prefix.

/**
 * Naqd + promokodli safarda platformaning haydovchiga chegirma qoplamasi
 * CREDIT'i (`delivery/promo-compensation.ts` dagi `<kind>_order_promo_<id>`
 * bilan bir uslub). Buyurtmaga xos — bir safar uchun bitta.
 */
export const RIDE_PROMO_COMPENSATION_TAG = (orderId: string): string => `ride_promo_${orderId}`;

/** Referal "birinchi safar" sanog'iga kiradigan — yo'lovchining O'Z safarlari. */
const REFERRAL_RIDE_SERVICE_TYPES: readonly ServiceType[] = [
  ServiceType.TAXI,
  ServiceType.CARGO,
  ServiceType.PARCEL,
];

/** Ovqat/market kuryer safari — buyurtma `details` ida sotuvchi buyurtmasi id'si bor. */
function isVendorDeliveryRide(order: Pick<Order, 'details'>): boolean {
  return (
    typeof order.details?.foodOrderId === 'string' ||
    typeof order.details?.marketOrderId === 'string'
  );
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string } | undefined)?.code === '23505'
  );
}

/**
 * Hamyon bilan to'langan summaning yo'lovchi BONUSIDAN qoplangan qismi.
 * Avval haqiqiy pul (`balance − bonus`) sarflanadi, yetmagani — bonusdan.
 */
export function bonusFundedPart(amount: number, balance: number, bonus: number): number {
  const realMoney = Math.max(0, balance - Math.max(0, bonus));
  return Math.min(Math.max(0, bonus), Math.max(0, amount - realMoney));
}

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
    // Optional only so unit tests that build this service by hand keep
    // compiling; DeliveryEventsModule is global, so the app always has it.
    @Optional() private readonly deliveryEvents?: DeliveryEventsService,
    @Optional() private readonly taximeterService?: TaximeterService,
    @Optional() private readonly fraudService?: OrderFraudService,
    // Ixtiyoriy — `SettingsService` ni qo'lda soxtalashtiradigan spec'lar
    // uchun. Yo'q bo'lsa: aksiya yo'q, soliq ushlab qolinmaydi (avvalgi xulq).
    @Optional() private readonly financePolicy?: FinancePolicyService,
    // Fiskal chek yozuvi — best-effort, yakunlashni hech qachon buzmaydi.
    @Optional() private readonly fiscalReceipts?: FiscalReceiptsService,
    // Smena (kunlik obuna) — faol bo'lsa komissiya 0. Ixtiyoriy: yo'q bo'lsa
    // smena hisobga olinmaydi (avvalgi xulq).
    @Optional() private readonly shiftPasses?: ShiftPassesService,
  ) {}

  async completeTrip(
    driverId: string,
    orderId: string,
    deliveryPin?: string,
    options: { byDispatcher?: boolean } = {},
  ): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete order with status ${order.status}`,
      );
    }

    if (order.driverId !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }

    // Posilka faqat qabul qiluvchi aytgan PIN bilan topshiriladi. Dispetcher
    // (PIN bloklanganda, qabul qiluvchi bilan gaplashib) undan ozod.
    if (order.serviceType === ServiceType.PARCEL && !options.byDispatcher) {
      await this.verifyDeliveryPin(orderId, deliveryPin);
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

    // TAKSOMETR — masofa haydovchining haqiqiy GPS izidan; aks holda
    // to'xtashlar bo'ylab o'lchanadi (pastdagi `plannedPathDistanceKm`).
    actualDistanceKm = order.isMetered
      ? await this.meteredDistanceKm(orderId)
      : await this.plannedPathDistanceKm(orderId);

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

    // OPSIYA HAQI: qat'iy narxda quote'ning ichida; hisoblagich yo'lida esa
    // buyurtma berilganda MUZLATILGAN qatorlar qayta qo'shiladi
    // (`trip-option-fees.ts`) — sozlama keyin o'zgargan bo'lsa ham.
    const rideFare = useQuote
      ? order.fareBreakdown!
      : withOptionsFare(
          this.tariffsService.calculatePriceBreakdown(
            // Taksometrda km narxi alohida bo'lishi mumkin (`metered-rate.ts`).
            meteredTariff(tariff, order.isMetered ?? false),
            actualDistanceKm,
            actualDurationMin,
          ),
          order.fareBreakdown?.optionCharges ?? [],
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
    // ⚠️ YETKAZISHDA KUTISH HAQI YO'Q. Kuryer "yetib keldim" dan "olib
    // ketdim" gacha RESTORAN/DO'KON oldida kutadi — bu sotuvchining
    // tayyorlash vaqti, mijozniki emas. Mijozdan undirish uni boshqa
    // birovning kechikishi uchun jazolardi.
    //
    // Rejalashtirilgan safarda oyna `scheduledAt` dan oldin boshlanmaydi
    // (`waitingStartOf`).
    const waitingMinutes = isVendorDeliveryRide(order)
      ? 0
      : computeWaitingMinutes(
          waitingStartOf(order.arrivedAt, order.scheduledAt),
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

    // Promokod OLDINDAN faqat TEKSHIRILADI (o'qish). Uni band qilish —
    // `apply()` — tranzaksiya ichida, buyurtma da'vo qilingandan KEYIN:
    // ikki parallel yakunlashdan yutqazgani promokodning bitta ishlatilishini
    // behuda yeb qo'ymasin.
    const promo = await this.validatePromoForCompletion(order, finalPrice);

    // Commission: driver's own override rate if set, else the platform default
    // — except during the launch promo, when taxi commission is 0, and while
    // the driver holds a shift pass covering this ride (`commission-policy.ts`
    // documents the precedence).
    const payoutDriver = order.driverId
      ? await this.driversService.findByUserId(order.driverId)
      : null;
    const financePolicy = await this.loadFinancePolicy();
    const commissionRate = resolveCommissionRate({
      serviceType: order.serviceType,
      driverRate: payoutDriver?.commissionRate ?? null,
      defaultRate: financePolicy.defaultCommissionRate,
      launchPromoUntil: financePolicy.launchPromoCommissionUntil,
      now,
      shiftPassActive: order.driverId
        ? await this.shiftPassCovers(order.driverId, order.serviceType, now)
        : false,
    });

    // ⚠️ PROMOKODNI PLATFORMA TO'LAYDI (biznes qarori, 2026-10-16). Komissiya
    // va soliq CHEGIRMASIZ narxdan; yo'lovchi chegirmali summani to'laydi
    // (`splitRideFare`). Ilgari ikkalasi ham chegirmali narxdan olinardi —
    // 20 000 lik safarda 5 000 promokod haydovchiga 15 000 − 1 500 berardi,
    // naqdda esa farqni hech kim qoplamasdi: chegirmani haydovchi to'lardi.
    let split = splitRideFare(finalPrice, promo?.discountAmount ?? 0, commissionRate);

    // Soliq agenti sifatida ushlab qolish (PQ-247). Baza — komissiya bilan
    // BIR XIL: chegirmasiz yo'l haqi, ya'ni haydovchining haqiqiy daromadi
    // (chegirmani platforma qoplaydi). Kuryer safari ham shu yo'ldan o'tadi.
    const taxWithheld = payoutDriver
      ? computeTaxWithholding(split.grossFare, financePolicy.taxWithholding)
      : 0;

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
      // ⚠️ DA'VO — tranzaksiyadagi BIRINCHI yozuv. Yuqoridagi holat
      // tekshiruvi oddiy o'qish: haydovchining ikki marta bosishi, qayta
      // urinish yoki haydovchi bilan dispetcherning `completeByDispatcher`
      // poygasi ikkalasini ham o'tkazib yuborardi va har biri to'liq
      // hisob-kitobni yozardi — yo'lovchidan ikki marta, haydovchiga ikki
      // marta, komissiya, referal va chek ham ikki martadan. Shartli UPDATE
      // qatorni qulflaydi: ikkinchisi birinchisi commit bo'lishini kutadi,
      // keyin 0 qator ko'radi va bitta ham pul yozuvisiz rad etiladi.
      //
      // Chek ma'lumotlari (`fareBreakdown`) AYNI SHU tranzaksiyada yoziladi:
      // chek — pul harakatining qog'ozdagi aksi, ular ajralib qolsa chek
      // yolg'on gapiradi.
      const claim = await manager.update(
        Order,
        { id: orderId, status: OrderStatus.IN_PROGRESS },
        {
          status: OrderStatus.COMPLETED,
          finalPrice: split.passengerPays,
          discountAmount: split.discountAmount || null,
          driverEarning: split.driverEarning,
          fareBreakdown,
          completedAt: now,
        },
      );
      if (!claim.affected) {
        throw new ConflictException('Order is no longer in progress');
      }

      if (promo) {
        split = await this.claimPromoUse(manager, order, promo.promoCodeId, split, commissionRate);
      }
      const passengerPays = split.passengerPays;

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
      let bonusFundedFare = 0;

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

        if (balance >= passengerPays) {
          chargeStatus = TransactionStatus.COMPLETED;
          // Avval haqiqiy pul sarflanadi, yetmagan qismi — bonusdan. Bonusdan
          // qoplangan qism haydovchiga yechib bo'lmaydigan bo'lib tushadi.
          bonusFundedFare = bonusFundedPart(
            passengerPays,
            balance,
            await computeBonusBalance(manager, order.passengerId),
          );
        } else {
          // The ride physically happened, so it is not cancellable here. The
          // charge is recorded as an unpaid receivable and the passenger is
          // blocked from ordering again until it clears
          // (OrdersCreationService checks for outstanding debt).
          chargeStatus = TransactionStatus.PENDING;
          walletShortfall = passengerPays - balance;
          this.logger.warn(
            `Wallet balance ${balance} is short of fare ${passengerPays} for order ` +
              `${orderId}; recording an unpaid charge for passenger ${order.passengerId}`,
          );
        }
      } else {
        chargeStatus = TransactionStatus.PENDING;
      }

      // Passenger charge — chegirmali summa. Bonusdan qoplangan qism alohida
      // `FARE_BONUS_SPEND_LEDGER_TAG` qatori: u yo'lovchining bonus hisobini
      // kamaytiradi (jami DEBIT o'zgarmaydi). Bonussiz safarda — bitta qator.
      const chargeParts = [
        { amount: passengerPays - bonusFundedFare, externalId: null },
        { amount: bonusFundedFare, externalId: FARE_BONUS_SPEND_LEDGER_TAG },
      ].filter((part) => part.amount > 0);
      for (const part of chargeParts) {
        await manager.save(Transaction, {
          userId: order.passengerId,
          orderId,
          amount: part.amount,
          type: TransactionType.DEBIT,
          paymentMethod: order.paymentMethod,
          status: chargeStatus,
          externalId: part.externalId,
        });
      }

      // Driver payout.
      //
      // NAQD va NAQD BO'LMAGAN safar bu yerda TUB FARQ qiladi, chunki pulni
      // kim ushlab turgani boshqa:
      //
      //  - Naqd: haydovchi summani yo'lovchidan QO'LIGA olgan, platforma unga
      //    tegmagan. Demak platforma haydovchiga safar puli qarz emas —
      //    aksincha, haydovchi platformaga komissiya qarzdor. Daftarga
      //    komissiya DEBIT'i tushadi, promokod bo'lsa — chegirma qoplamasi
      //    CREDIT'i (haydovchi qo'liga shuncha KAM olgan).
      //
      //  - Naqd bo'lmagan: pulni platforma ushlab turadi, ya'ni haydovchiga
      //    sof to'lovni qarz. Daftar ikkala oyoqni ham yozadi (CHEGIRMASIZ
      //    to'liq summa CREDIT + komissiya DEBIT) va ikkalasi yo'lovchi
      //    to'lovi holatini oladi — pul HAQIQATAN yig'ilmaguncha yechib
      //    bo'lmaydi. `PaymentsService.settleOrderPayout` provayder javobi
      //    kelganda ularni COMPLETED ga o'tkazadi. Yo'lovchi to'lagani bilan
      //    CREDIT orasidagi farq — platformaning promokod xarajati.
      //
      // ⚠️ NEGA MUHIM: ilgari naqd safarda ham to'liq summa CREDIT bo'lib
      // yozilardi va `chargeStatus` naqd uchun COMPLETED edi. Ya'ni
      // haydovchining yechib olinadigan hamyoniga sof daromad tushardi —
      // o'sha pul allaqachon uning cho'ntagida bo'la turib. Faqat naqd bilan
      // ishlaydigan haydovchi shu yo'l bilan bir pulni ikki marta olishi
      // mumkin edi: bir marta yo'lovchidan, ikkinchi marta platformadan
      // yechib.
      const platformHoldsFare = order.paymentMethod !== PaymentMethod.CASH;
      const promoCompensation = platformHoldsFare ? 0 : split.discountAmount;

      if (order.driverId && payoutDriver) {
        if (platformHoldsFare) {
          // Bonusdan qoplangan qism alohida, yechib bo'lmaydigan qator
          // (`FARE_BONUS_LEDGER_TAG`); jami CREDIT o'zgarmaydi.
          const fareParts = [
            { amount: split.grossFare - bonusFundedFare, externalId: null },
            { amount: bonusFundedFare, externalId: FARE_BONUS_LEDGER_TAG },
          ].filter((part) => part.amount > 0);
          for (const part of fareParts) {
            await manager.save(Transaction, {
              userId: order.driverId,
              orderId,
              amount: part.amount,
              type: TransactionType.CREDIT,
              paymentMethod: order.paymentMethod,
              status: chargeStatus,
              externalId: part.externalId,
            });
          }
        }

        // Naqd + promokod: haydovchi yo'lovchidan chegirmali summani oldi —
        // platforma farqni hamyoniga qoplaydi. Bu HAQIQIY pul (u yig'a
        // olmagan naqd), shuning uchun darhol COMPLETED va yechib olinadi.
        // Teg buyurtmaga xos — bir safar uchun ikki marta yozilmaydi
        // (yuqoridagi da'vo bilan birga).
        if (promoCompensation > 0) {
          await manager.save(Transaction, {
            userId: order.driverId,
            orderId,
            amount: promoCompensation,
            type: TransactionType.CREDIT,
            paymentMethod: PaymentMethod.WALLET,
            status: TransactionStatus.COMPLETED,
            externalId: RIDE_PROMO_COMPENSATION_TAG(orderId),
          });
        }

        if (split.commissionAmount > 0) {
          await manager.save(Transaction, {
            userId: order.driverId,
            orderId,
            amount: split.commissionAmount,
            type: TransactionType.DEBIT,
            paymentMethod: order.paymentMethod,
            status: chargeStatus,
            externalId: 'commission',
          });
        }

        // Ushlab qolingan soliq — alohida qator (hisobot shu belgidan
        // o'qiydi), holati komissiya bilan bir xil: karta puli yig'ilganda
        // `settleOrderPayout` uni ham COMPLETED qiladi. Takror yozilmasligini
        // `uq_transactions_tax_withholding_order` indeksi kafolatlaydi.
        if (taxWithheld > 0) {
          await manager.save(Transaction, {
            userId: order.driverId,
            orderId,
            amount: taxWithheld,
            type: TransactionType.DEBIT,
            paymentMethod: order.paymentMethod,
            status: chargeStatus,
            externalId: TAX_WITHHOLDING_LEDGER_TAG,
          });
        }

        // The `drivers.balance` column tracks what the platform owes the
        // driver (or the driver owes the platform, when negative).
        //
        //  - CASH: the driver already pocketed the fare, so only the
        //    commission owed back to the platform lands here (plus the promo
        //    compensation the platform owes him). The balance trends negative
        //    by design — that is the amount the driver must eventually top up.
        //  - Collected non-cash: the platform holds the money, so it owes the
        //    driver the net payout.
        //  - Uncollected non-cash: nothing has been collected, so nothing is
        //    owed yet. Crediting here is exactly the bug that paid drivers out
        //    of platform funds for fares no passenger ever paid.
        const isCollected = chargeStatus === TransactionStatus.COMPLETED;
        let balanceDelta: number;

        if (order.paymentMethod === PaymentMethod.CASH) {
          balanceDelta = promoCompensation - split.commissionAmount - taxWithheld;
        } else if (isCollected) {
          balanceDelta = split.driverEarning - taxWithheld;
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

    // Bu yerdan pastdagi hamma narsa faqat da'voni YUTGAN chaqiruvda ishlaydi.
    const discountedFinalPrice = split.passengerPays;

    // Safar yozuvi — haqiqiy masofa va davomiylik. Da'vodan keyin: yutqazgan
    // parallel chaqiruv tugash vaqtini qayta yozmasin.
    if (trip) {
      await this.tripRepository.update(trip.id, {
        endTime: now,
        actualDistanceKm,
        actualDurationMin,
      });
    }

    // Redis is not part of the transaction, so the driver is only dropped from
    // the online set once the negative balance is actually durable.
    if (wentOffline && payoutDriverId) {
      await this.driversService.takeOfflineInRedis(
        payoutDriverId,
        'balance went negative after settlement',
      );
    }

    // O'zini o'zi zakaz qilish tekshiruvi BONUSDAN OLDIN: shubhali safar
    // bonus va referal hisobiga kirmaydi (`fraud-rules.ts`). Best-effort —
    // tekshiruv xatosi safar yakunini to'xtatmaydi, safar toza hisoblanadi.
    let suspicious = false;
    try {
      suspicious = (await this.fraudService?.assessCompleted(orderId))?.flagged ?? false;
    } catch (err) {
      this.logger.warn(`Fraud assessment failed for order ${orderId}: ${err}`);
    }

    if (order.driverId && payoutDriver && !suspicious) {
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
    // Food/market: marks the vendor order delivered and settles the vendor.
    await this.deliveryEvents?.publish(updatedOrder, 'delivered');

    // Chek jami — yo'lovchi HAQIQATAN to'lagan summa; komissiya chegirmasiz
    // narxdan (promokodni platforma ko'taradi).
    await this.recordFiscalReceipt(order, payoutDriver, discountedFinalPrice, split.commissionAmount);

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

    // Shubhali safarda referal ushlab qolinadi — menejer tasdiqlasa
    // `creditReferralBonus` beradi.
    if (passenger?.referredByUserId && !suspicious) {
      await this.creditFirstRideReferralBonus(order, passenger.referredByUserId);
    }

    this.logger.log(
      `Order ${orderId} completed. Distance: ${actualDistanceKm.toFixed(2)}km, Price: ${discountedFinalPrice} UZS`,
    );

    return updatedOrder;
  }

  /**
   * Promokodni yakuniy narxga qarshi QAYTA tekshiradi (o'qish, band qilmaydi).
   * Yaroqsiz bo'lib qolgan bo'lsa (muddati o'tgan, limit tugagan) — `null`,
   * ya'ni to'liq narx: yakunlash bu sababli buzilmaydi.
   */
  private async validatePromoForCompletion(
    order: Order,
    finalPrice: number,
  ): Promise<{ promoCodeId: string; discountAmount: number } | null> {
    if (!order.promoCodeId) return null;
    try {
      const promoCode = await this.promoCodesService.findById(order.promoCodeId);
      const result = await this.promoCodesService.validate(
        promoCode.code,
        order.passengerId,
        finalPrice,
        { serviceType: order.serviceType },
      );
      return { promoCodeId: order.promoCodeId, discountAmount: result.discountAmount };
    } catch (err) {
      this.logger.warn(
        `Promo code re-validation failed at completion for order ${order.id}, charging full price: ${err}`,
      );
      return null;
    }
  }

  /**
   * Promokodning bitta ishlatilishini band qiladi — faqat da'voni yutgan
   * tranzaksiya ichidan. apply() must succeed before the discount counts: it
   * atomically claims one of the code's remaining uses and can still fail
   * here (the limit was taken by a concurrent order). Then the trip is
   * charged in full and the already-written order row is corrected — the
   * discount is never handed out without a recorded use.
   */
  private async claimPromoUse(
    manager: EntityManager,
    order: Order,
    promoCodeId: string,
    split: RideFareSplit,
    commissionRate: number,
  ): Promise<RideFareSplit> {
    try {
      await this.promoCodesService.apply(promoCodeId, order.passengerId, order.id, manager);
      return split;
    } catch (err) {
      this.logger.warn(
        `Promo code could not be claimed at completion for order ${order.id}, charging full price: ${err}`,
      );
      const fullPrice = splitRideFare(split.grossFare, 0, commissionRate);
      await manager.update(Order, order.id, {
        finalPrice: fullPrice.passengerPays,
        discountAmount: null,
        driverEarning: fullPrice.driverEarning,
      });
      return fullPrice;
    }
  }

  /**
   * Referral bonus: if this passenger was referred by another user and this
   * is their first-ever completed OWN ride, credit both the passenger and
   * their referrer a fixed bonus. Best-effort — a bonus-crediting bug must
   * never break trip completion, which is the actually critical operation.
   *
   * Faqat yo'lovchining O'Z safarlari sanaladi (taksi/yuk/posilka). Ovqat/
   * market kuryer safari ham `passengerId = mijoz` bilan yaratiladi — ilgari
   * u sanalardi: kuryer safaridan keyingi birinchi taksi "ikkinchi" bo'lib
   * qolardi, kuryer safarining o'zi esa "birinchi" deb bonus berardi.
   */
  private async creditFirstRideReferralBonus(order: Order, referrerUserId: string): Promise<void> {
    // `serviceType` yo'q (eski qator / qo'lda yig'ilgan obyekt) — taksi,
    // yaratishdagi standart bilan bir xil.
    const serviceType = order.serviceType ?? ServiceType.TAXI;
    if (!REFERRAL_RIDE_SERVICE_TYPES.includes(serviceType) || isVendorDeliveryRide(order)) {
      return;
    }
    try {
      const completedOwnRides = await this.orderRepository.count({
        where: {
          passengerId: order.passengerId,
          status: OrderStatus.COMPLETED,
          serviceType: In(REFERRAL_RIDE_SERVICE_TYPES),
        },
      });
      if (completedOwnRides !== 1) return;

      await this.saveReferralCredit(order, order.passengerId, `referral_bonus_passenger_${order.id}`);
      await this.saveReferralCredit(order, referrerUserId, `referral_bonus_referrer_${order.id}`);
    } catch (err) {
      this.logger.warn(`Referral bonus crediting failed for order ${order.id}: ${err}`);
    }
  }

  /**
   * Bitta referal CREDIT'i. Takror (`23505` — referal bonusiga qo'yilgan
   * unique index) — bonus allaqachon berilgan: jurnalga yoziladi va davom
   * etiladi, yakunlash yiqilmaydi.
   */
  private async saveReferralCredit(order: Order, userId: string, externalId: string): Promise<void> {
    try {
      await this.transactionRepository.save({
        userId,
        orderId: order.id,
        amount: REFERRAL_BONUS_AMOUNT,
        type: TransactionType.CREDIT,
        paymentMethod: PaymentMethod.WALLET,
        status: TransactionStatus.COMPLETED,
        externalId,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        this.logger.warn(`Referral bonus ${externalId} already credited (unique index) — skipped`);
        return;
      }
      throw err;
    }
  }


  /**
   * Smena shu safarni qamraydimi. Xato bo'lsa — `false` (komissiya olinadi):
   * yakunlash to'xtamaydi, noto'g'ri olingan komissiyani menejer qaytara oladi.
   */
  private async shiftPassCovers(driverUserId: string, serviceType: string, at: Date): Promise<boolean> {
    if (!this.shiftPasses) return false;
    try {
      return await this.shiftPasses.hasActivePassFor(driverUserId, serviceType, at);
    } catch (err) {
      this.logger.error(`Shift pass lookup failed for driver ${driverUserId}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Pul siyosati. Provayder ulanmagan bo'lsa (izolyatsiyadagi spec'lar) —
   * avvalgi xulq: platforma standarti, aksiya yo'q, ushlab qolish yo'q.
   */
  private async loadFinancePolicy(): Promise<CompletionFinancePolicy> {
    if (this.financePolicy) {
      return this.financePolicy.get();
    }
    return {
      defaultCommissionRate: await this.settingsService.getDefaultCommissionRate(),
      launchPromoCommissionUntil: null,
      taxWithholding: { enabled: false, ratePercent: 0 },
    };
  }

  /**
   * Fiskal chek yozuvi (komissioner modeli, komitent — haydovchi/kuryer).
   * Settlement commit qilingandan KEYIN va try/catch ichida: chek xatosi
   * hech qachon yakunlangan safarni 500 ga aylantirmaydi.
   */
  private async recordFiscalReceipt(
    order: Order,
    payoutDriver: Driver | null,
    total: number,
    commissionAmount: number,
  ): Promise<void> {
    if (!this.fiscalReceipts || !order.driverId) return;
    try {
      await this.fiscalReceipts.recordForRide({
        orderId: order.id,
        serviceType: order.serviceType,
        paymentMethod: order.paymentMethod,
        total,
        commissionAmount,
        principalUserId: order.driverId,
        principalPinfl: payoutDriver?.pinfl ?? null,
        principalTin: payoutDriver?.tin ?? null,
      });
    } catch (err) {
      this.logger.error(`Fiskal chek yozilmadi (order ${order.id}): ${(err as Error).message}`);
    }
  }

  /**
   * Taksometr: izga oxirgi nuqta qo'shiladi (oxirgi ping'dan keyingi metrlar),
   * masofa izdan olinadi va buyurtmaning "manzili" haqiqiy tugash joyiga
   * yangilanadi — chek, tarix va dispetcher xaritasi to'g'ri nuqtani ko'rsin.
   */
  private async meteredDistanceKm(orderId: string): Promise<number> {
    if (!this.taximeterService) return 0;
    await this.taximeterService.recordDriverPosition(orderId);
    const metered = await this.taximeterService.finalDistance(orderId);
    if (metered.endPoint) {
      await this.orderRepository.query(
        `UPDATE orders SET dropoff_location = ST_SetSRID(ST_MakePoint($2, $3), 4326) WHERE id = $1`,
        [orderId, metered.endPoint.lng, metered.endPoint.lat],
      );
    }
    this.logger.log(
      `Order ${orderId}: taximeter ${metered.distanceKm.toFixed(2)} km ` +
        `(${metered.matched ? 'road-matched' : 'raw GPS track'})`,
    );
    return metered.distanceKm;
  }

  /** Rejalashtirilgan yo'l (olish → bekatlar → manzil) bo'ylab masofa. */
  private async plannedPathDistanceKm(orderId: string): Promise<number> {
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

    let actualDistanceKm = rawDistance != null ? parseFloat(String(rawDistance)) / 1000 : 0;

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

    return actualDistanceKm;
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

  /**
   * Every guess spends one attempt, counted atomically BEFORE the comparison,
   * so parallel guesses cannot all read the same count and slip past the
   * limit. (Wrapped in a CTE so the driver returns plain rows, not the
   * [rows, count] pair TypeORM gives for a bare UPDATE.)
   */
  private async verifyDeliveryPin(orderId: string, given: string | undefined): Promise<void> {
    assertPinGiven(given);
    const rows = (await this.orderRepository.query(
      `WITH spent AS (
         UPDATE orders SET delivery_pin_attempts = delivery_pin_attempts + 1
          WHERE id = $1 AND delivery_pin_attempts < $2
          RETURNING delivery_pin, delivery_pin_attempts
       ) SELECT delivery_pin, delivery_pin_attempts FROM spent`,
      [orderId, PARCEL_PIN_MAX_ATTEMPTS],
    )) as Array<{ delivery_pin: string | null; delivery_pin_attempts: number }>;
    if (rows.length === 0) {
      throw deliveryPinLocked();
    }
    checkDeliveryPin({ pin: rows[0].delivery_pin, attemptsUsed: rows[0].delivery_pin_attempts }, given);
  }

  /**
   * Dispatcher completes a ride on the assigned driver's behalf — the panel's
   * "Yakunlash" button. Same settlement as the driver's own completion; a
   * parcel skips the PIN (the dispatcher has spoken to the recipient).
   */
  async completeByDispatcher(orderId: string): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);
    if (!order.driverId) {
      throw new BadRequestException('Order has no driver to complete it for');
    }
    this.logger.log(`Order ${orderId} completed by a dispatcher on behalf of driver ${order.driverId}`);
    return this.completeTrip(order.driverId, orderId, undefined, { byDispatcher: true });
  }
}
