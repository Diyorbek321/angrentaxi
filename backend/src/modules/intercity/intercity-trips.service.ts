import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { And, DataSource, FindOperator, FindOptionsWhere, In, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import {
  ERROR_CODES,
  codedBadRequest,
  codedConflict,
  codedNotFound,
} from '../../common/errors/coded-error';
import { Driver } from '../../database/entities/driver.entity';
import {
  INTERCITY_TRIP_LIVE_STATUSES,
  IntercityTrip,
  IntercityTripStatus,
} from '../../database/entities/intercity-trip.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { SettingsService } from '../settings/settings.service';
import { CancelIntercityTripDto } from './dto/cancel-intercity-trip.dto';
import { ManageIntercityTripsQueryDto } from './dto/manage-intercity-trips-query.dto';
import { PublishIntercityTripDto } from './dto/publish-intercity-trip.dto';
import { IntercityDriverGate } from './intercity-driver-gate';
import { IntercityNotifier } from './intercity-notifier';
import { parseTashkentDate, tashkentDayRange } from './intercity-time';
import { evaluateTripPublish, findOverlappingDeparture } from './intercity-trip-policy';
import {
  IntercityTripManageView,
  IntercityTripView,
  IntercityTripWithRelations,
  toIntercityTripManageView,
  toIntercityTripView,
} from './intercity-trip-view';
import { returnedRows } from './intercity-seat-ledger';

/**
 * Comfort klass uchun haydovchi darajasi — taksi "Komfort" tarifining
 * `tier` i. Tarif topilmasa (o'chirilgan/qayta nomlangan) — 020 migratsiyasi
 * bergan qiymat: Start 1, Standart 2, Komfort 3.
 */
const COMFORT_TARIFF_NAME = 'Komfort';
const COMFORT_TIER_FALLBACK = 3;

/** Yo'lovchi qidiruvida juda yaqin qatnov ko'rsatilmaydi — band qilishga ulgurmaydi. */
const SEARCH_MIN_LEAD_MS = 5 * 60 * 1000;

const DEFAULT_PAGE_SIZE = 20;

/** Haydovchi bekor qilganda bandlarga yoziladigan sabab. */
const DRIVER_CANCELLED_BOOKING_REASON = 'Haydovchi qatnovni bekor qildi';

/**
 * Haydovchi bekor qila oladigan holatlar. `boarding` ham: yo'lovchilarni
 * yig'ayotganda mashina buzilishi mumkin — yo'lga chiqmaguncha qatnovni
 * to'xtatish mumkin bo'lishi kerak.
 */
const CANCELLABLE_BY_DRIVER_SQL = `'open', 'full', 'boarding'`;

/** Bandni bekor qilib bo'lmaydigan (allaqachon yakunlangan) holatlar. */
const FINISHED_ORDER_STATUSES: readonly OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED];

const TRIP_RELATIONS = {
  route: { originPoint: true, destinationPoint: true },
  driver: { user: true },
} as const;

export interface IntercityTripPage {
  items: IntercityTripView[];
  total: number;
  page: number;
  limit: number;
}

/** Menejer ro'yxati — haydovchi telefoni bilan (`toIntercityTripManageView`). */
export interface IntercityTripManagePage {
  items: IntercityTripManageView[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Toshkent kuni oralig'i — YARIM OCHIQ [boshi, oxiri). `Between` ikkala
 * chegarani ham kiritadi: ertasi 00:00 dagi qatnov ikki kunning ro'yxatida
 * chiqardi.
 */
function withinDay(from: Date, to: Date): FindOperator<Date> {
  return And(MoreThanOrEqual(from), LessThan(to));
}

/**
 * Shaharlararo qatnovlar: haydovchi e'lon qiladi, yo'lovchi qidiradi.
 *
 * Band qilish (o'rindiq hisobi) — 4-qadam; bu yerda faqat qatnovning o'zi.
 */
@Injectable()
export class IntercityTripsService {
  constructor(
    @InjectRepository(IntercityTrip)
    private readonly tripRepository: Repository<IntercityTrip>,
    @InjectRepository(IntercityRoute)
    private readonly routeRepository: Repository<IntercityRoute>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Tariff)
    private readonly tariffRepository: Repository<Tariff>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly gate: IntercityDriverGate,
    private readonly notifier: IntercityNotifier,
  ) {}

  // ---------------------------------------------------------------- haydovchi

  async publish(
    userId: string,
    dto: PublishIntercityTripDto,
    now: Date = new Date(),
  ): Promise<IntercityTripView> {
    await this.assertEnabled();
    const driver = await this.gate.loadPublisher(userId, now);
    const route = await this.findOpenRoute(dto.routeId);
    const settings = await this.settings.getIntercitySettings();
    const departureAt = new Date(dto.departureAt);

    const result = evaluateTripPublish({
      route,
      departureAt,
      now,
      tripClass: dto.tripClass,
      seatsTotal: dto.seatsTotal,
      driverTier: driver.approvedTariffTier,
      comfortTier: await this.resolveComfortTier(),
      minLeadMinutes: settings.intercityMinLeadMinutes,
      maxAheadDays: settings.intercityMaxAheadDays,
    });
    if (!result.ok) {
      throw codedBadRequest(
        ERROR_CODES.intercityTripInvalid,
        result.reasons.map((reason) => reason.message).join('; '),
        { reasons: result.reasons },
      );
    }

    // ⚠️ Bir vaqtdagi ikki e'lon ikkalasi ham shu tekshiruvdan o'tishi
    // mumkin (o'qib-yozish). Oqibati — haydovchining o'zi ikki qatnov
    // e'lon qilgani, pul yoki o'rindiq xavfi yo'q; ATAYLAB qulfsiz.
    const others = await this.tripRepository.find({
      where: { driverId: driver.id, status: In([...INTERCITY_TRIP_LIVE_STATUSES]) },
      select: { id: true, departureAt: true },
    });
    const overlap = findOverlappingDeparture(
      departureAt,
      others.map((other) => other.departureAt),
    );
    if (overlap) {
      throw codedConflict(
        ERROR_CODES.intercityTripOverlap,
        "Shu vaqtga yaqin (±3 soat) boshqa qatnovingiz bor",
        { details: { otherDepartureAt: overlap.toISOString() } },
      );
    }

    const saved = await this.tripRepository.save(
      this.tripRepository.create({
        routeId: route.id,
        driverId: driver.id,
        tripClass: dto.tripClass,
        departureAt,
        seatsTotal: result.seatsTotal,
        seatsTaken: 0,
        wholeCarBooked: false,
        status: IntercityTripStatus.OPEN,
        seatPrice: result.seatPrice,
        wholeCarPrice: result.wholeCarPrice,
        cancelReason: null,
      }),
    );
    return toIntercityTripView({ ...saved, route, driver });
  }

  async listMine(
    userId: string,
    pagination: { page?: number; limit?: number },
  ): Promise<IntercityTripPage> {
    await this.assertEnabled();
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return this.page({ driverId: driver.id }, pagination, 'DESC');
  }

  /**
   * Haydovchi o'z qatnovini bekor qiladi — faqat yo'lga chiqmasdan
   * (`open`/`full`/`boarding`). Bog'langan bandlar SHU tranzaksiyada bekor qilinadi:
   * qatnov bekor, band esa "tirik" qolib ketishi yo'lovchini kutib
   * qoldirardi.
   *
   * Holat sharti UPDATE ning o'zida — o'qib-tekshirib-yozish emas: haydovchi
   * "Bekor qilish" ni bosgan lahzada yo'lovchi band qilayotgan bo'lishi
   * mumkin (4-qadam ham shu qatorni shartli UPDATE bilan o'zgartiradi).
   */
  async cancelByDriver(
    userId: string,
    tripId: string,
    reason: CancelIntercityTripDto['reason'],
    now: Date = new Date(),
  ): Promise<IntercityTripView> {
    await this.assertEnabled();
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    const cancelled = await this.dataSource.transaction(async (manager): Promise<string[] | null> => {
      // ⚠️ `returnedRows`: UPDATE ... RETURNING natijasi `[rows, count]` —
      // `result.length === 0` bu yerda hech qachon rost bo'lmasdi va yo'lga
      // chiqqan qatnovning bandlari ham jimgina bekor qilinardi.
      const rows = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE "intercity_trips"
              SET "status" = 'cancelled', "cancel_reason" = $3, "cancelled_at" = $4, "updated_at" = now()
            WHERE "id" = $1 AND "driver_id" = $2 AND "status" IN (${CANCELLABLE_BY_DRIVER_SQL})
            RETURNING "id"`,
          [tripId, driver.id, reason, now],
        ),
      );
      if (rows.length === 0) return null;
      const closedBookings = returnedRows<{ passenger_id: string }>(
        await manager.query(
          `UPDATE "orders"
              SET "status" = $2, "cancel_reason" = $3, "updated_at" = now()
            WHERE "intercity_trip_id" = $1 AND "status" NOT IN (${FINISHED_ORDER_STATUSES.map(
              (_, index) => `$${index + 4}`,
            ).join(', ')})
            RETURNING "passenger_id"`,
          [tripId, OrderStatus.CANCELLED, DRIVER_CANCELLED_BOOKING_REASON, ...FINISHED_ORDER_STATUSES],
        ),
      );
      return closedBookings.map((booking) => booking.passenger_id);
    });

    if (cancelled) {
      // Tranzaksiyadan keyin bu yo'lovchilar endi "faol" emas — ro'yxat shu
      // UPDATE ning o'zidan olinadi.
      await this.notifier.tripCancelled(tripId, reason, cancelled, 'driver');
    } else {
      const existing = await this.tripRepository.findOne({ where: { id: tripId, driverId: driver.id } });
      if (!existing) throw this.notFound();
      throw codedConflict(
        ERROR_CODES.intercityTripNotCancellable,
        "Yo'lga chiqqan yoki yakunlangan qatnovni bekor qilib bo'lmaydi",
        { details: { status: existing.status } },
      );
    }
    return this.getView(tripId);
  }

  // ---------------------------------------------------------------- yo'lovchi

  /** Berilgan Toshkent kunidagi ochiq qatnovlar, jo'nash vaqti bo'yicha. */
  async search(routeId: string, date: string, now: Date = new Date()): Promise<IntercityTripView[]> {
    await this.assertEnabled();
    if (parseTashkentDate(date) === null) {
      throw new BadRequestException("Sana noto'g'ri (YYYY-MM-DD)");
    }
    const { from, to } = tashkentDayRange(date);
    const earliest = new Date(Math.max(from.getTime(), now.getTime() + SEARCH_MIN_LEAD_MS));
    if (earliest >= to) return [];

    const trips = await this.tripRepository.find({
      where: {
        routeId,
        status: IntercityTripStatus.OPEN,
        departureAt: withinDay(earliest, to),
      },
      relations: TRIP_RELATIONS,
      order: { departureAt: 'ASC' },
    });
    return trips.map(toIntercityTripView);
  }

  async getPublic(tripId: string, _now: Date = new Date()): Promise<IntercityTripView> {
    await this.assertEnabled();
    return this.getView(tripId);
  }

  // ---------------------------------------------------------------- menejer

  async listForManage(query: ManageIntercityTripsQueryDto): Promise<IntercityTripManagePage> {
    await this.assertEnabled();
    const where: FindOptionsWhere<IntercityTrip> = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.date && parseTashkentDate(query.date)
        ? (() => {
            const { from, to } = tashkentDayRange(query.date);
            return { departureAt: withinDay(from, to) };
          })()
        : {}),
    };
    return this.page(where, query, 'ASC', toIntercityTripManageView);
  }

  // ---------------------------------------------------------------- ichki

  private async page<V = IntercityTripView>(
    where: FindOptionsWhere<IntercityTrip>,
    pagination: { page?: number; limit?: number },
    direction: 'ASC' | 'DESC',
    toView: (trip: IntercityTripWithRelations) => V = toIntercityTripView as unknown as (
      trip: IntercityTripWithRelations,
    ) => V,
  ): Promise<{ items: V[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = pagination.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, total] = await this.tripRepository.findAndCount({
      where,
      relations: TRIP_RELATIONS,
      order: { departureAt: direction },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: rows.map(toView), total, page, limit };
  }

  async getView(tripId: string): Promise<IntercityTripView> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId }, relations: TRIP_RELATIONS });
    if (!trip) throw this.notFound();
    return toIntercityTripView(trip);
  }

  /** Faol yo'nalish, ikkala uchi ham faol — aks holda 404. */
  private async findOpenRoute(routeId: string): Promise<IntercityRoute> {
    const route = await this.routeRepository.findOne({
      where: { id: routeId, isActive: true },
      relations: { originPoint: true, destinationPoint: true },
    });
    if (!route || !route.originPoint?.isActive || !route.destinationPoint?.isActive) {
      throw new NotFoundException("Yo'nalish topilmadi yoki faol emas");
    }
    return route;
  }

  private async resolveComfortTier(): Promise<number> {
    const tariff = await this.tariffRepository.findOne({
      where: { serviceType: ServiceType.TAXI, name: COMFORT_TARIFF_NAME, isActive: true },
      select: { id: true, tier: true },
    });
    return tariff?.tier ?? COMFORT_TIER_FALLBACK;
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.settings.isIntercityEnabled())) {
      throw codedNotFound(ERROR_CODES.intercityDisabled, 'Shaharlararo qatnov hozircha mavjud emas');
    }
  }

  private notFound() {
    return codedNotFound(ERROR_CODES.intercityTripNotFound, 'Qatnov topilmadi');
  }
}
