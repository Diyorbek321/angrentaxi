import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, MoreThan, Repository } from 'typeorm';
import { ERROR_CODES, ErrorReason, codedBadRequest, codedConflict, codedNotFound } from '../../common/errors/coded-error';
import { IntercityRequest, IntercityRequestStatus } from '../../database/entities/intercity-request.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { IntercityBookingKind, PaymentMethod } from '../../database/entities/order.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { haversineDistance } from '../orders/orders.distance.util';
import { outstandingWalletDebt } from '../orders/outstanding-wallet-debt';
import { SettingsService } from '../settings/settings.service';
import { FareBreakdown } from '../tariffs/fare-breakdown';
import {
  CreateIntercityRequestDto,
  IntercityRequestBoardQueryDto,
  ManageIntercityRequestsQueryDto,
} from './dto/intercity-request.dto';
import { evaluateBooking } from './intercity-booking-policy';
import { composeIntercityFare } from './intercity-extension';
import { IntercityExtensionPricer } from './intercity-extension-pricer';
import { IntercityNotifier } from './intercity-notifier';
import {
  INTERCITY_REQUEST_REASONS,
  evaluateBonusRaise,
  evaluateRequestWindow,
  maxRequestBonus,
  routePricesFor,
} from './intercity-request-policy';
import {
  IntercityRequestManageView,
  IntercityRequestView,
  toIntercityRequestManageView,
  toIntercityRequestView,
} from './intercity-request-view';
import { returnedRows } from './intercity-seat-ledger';
import { IntercityTripsService } from './intercity-trips.service';
import { IntercityDriverGate } from './intercity-driver-gate';

/** Chekdagi taxminiy davomiylik (`intercity-bookings.service.ts` bilan bir xil). */
const INTERCITY_MINUTES_PER_KM = 1.2;

const DEFAULT_PAGE_SIZE = 20;

/** Doskada bir vaqtda ko'rsatiladigan so'rovlar — pilotda yetarli, yuk cheklangan. */
const BOARD_LIMIT = 100;

/** Bir tick'da eskiradigan so'rovlar. */
const EXPIRY_BATCH = 200;

const REQUEST_RELATIONS = { route: { originPoint: true, destinationPoint: true } } as const;

type PricedRoute = IntercityRoute & { originPoint: IntercityPoint; destinationPoint: IntercityPoint };

/** `POST /intercity/requests/quote` — so'rov qoldirishdan oldingi narx. */
export interface IntercityRequestQuoteView {
  seats: number;
  basePrice: number;
  extensions: FareBreakdown['intercityExtensions'];
  bonus: number;
  total: number;
  maxBonus: number;
}

export interface IntercityRequestPage<V = IntercityRequestView> {
  items: V[];
  total: number;
  page: number;
  limit: number;
}

interface PricedRequest {
  seats: number;
  fare: FareBreakdown;
}

/**
 * Yo'lovchi so'rovlari doskasi: so'rov qoldirish, narxni oshirish, bekor
 * qilish, doskani ko'rish va eskirish. Qabul qilish —
 * `IntercityRequestAcceptService` (u band yaratadi).
 */
@Injectable()
export class IntercityRequestsService {
  private readonly logger = new Logger(IntercityRequestsService.name);

  constructor(
    @InjectRepository(IntercityRequest)
    private readonly requestRepository: Repository<IntercityRequest>,
    @InjectRepository(IntercityRoute)
    private readonly routeRepository: Repository<IntercityRoute>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly extensionPricer: IntercityExtensionPricer,
    private readonly notifier: IntercityNotifier,
    private readonly trips: IntercityTripsService,
    private readonly gate: IntercityDriverGate,
  ) {}

  // ---------------------------------------------------------------- yo'lovchi

  async quote(dto: CreateIntercityRequestDto): Promise<IntercityRequestQuoteView> {
    await this.assertEnabled();
    const settings = await this.settings.getIntercitySettings();
    const route = await this.findOpenRoute(dto.routeId);
    const priced = await this.price(route, dto, settings.intercityMaxSeatsPerBooking);
    const bonus = dto.bonus ?? 0;
    if (bonus > 0) {
      const bonusReasons = evaluateBonusRaise(0, bonus, priced.fare.total);
      if (bonusReasons.length > 0) throw this.invalid(bonusReasons);
    }
    return {
      seats: priced.seats,
      basePrice: priced.fare.total,
      extensions: priced.fare.intercityExtensions ?? [],
      bonus,
      total: priced.fare.total + bonus,
      maxBonus: maxRequestBonus(priced.fare.total),
    };
  }

  async create(passengerId: string, dto: CreateIntercityRequestDto, now: Date = new Date()): Promise<IntercityRequestView> {
    await this.assertEnabled();
    const settings = await this.settings.getIntercitySettings();
    const route = await this.findOpenRoute(dto.routeId);
    const windowStart = new Date(dto.windowStart);
    const windowEnd = new Date(dto.windowEnd);

    const windowReasons = evaluateRequestWindow({ windowStart, windowEnd, now, maxAheadDays: settings.intercityMaxAheadDays });
    if (windowReasons.length > 0) throw this.invalid(windowReasons);
    const { seats, fare } = await this.price(route, dto, settings.intercityMaxSeatsPerBooking);

    const bonus = dto.bonus ?? 0;
    if (bonus > 0) {
      const bonusReasons = evaluateBonusRaise(0, bonus, fare.total);
      if (bonusReasons.length > 0) throw this.invalid(bonusReasons);
    }

    // Oddiy band bilan BIR XIL darvoza (`outstanding-wallet-debt.ts`).
    const debt = await outstandingWalletDebt(this.transactionRepository, passengerId);
    if (debt > 0) {
      throw new BadRequestException(
        `You have an unpaid balance of ${debt} so'm from a previous trip. ` +
          'Please top up your wallet before ordering again.',
      );
    }

    const open = await this.requestRepository.findOne({
      where: { passengerId, status: IntercityRequestStatus.OPEN },
      select: { id: true },
    });
    if (open) throw this.alreadyOpen(open.id);

    let saved: IntercityRequest;
    try {
      saved = await this.requestRepository.save(
        this.requestRepository.create({
          passengerId,
          routeId: route.id,
          tripClass: dto.tripClass ?? IntercityTripClass.START,
          kind: dto.kind,
          seats,
          pickupLat: dto.pickup.lat,
          pickupLng: dto.pickup.lng,
          pickupAddress: dto.pickup.address,
          dropoffLat: dto.dropoff.lat,
          dropoffLng: dto.dropoff.lng,
          dropoffAddress: dto.dropoff.address,
          // "Hoziroq" so'rov: o'tib ketgan boshi hozirga suriladi — doskada
          // "08:40 dan" emas, haqiqiy eng erta vaqt ko'rinsin.
          windowStart: windowStart < now ? now : windowStart,
          windowEnd,
          basePrice: fare.total,
          bonus,
          fareBreakdown: fare,
          status: IntercityRequestStatus.OPEN,
          tripId: null,
          orderId: null,
          acceptedAt: null,
          closedAt: null,
        }),
      );
    } catch (err) {
      // Parallel ikkinchi so'rov — qisman unique indeks (migr. 041) ushladi.
      if ((err as { code?: string }).code === '23505') throw this.alreadyOpen(null);
      throw err;
    }

    const view = await this.getView(saved.id);
    await this.notifier.requestCreated(view);
    this.logger.log(`Intercity so'rov ${saved.id}: ${view.originName} → ${view.destinationName}, ${view.total} so'm`);
    return view;
  }

  async listMine(
    passengerId: string,
    pagination: { page?: number; limit?: number },
  ): Promise<IntercityRequestPage> {
    await this.assertEnabled();
    const page = Math.max(1, pagination.page ?? 1);
    const limit = pagination.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, total] = await this.requestRepository.findAndCount({
      where: { passengerId },
      relations: REQUEST_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: rows.map(toIntercityRequestView), total, page, limit };
  }

  /**
   * Narxni oshirish — shartli UPDATE: haydovchi aynan shu lahzada qabul
   * qilayotgan bo'lsa, qabul qilish qatorni qulflaydi va oshirish 0 qator
   * oladi (haydovchi ko'rgan narx bilan band yoziladi).
   */
  async raiseBonus(passengerId: string, requestId: string, bonus: number, now: Date = new Date()): Promise<IntercityRequestView> {
    await this.assertEnabled();
    const request = await this.findMine(passengerId, requestId);
    if (request.status !== IntercityRequestStatus.OPEN) throw this.closed(request.status);
    const reasons = evaluateBonusRaise(Number(request.bonus), bonus, Number(request.basePrice));
    if (reasons.length > 0) throw this.invalid(reasons);

    const rows = returnedRows<{ id: string }>(
      await this.dataSource.query(
        `UPDATE "intercity_requests" SET "bonus" = $3, "updated_at" = now()
          WHERE "id" = $1 AND "passenger_id" = $2 AND "status" = 'open' AND "window_end" > $4 AND "bonus" < $3
          RETURNING "id"`,
        [requestId, passengerId, bonus, now],
      ),
    );
    if (rows.length === 0) {
      // Qabul qilindi, bekor/eskirdi yoki parallel kattaroq oshirish — haqiqiy holat bilan.
      const current = await this.findMine(passengerId, requestId);
      if (current.status === IntercityRequestStatus.OPEN) {
        throw this.invalid(evaluateBonusRaise(Number(current.bonus), bonus, Number(current.basePrice)));
      }
      throw this.closed(current.status);
    }
    const view = await this.getView(requestId);
    await this.notifier.requestUpdated(view);
    return view;
  }

  async cancel(passengerId: string, requestId: string, now: Date = new Date()): Promise<IntercityRequestView> {
    await this.assertEnabled();
    const request = await this.findMine(passengerId, requestId);
    const rows = returnedRows<{ id: string }>(
      await this.dataSource.query(
        `UPDATE "intercity_requests" SET "status" = 'cancelled', "closed_at" = $3, "updated_at" = now()
          WHERE "id" = $1 AND "passenger_id" = $2 AND "status" = 'open'
          RETURNING "id"`,
        [requestId, passengerId, now],
      ),
    );
    if (rows.length === 0) throw this.closed(request.status);
    await this.notifier.requestClosed(requestId, IntercityRequestStatus.CANCELLED);
    return this.getView(requestId);
  }

  // ---------------------------------------------------------------- haydovchi

  /**
   * Haydovchi doskasi: ochiq, oralig'i tugamagan so'rovlar, eng erta
   * boshlanadigani birinchi. Comfort so'rovlar faqat Comfort darajasidagi
   * haydovchiga ko'rinadi — u baribir qabul qila olmasdi.
   */
  async board(userId: string, query: IntercityRequestBoardQueryDto, now: Date = new Date()): Promise<IntercityRequestView[]> {
    await this.assertEnabled();
    // Qabul qilish bilan BIR XIL darvoza: bloklangan/tasdiqlanmagan yoki
    // shaharlararo yoqilmagan haydovchi yo'lovchi manzillarini ko'rmasin.
    const driver = await this.gate.loadPublisher(userId, now);
    const comfortAllowed = driver.approvedTariffTier >= (await this.trips.resolveComfortTier());
    const classes = comfortAllowed ? [IntercityTripClass.START, IntercityTripClass.COMFORT] : [IntercityTripClass.START];

    const rows = await this.requestRepository.find({
      where: {
        status: IntercityRequestStatus.OPEN,
        windowEnd: MoreThan(now),
        tripClass: In(classes),
        ...(query.routeId ? { routeId: query.routeId } : {}),
      },
      relations: REQUEST_RELATIONS,
      order: { windowStart: 'ASC' },
      take: BOARD_LIMIT,
    });
    return rows.map(toIntercityRequestView);
  }

  // ---------------------------------------------------------------- menejer

  async listForManage(query: ManageIntercityRequestsQueryDto): Promise<IntercityRequestPage<IntercityRequestManageView>> {
    await this.assertEnabled();
    const page = Math.max(1, query.page ?? 1);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: FindOptionsWhere<IntercityRequest> = query.status ? { status: query.status } : {};
    const [rows, total] = await this.requestRepository.findAndCount({
      where,
      relations: { ...REQUEST_RELATIONS, passenger: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: rows.map(toIntercityRequestManageView), total, page, limit };
  }

  // ---------------------------------------------------------------- cron

  /**
   * Oralig'i tugagan ochiq so'rovlar → `expired`, yo'lovchiga xabar. Shartli
   * UPDATE — bir nechta instansda ham har so'rov bir marta eskiradi.
   * Qaytaradi: eskirgan so'rovlar soni.
   */
  async expireDue(now: Date = new Date()): Promise<number> {
    const expired = returnedRows<{ id: string; passenger_id: string }>(
      await this.dataSource.query(
        `UPDATE "intercity_requests" SET "status" = 'expired', "closed_at" = $1, "updated_at" = now()
          WHERE "id" IN (
            SELECT "id" FROM "intercity_requests"
             WHERE "status" = 'open' AND "window_end" <= $1
             ORDER BY "window_end" LIMIT ${EXPIRY_BATCH})
            AND "status" = 'open'
          RETURNING "id", "passenger_id"`,
        [now],
      ),
    );
    for (const row of expired) {
      await this.notifier.requestExpired(row.id, row.passenger_id);
    }
    return expired.length;
  }

  // ---------------------------------------------------------------- ichki

  async getView(requestId: string): Promise<IntercityRequestView> {
    const request = await this.requestRepository.findOne({ where: { id: requestId }, relations: REQUEST_RELATIONS });
    if (!request) throw this.notFound();
    return toIntercityRequestView(request);
  }

  /**
   * Odatdagi band narxi — qatnov o'rniga yo'nalish narxlari bilan
   * (`evaluateBooking` + shahar ichiga davom). Sig'im — yo'nalish standarti.
   */
  private async price(route: PricedRoute, dto: CreateIntercityRequestDto, maxSeatsPerBooking: number): Promise<PricedRequest> {
    const tripClass = dto.tripClass ?? IntercityTripClass.START;
    const prices = routePricesFor(route, tripClass);
    if (!prices) {
      throw this.invalid([{ code: INTERCITY_REQUEST_REASONS.comfortNotOffered, message: "Bu yo'nalishda Comfort klass yo'q" }]);
    }
    const evaluation = evaluateBooking(
      {
        kind: dto.kind,
        seats: dto.seats,
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        pickup: dto.pickup,
        dropoff: dto.dropoff,
      },
      {
        trip: { ...prices, seatsTotal: route.seatsDefault },
        origin: route.originPoint,
        destination: route.destinationPoint,
        maxSeatsPerBooking,
      },
    );
    if (!evaluation.ok) throw this.invalid(evaluation.reasons);

    const extensions = await Promise.all([
      ...(evaluation.pickupZone === 'extension'
        ? [this.extensionPricer.charge('pickup', route.originPoint, tripClass, dto.pickup)]
        : []),
      ...(evaluation.dropoffZone === 'extension'
        ? [this.extensionPricer.charge('dropoff', route.destinationPoint, tripClass, dto.dropoff)]
        : []),
    ]);
    const distanceKm = haversineDistance(dto.pickup.lat, dto.pickup.lng, dto.dropoff.lat, dto.dropoff.lng);
    return {
      seats: dto.kind === IntercityBookingKind.WHOLE_CAR ? route.seatsDefault : evaluation.seats,
      fare: composeIntercityFare(evaluation.price, extensions, Math.ceil(distanceKm * INTERCITY_MINUTES_PER_KM)),
    };
  }

  private async findOpenRoute(routeId: string): Promise<PricedRoute> {
    const route = await this.routeRepository.findOne({
      where: { id: routeId, isActive: true },
      relations: { originPoint: true, destinationPoint: true },
    });
    if (!route || !route.originPoint?.isActive || !route.destinationPoint?.isActive) {
      throw new NotFoundException("Yo'nalish topilmadi yoki faol emas");
    }
    return route as PricedRoute;
  }

  private async findMine(passengerId: string, requestId: string): Promise<IntercityRequest> {
    const request = await this.requestRepository.findOne({ where: { id: requestId, passengerId } });
    if (!request) throw this.notFound();
    return request;
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.settings.isIntercityEnabled())) {
      throw codedNotFound(ERROR_CODES.intercityDisabled, 'Shaharlararo qatnov hozircha mavjud emas');
    }
  }

  private invalid(reasons: ErrorReason[]) {
    return codedBadRequest(ERROR_CODES.intercityRequestInvalid, reasons.map((r) => r.message).join('; '), { reasons });
  }

  private alreadyOpen(requestId: string | null) {
    return codedConflict(ERROR_CODES.intercityRequestAlreadyOpen, "Sizda allaqachon ochiq so'rov bor", {
      details: { requestId },
    });
  }

  private closed(status: IntercityRequestStatus) {
    return codedConflict(ERROR_CODES.intercityRequestClosed, "So'rov endi ochiq emas", { details: { status } });
  }

  private notFound() {
    return codedNotFound(ERROR_CODES.intercityRequestNotFound, "So'rov topilmadi");
  }
}
