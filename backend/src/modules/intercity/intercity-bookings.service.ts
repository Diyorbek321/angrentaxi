import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
import { agreedFareBreakdown } from '../tariffs/fare-breakdown';
import { CreateIntercityBookingDto } from './dto/create-intercity-booking.dto';
import { evaluateBooking, isLateCancel, seatReleaseOf } from './intercity-booking-policy';
import { IntercityBookingView, toIntercityBookingView } from './intercity-booking-view';
import { claimSeats, claimWholeCar, releaseSeats, returnedRows } from './intercity-seat-ledger';
import { IntercityNotifier } from './intercity-notifier';
import { IntercityBookingManageView, toIntercityBookingManageView } from './intercity-booking-manage-view';

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
  ) {}

  async book(
    passengerId: string,
    tripId: string,
    dto: CreateIntercityBookingDto,
    now: Date = new Date(),
  ): Promise<IntercityBookingView> {
    const settings = await this.settings.getIntercitySettings();
    if (!settings.intercityEnabled) throw this.disabled();

    const trip = await this.tripRepository.findOne({ where: { id: tripId }, relations: TRIP_RELATIONS });
    if (!trip?.route?.originPoint || !trip.route.destinationPoint || !trip.driver) {
      throw codedNotFound(ERROR_CODES.intercityTripNotFound, 'Qatnov topilmadi');
    }

    const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH;
    const evaluation = evaluateBooking(
      { kind: dto.kind, seats: dto.seats, paymentMethod, pickup: dto.pickup, dropoff: dto.dropoff },
      {
        trip,
        origin: trip.route.originPoint,
        destination: trip.route.destinationPoint,
        maxSeatsPerBooking: settings.intercityMaxSeatsPerBooking,
      },
    );
    if (!evaluation.ok) {
      throw codedBadRequest(
        ERROR_CODES.intercityBookingInvalid,
        evaluation.reasons.map((reason) => reason.message).join('; '),
        { reasons: evaluation.reasons },
      );
    }

    // Oddiy buyurtma bilan BIR XIL darvoza (`outstanding-wallet-debt.ts`).
    const debt = await outstandingWalletDebt(this.transactionRepository, passengerId);
    if (debt > 0) {
      throw new BadRequestException(
        `You have an unpaid balance of ${debt} so'm from a previous trip. ` +
          'Please top up your wallet before ordering again.',
      );
    }

    const tariffId = await this.intercityTariffId();
    const driverUserId = trip.driver.userId;
    const distanceKm = haversineDistance(dto.pickup.lat, dto.pickup.lng, dto.dropoff.lat, dto.dropoff.lng);
    const fare = agreedFareBreakdown(
      evaluation.price,
      Math.round(distanceKm * 100) / 100,
      Math.ceil(distanceKm * INTERCITY_MINUTES_PER_KM),
    );

    const orderId = await this.dataSource.transaction(async (manager) => {
      // Bitta yo'lovchining bir qatnovga ikki parallel bandini navbatga
      // qo'yadi — "faol bandi bormi" tekshiruvi bilan yozuv bitta qadam.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `intercity-book:${tripId}:${passengerId}`,
      ]);
      await this.assertNoActiveBooking(manager, tripId, passengerId);

      const claimed =
        dto.kind === IntercityBookingKind.WHOLE_CAR
          ? await claimWholeCar(manager, tripId, now)
          : await claimSeats(manager, tripId, evaluation.seats, now);
      if (!claimed) {
        throw codedConflict(
          ERROR_CODES.intercitySeatsUnavailable,
          dto.kind === IntercityBookingKind.WHOLE_CAR
            ? "Butun mashinani olib bo'lmaydi — o'rindiqlar allaqachon band"
            : "Bu qatnovda yetarli bo'sh joy qolmadi",
        );
      }

      const inserted = returnedRows<{ id: string }>(
        await manager.query(
          `INSERT INTO "orders" ("passenger_id", "driver_id", "tariff_id", "pickup_location", "dropoff_location",
             "pickup_address", "dropoff_address", "estimated_price", "status", "payment_method",
             "service_type", "fare_breakdown", "is_fixed_price", "scheduled_at",
             "intercity_trip_id", "seats", "booking_kind")
           VALUES ($1, $2, $3,
             ST_SetSRID(ST_MakePoint($4, $5), 4326),
             ST_SetSRID(ST_MakePoint($6, $7), 4326),
             $8, $9, $10, $11, $12, $13::jsonb, true, $14, $15, $16, $17)
           RETURNING "id"`,
          [
            passengerId,
            driverUserId,
            tariffId,
            dto.pickup.lng,
            dto.pickup.lat,
            dto.dropoff.lng,
            dto.dropoff.lat,
            dto.pickup.address,
            dto.dropoff.address,
            evaluation.price,
            // SCHEDULED: haydovchi allaqachon ma'lum, lekin u yo'lovchilarni
            // yig'ishni boshlaguncha (`start-boarding`) buyurtma haydovchini
            // BAND qilmaydi — u shu orada shahar ichida ishlay oladi.
            OrderStatus.SCHEDULED,
            paymentMethod,
            ServiceType.INTERCITY,
            JSON.stringify(fare),
            trip.departureAt,
            tripId,
            evaluation.seats,
            dto.kind,
          ],
        ),
      );
      return inserted[0].id;
    });
    // COMMIT'dan KEYIN: haydovchi bandni ko'radi, boshqa qidiruvchilar —
    // yangi bo'sh joylar sonini. Xabar yiqilsa ham band saqlangan (notifier
    // xato tashlamaydi).
    await this.notifier.bookingCreated({
      tripId,
      orderId,
      seats: evaluation.seats,
      bookingKind: dto.kind,
    });

    this.logger.log(
      `Intercity band ${orderId}: qatnov ${tripId}, ${evaluation.seats} joy (${dto.kind}), ${evaluation.price} so'm`,
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

  private async assertNoActiveBooking(manager: EntityManager, tripId: string, passengerId: string): Promise<void> {
    const existing = returnedRows<{ id: string }>(
      await manager.query(
        `SELECT "id" FROM "orders"
          WHERE "intercity_trip_id" = $1 AND "passenger_id" = $2
            AND "status" NOT IN ('completed', 'cancelled')
          LIMIT 1`,
        [tripId, passengerId],
      ),
    );
    if (existing.length > 0) {
      throw codedConflict(ERROR_CODES.intercityAlreadyBooked, 'Bu qatnovda sizning bandingiz allaqachon bor', {
        details: { orderId: existing[0].id },
      });
    }
  }

  private async getView(orderId: string, passengerId: string, now: Date): Promise<IntercityBookingView> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, passengerId },
      relations: { intercityTrip: TRIP_RELATIONS },
    });
    if (!order) throw this.bookingNotFound();
    return toIntercityBookingView(order, now);
  }

  /** 035 migratsiyasi qo'ygan "Shaharlararo" tarifi (`orders.tariff_id` NOT NULL). */
  private async intercityTariffId(): Promise<string> {
    const tariff = await this.tariffRepository.findOne({
      where: { serviceType: ServiceType.INTERCITY },
      select: { id: true },
      order: { createdAt: 'ASC' },
    });
    if (!tariff) {
      // Migratsiya tushmagan — konfiguratsiya xatosi, yo'lovchining emas.
      throw new InternalServerErrorException('Intercity tariff is missing (migration 035)');
    }
    return tariff.id;
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
