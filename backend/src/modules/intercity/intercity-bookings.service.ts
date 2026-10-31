import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ERROR_CODES,
  codedBadRequest,
  codedConflict,
  codedNotFound,
} from '../../common/errors/coded-error';
import { IntercityTrip } from '../../database/entities/intercity-trip.entity';
import {
  IntercityBookingKind,
  Order,
  OrderStatus,
  PaymentMethod,
  ServiceType,
} from '../../database/entities/order.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { haversineDistance } from '../orders/orders.distance.util';
import { outstandingWalletDebt } from '../orders/outstanding-wallet-debt';
import { SettingsService } from '../settings/settings.service';
import { FareBreakdown, IntercityExtensionCharge } from '../tariffs/fare-breakdown';
import { CreateIntercityBookingDto } from './dto/create-intercity-booking.dto';
import { evaluateBooking, isLateCancel, seatReleaseOf } from './intercity-booking-policy';
import { IntercityBookingView, toIntercityBookingView } from './intercity-booking-view';
import { claimSeats, claimWholeCar, lockTripForCompletion, releaseSeats, returnedRows } from './intercity-seat-ledger';
import { BookingFit, FitTrip, IntercityFitService } from './intercity-fit.service';
import { IntercityZonesService } from './intercity-zones.service';
import { IntercityNotifier } from './intercity-notifier';
import { IntercityBookingManageView, toIntercityBookingManageView } from './intercity-booking-manage-view';
import { composeIntercityFare } from './intercity-extension';
import { assertNoActiveBooking, insertBookingOrder, intercityTariffId } from './intercity-booking-writer';
import { IntercityExtensionPricer } from './intercity-extension-pricer';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { Driver } from '../../database/entities/driver.entity';

const DEFAULT_PAGE_SIZE = 20;

/** Yo'lovchi bekor qilganda buyurtmaga yoziladigan sabab. */
export const PASSENGER_CANCELLED_BOOKING_REASON = "Yo'lovchi bandni bekor qildi";

/**
 * Kech bekor qilish belgisi (`orders.fraud_signals`). Naqd pilotda jarima
 * yo'q — belgi menejerga takroriy "band qilib kelmaydigan" yo'lovchini
 * ko'rsatadi (B reja: N martadan keyin oldindan to'lov talab qilish).
 *
 * ⚠️ `fraud_review` ga TEGILMAYDI: bu yakunlangan safar firibgarligi emas,
 * ko'rib chiqish navbatiga tushmasligi kerak.
 */
export const INTERCITY_LATE_CANCEL_SIGNAL = 'intercity_late_cancel';

/**
 * Taxminiy davomiylik (daqiqa/km) — faqat chekdagi ma'lumot uchun, narxga
 * ta'sir qilmaydi (narx qat'iy). Trassa tezligi ~50 km/soat.
 */
const INTERCITY_MINUTES_PER_KM = 1.2;

const TRIP_RELATIONS = {
  route: { originPoint: true, destinationPoint: true },
  driver: { user: true },
} as const;

interface ReleasedBooking {
  intercity_trip_id: string;
  seats: number | null;
  booking_kind: IntercityBookingKind | null;
}

/** Dispetcher bekor qilganda buyurtmaga yoziladigan sabab prefiksi. */
export const DISPATCHER_CANCELLED_BOOKING_REASON = 'Dispetcher bekor qildi';

/** `POST /intercity/trips/:id/quote` — band qilishdan OLDIN ko'rsatiladigan narx. */
export interface IntercityQuoteView {
  tripId: string;
  kind: IntercityBookingKind;
  seats: number;
  /** Qat'iy narx (nuqtadan nuqtagacha). */
  basePrice: number;
  /** "Shahar ichiga davom" qatorlari — bo'sh bo'lsa davom yo'q. */
  extensions: IntercityExtensionCharge[];
  total: number;
  /** Manzil haydovchi tanlagan tumanlardami (false bo'lsa band 409 bo'ladi). */
  zoneOk: boolean;
  /** Mos bo'lmagan tomon va qatnov boradigan tumanlar. */
  outOfZone: { side: 'origin' | 'destination'; zoneNames: string[] } | null;
  /** O'rindiq bandi mashinani shahar ichida shuncha daqiqa ortiqcha aylantiradi. */
  detourMinutes: number | null;
  /** false — marshrut xizmati javob bermadi (band baribir o'tadi). */
  detourChecked: boolean;
  detourTooLong: boolean;
  /** Sozlama: 0 — aylanma tekshiruvi o'chiq. */
  maxDetourMinutes: number;
}

/** Band uchun yuklangan qatnov — yo'nalish, ikkala nuqta va haydovchi BOR. */
type BookableTrip = IntercityTrip & {
  route: IntercityRoute & { originPoint: IntercityPoint; destinationPoint: IntercityPoint };
  driver: Driver;
};

interface PricedBooking {
  seats: number;
  fare: FareBreakdown;
}

export interface IntercityBookingPage {
  items: IntercityBookingView[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Shaharlararo band: yo'lovchi qatnovdan o'rindiq(lar) yoki butun mashinani
 * oladi. Har bir band — `orders` qatori (komissiya, 1% soliq ushlash va
 * fiskal chek buyurtma bo'yicha yoziladi), o'rindiq hisobi esa
 * `intercity_trips` da (`intercity-seat-ledger.ts`).
 */
@Injectable()
export class IntercityBookingsService {
  private readonly logger = new Logger(IntercityBookingsService.name);

  constructor(
    @InjectRepository(IntercityTrip)
    private readonly tripRepository: Repository<IntercityTrip>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Tariff)
    private readonly tariffRepository: Repository<Tariff>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly notifier: IntercityNotifier,
    private readonly extensionPricer: IntercityExtensionPricer,
    private readonly fit: IntercityFitService,
    private readonly zones: IntercityZonesService,
  ) {}

  /**
   * Band qilmasdan narx: ilova tasdiqlash tugmasidan oldin ko'rsatadi.
   * `book` AYNAN shu hisobni qayta bajaradi — mijoz yuborgan raqamlarga
   * hech qachon ishonilmaydi.
   */
  async quote(tripId: string, dto: CreateIntercityBookingDto): Promise<IntercityQuoteView> {
    const settings = await this.settings.getIntercitySettings();
    if (!settings.intercityEnabled) throw this.disabled();
    const trip = await this.loadTripForBooking(tripId);
    const priced = await this.priceBooking(trip, dto, settings.intercityMaxSeatsPerBooking);
    const fit = await this.fit.check({
      trip: this.fitTrip(trip),
      zones: await this.zones.zonesOfTrip(tripId),
      pickup: dto.pickup,
      dropoff: dto.dropoff,
      seatBooking: dto.kind === IntercityBookingKind.SEAT,
      maxDetourMinutes: settings.intercityMaxDetourMinutes,
    });
    return {
      tripId,
      kind: dto.kind,
      seats: priced.seats,
      basePrice: priced.fare.baseFare,
      extensions: priced.fare.intercityExtensions ?? [],
      total: priced.fare.total,
      zoneOk: fit.zoneOk,
      outOfZone: fit.outOfZone,
      detourMinutes: fit.detourMinutes,
      detourChecked: fit.detourChecked,
      detourTooLong: fit.detourTooLong,
      maxDetourMinutes: settings.intercityMaxDetourMinutes,
    };
  }

  async book(
    passengerId: string,
    tripId: string,
    dto: CreateIntercityBookingDto,
    now: Date = new Date(),
  ): Promise<IntercityBookingView> {
    const settings = await this.settings.getIntercitySettings();
    if (!settings.intercityEnabled) throw this.disabled();

    const trip = await this.loadTripForBooking(tripId);
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH;
    const { seats, fare } = await this.priceBooking(trip, dto, settings.intercityMaxSeatsPerBooking);

    // Tumanlar — tranzaksiyadan OLDIN (tarmoqsiz, qatnov tumanlari e'londan
    // keyin o'zgarmaydi). Aylanma esa quyida, qatnov qatori qulfi ostida.
    const zones = await this.zones.zonesOfTrip(tripId);
    const zoneFit = await this.fit.check({
      trip: this.fitTrip(trip),
      zones,
      pickup: dto.pickup,
      dropoff: dto.dropoff,
      seatBooking: false,
      maxDetourMinutes: 0,
    });
    if (!zoneFit.zoneOk) throw this.outOfZone(zoneFit);
    const measureDetour = dto.kind === IntercityBookingKind.SEAT && settings.intercityMaxDetourMinutes > 0;

    // Oddiy buyurtma bilan BIR XIL darvoza (`outstanding-wallet-debt.ts`).
    const debt = await outstandingWalletDebt(this.transactionRepository, passengerId);
    if (debt > 0) {
      throw new BadRequestException(
        `You have an unpaid balance of ${debt} so'm from a previous trip. ` +
          'Please top up your wallet before ordering again.',
      );
    }

    const tariffId = await intercityTariffId(this.tariffRepository);
    const driverUserId = trip.driver.userId;

    const orderId = await this.dataSource.transaction(async (manager) => {
      // Bitta yo'lovchining bir qatnovga ikki parallel bandini navbatga
      // qo'yadi — "faol bandi bormi" tekshiruvi bilan yozuv bitta qadam.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `intercity-book:${tripId}:${passengerId}`,
      ]);
      await assertNoActiveBooking(manager, tripId, passengerId);

      if (measureDetour) {
        // ⚠️ Qatnov qatori QULFI ostida: ikki parallel band bir-birining
        // manzilini ko'rmay, ikkalasi ham "aylanma yo'q" deb o'tib ketmasin.
        // Qulfdan keyingi SELECT (READ COMMITTED) avvalgisining yozuvini ko'radi.
        await lockTripForCompletion(manager, tripId);
        const detour = await this.fit.check({
          trip: this.fitTrip(trip),
          zones,
          pickup: dto.pickup,
          dropoff: dto.dropoff,
          seatBooking: true,
          maxDetourMinutes: settings.intercityMaxDetourMinutes,
          executor: manager,
        });
        if (detour.detourTooLong) {
          throw codedConflict(
            ERROR_CODES.intercityDetourTooLong,
            `Bu qatnov sizning manzilingizga katta aylanma qiladi (+${detour.detourMinutes} daqiqa). Boshqa qatnovni tanlang`,
            { details: { addedMinutes: detour.detourMinutes, limit: settings.intercityMaxDetourMinutes } },
          );
        }
      }

      const claimed =
        dto.kind === IntercityBookingKind.WHOLE_CAR
          ? await claimWholeCar(manager, tripId, now)
          : await claimSeats(manager, tripId, seats, now);
      if (!claimed) {
        throw codedConflict(
          ERROR_CODES.intercitySeatsUnavailable,
          dto.kind === IntercityBookingKind.WHOLE_CAR
            ? "Butun mashinani olib bo'lmaydi — o'rindiqlar allaqachon band"
            : "Bu qatnovda yetarli bo'sh joy qolmadi",
        );
      }

      return insertBookingOrder(manager, {
        passengerId,
        driverUserId,
        tariffId,
        tripId,
        departureAt: trip.departureAt,
        seats,
        kind: dto.kind,
        pickup: dto.pickup,
        dropoff: dto.dropoff,
        fare,
        paymentMethod,
      });
    });
    // COMMIT'dan KEYIN: haydovchi bandni ko'radi, boshqa qidiruvchilar —
    // yangi bo'sh joylar sonini. Xabar yiqilsa ham band saqlangan (notifier
    // xato tashlamaydi).
    await this.notifier.bookingCreated({
      tripId,
      orderId,
      seats,
      bookingKind: dto.kind,
    });

    this.logger.log(
      `Intercity band ${orderId}: qatnov ${tripId}, ${seats} joy (${dto.kind}), ${fare.total} so'm`,
    );
    return this.getView(orderId, passengerId, now);
  }

  async listMine(
    passengerId: string,
    pagination: { page?: number; limit?: number },
    now: Date = new Date(),
  ): Promise<IntercityBookingPage> {
    await this.assertEnabled();
    const page = Math.max(1, pagination.page ?? 1);
    const limit = pagination.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, total] = await this.orderRepository.findAndCount({
      where: { passengerId, serviceType: ServiceType.INTERCITY },
      relations: { intercityTrip: TRIP_RELATIONS },
      order: { scheduledAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: rows.map((row) => toIntercityBookingView(row, now)), total, page, limit };
  }

  /**
   * Yo'lovchi bandini bekor qiladi — faqat yig'ish boshlanmaguncha (buyurtma
   * SCHEDULED). Buyurtma bekor + joylar qaytadi — BITTA tranzaksiyada:
   * aks holda joy "yo'qolib" qolardi yoki ikki marta qaytardi.
   */
  async cancel(passengerId: string, orderId: string, now: Date = new Date()): Promise<IntercityBookingView> {
    const settings = await this.settings.getIntercitySettings();
    if (!settings.intercityEnabled) throw this.disabled();

    const order = await this.orderRepository.findOne({
      where: { id: orderId, passengerId, serviceType: ServiceType.INTERCITY },
      relations: { intercityTrip: true },
    });
    if (!order) throw this.bookingNotFound();
    if (order.status !== OrderStatus.SCHEDULED) throw this.notCancellable(order.status);

    const departureAt = order.intercityTrip?.departureAt ?? order.scheduledAt ?? now;
    const late = isLateCancel(departureAt, now, settings.intercityFreeCancelMinutes);

    const released = await this.releaseBooking(orderId, passengerId, PASSENGER_CANCELLED_BOOKING_REASON, late, now);
    await this.notifier.bookingCancelled({
      tripId: released.intercity_trip_id,
      orderId,
      seats: released.seats ?? 0,
      bookingKind: released.booking_kind ?? IntercityBookingKind.SEAT,
    });

    if (late) {
      this.logger.warn(`Intercity band ${orderId}: kech bekor qilindi (jo'nashga ${settings.intercityFreeCancelMinutes} daqiqadan kam)`);
    }
    return this.getView(orderId, passengerId, now);
  }

  /**
   * Dispetcher yo'lovchining SCHEDULED bandini bekor qiladi (masalan,
   * telefon orqali so'raldi). Yo'lovchi yo'li bilan AYNI tranzaksiya —
   * joylar qaytadi; kech bekor qilish belgisi QO'YILMAYDI (yo'lovchi aybdor
   * emas bo'lishi mumkin), sabab buyurtmaga yoziladi.
   */
  async cancelForManage(orderId: string, reason: string, now: Date = new Date()): Promise<IntercityBookingManageView> {
    await this.assertEnabled();
    const order = await this.orderRepository.findOne({
      where: { id: orderId, serviceType: ServiceType.INTERCITY },
    });
    if (!order) throw this.bookingNotFound();
    if (order.status !== OrderStatus.SCHEDULED) throw this.notCancellable(order.status);

    const released = await this.releaseBooking(
      orderId,
      order.passengerId,
      `${DISPATCHER_CANCELLED_BOOKING_REASON}: ${reason}`,
      false,
      now,
    );
    await this.notifier.bookingCancelled({
      tripId: released.intercity_trip_id,
      orderId,
      seats: released.seats ?? 0,
      bookingKind: released.booking_kind ?? IntercityBookingKind.SEAT,
    });
    await this.notifier.bookingCancelledByDispatcher(order.passengerId, released.intercity_trip_id, orderId, reason);

    const reloaded = await this.orderRepository.findOne({ where: { id: orderId }, relations: { passenger: true } });
    return toIntercityBookingManageView(reloaded ?? order);
  }

  /** Dispetcher: qatnovning BARCHA bandlari (bekor qilinganlari ham), yo'lovchi telefoni bilan. */
  async listForManage(tripId: string): Promise<IntercityBookingManageView[]> {
    await this.assertEnabled();
    const trip = await this.tripRepository.findOne({ where: { id: tripId }, select: { id: true } });
    if (!trip) throw codedNotFound(ERROR_CODES.intercityTripNotFound, 'Qatnov topilmadi');
    const orders = await this.orderRepository.find({
      where: { intercityTripId: tripId, serviceType: ServiceType.INTERCITY },
      relations: { passenger: true },
      order: { createdAt: 'ASC' },
    });
    return orders.map(toIntercityBookingManageView);
  }

  // ---------------------------------------------------------------- ichki

  /**
   * SCHEDULED bandni bekor qiladi va joylarni qaytaradi — BITTA tranzaksiyada:
   * aks holda joy "yo'qolib" qolardi yoki ikki marta qaytardi. Yo'lovchi va
   * dispetcher yo'llari shu bitta joydan o'tadi.
   */
  private releaseBooking(
    orderId: string,
    passengerId: string,
    reason: string,
    late: boolean,
    now: Date,
  ): Promise<ReleasedBooking> {
    return this.dataSource.transaction(async (manager) => {
      const rows = returnedRows<{ intercity_trip_id: string; seats: number | null; booking_kind: IntercityBookingKind | null }>(
        await manager.query(
          `UPDATE "orders"
              SET "status" = $3, "cancel_reason" = $4, "updated_at" = now(),
                  "fraud_signals" = CASE WHEN $5 THEN COALESCE("fraud_signals", '[]'::jsonb) || $6::jsonb
                                         ELSE "fraud_signals" END
            WHERE "id" = $1 AND "passenger_id" = $2 AND "status" = 'scheduled'
              AND "intercity_trip_id" IS NOT NULL
            RETURNING "intercity_trip_id", "seats", "booking_kind"`,
          [
            orderId,
            passengerId,
            OrderStatus.CANCELLED,
            reason,
            late,
            JSON.stringify([INTERCITY_LATE_CANCEL_SIGNAL]),
          ],
        ),
      );
      // Tekshiruv va yozuv orasida haydovchi yig'ishni boshlagan bo'lishi mumkin.
      if (rows.length === 0) throw this.notCancellable(OrderStatus.ACCEPTED);
      const row = rows[0];
      await releaseSeats(
        manager,
        row.intercity_trip_id,
        seatReleaseOf({ bookingKind: row.booking_kind, seats: row.seats }),
        now,
      );
      return row;
    });
  }

  private fitTrip(trip: BookableTrip): FitTrip {
    return { id: trip.id, origin: trip.route.originPoint, destination: trip.route.destinationPoint };
  }

  private outOfZone(fit: BookingFit) {
    const zoneNames = fit.outOfZone?.zoneNames ?? [];
    return codedConflict(
      ERROR_CODES.intercityOutOfZone,
      `Bu qatnov sizning tumaningizga bormaydi (faqat: ${zoneNames.join(', ')}). Boshqa qatnovni tanlang`,
      { details: { side: fit.outOfZone?.side ?? null, zones: zoneNames.join(', ') } },
    );
  }

  private async loadTripForBooking(tripId: string): Promise<BookableTrip> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId }, relations: TRIP_RELATIONS });
    if (!trip?.route?.originPoint || !trip.route.destinationPoint || !trip.driver) {
      throw codedNotFound(ERROR_CODES.intercityTripNotFound, 'Qatnov topilmadi');
    }
    return trip as BookableTrip;
  }

  /**
   * Qoidalar + qat'iy narx + "shahar ichiga davom" (nuqta radiusidan
   * tashqaridagi har tomon uchun yo'l km haqi). `quote` va `book` uchun
   * YAGONA hisob — ikkalasi bir xil raqam beradi.
   */
  private async priceBooking(
    trip: BookableTrip,
    dto: CreateIntercityBookingDto,
    maxSeatsPerBooking: number,
  ): Promise<PricedBooking> {
    const origin = trip.route.originPoint;
    const destination = trip.route.destinationPoint;
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH;
    const evaluation = evaluateBooking(
      { kind: dto.kind, seats: dto.seats, paymentMethod, pickup: dto.pickup, dropoff: dto.dropoff },
      { trip, origin, destination, maxSeatsPerBooking },
    );
    if (!evaluation.ok) {
      throw codedBadRequest(
        ERROR_CODES.intercityBookingInvalid,
        evaluation.reasons.map((reason) => reason.message).join('; '),
        { reasons: evaluation.reasons },
      );
    }

    const extensions = await Promise.all([
      ...(evaluation.pickupZone === 'extension'
        ? [this.extensionPricer.charge('pickup', origin, trip.tripClass, dto.pickup)]
        : []),
      ...(evaluation.dropoffZone === 'extension'
        ? [this.extensionPricer.charge('dropoff', destination, trip.tripClass, dto.dropoff)]
        : []),
    ]);
    const distanceKm = haversineDistance(dto.pickup.lat, dto.pickup.lng, dto.dropoff.lat, dto.dropoff.lng);
    return {
      seats: evaluation.seats,
      fare: composeIntercityFare(evaluation.price, extensions, Math.ceil(distanceKm * INTERCITY_MINUTES_PER_KM)),
    };
  }

  private async getView(orderId: string, passengerId: string, now: Date): Promise<IntercityBookingView> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, passengerId },
      relations: { intercityTrip: TRIP_RELATIONS },
    });
    if (!order) throw this.bookingNotFound();
    return toIntercityBookingView(order, now);
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.settings.isIntercityEnabled())) throw this.disabled();
  }

  private disabled() {
    return codedNotFound(ERROR_CODES.intercityDisabled, 'Shaharlararo qatnov hozircha mavjud emas');
  }

  private bookingNotFound() {
    return codedNotFound(ERROR_CODES.intercityBookingNotFound, 'Band topilmadi');
  }

  private notCancellable(status: OrderStatus) {
    return codedConflict(
      ERROR_CODES.intercityBookingNotCancellable,
      "Haydovchi yo'lovchilarni yig'ishni boshlagan — bandni endi ilovadan bekor qilib bo'lmaydi",
      { details: { status } },
    );
  }
}
