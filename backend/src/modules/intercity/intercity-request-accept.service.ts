import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  ERROR_CODES,
  codedBadRequest,
  codedConflict,
  codedForbidden,
  codedNotFound,
} from '../../common/errors/coded-error';
import { IntercityRequest, IntercityRequestStatus } from '../../database/entities/intercity-request.entity';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import {
  INTERCITY_TRIP_LIVE_STATUSES,
  IntercityTrip,
  IntercityTripClass,
  IntercityTripStatus,
} from '../../database/entities/intercity-trip.entity';
import { IntercityBookingKind, PaymentMethod } from '../../database/entities/order.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { SettingsService } from '../settings/settings.service';
import { AcceptIntercityRequestDto } from './dto/intercity-request.dto';
import { assertNoActiveBooking, insertBookingOrder, intercityTariffId } from './intercity-booking-writer';
import { IntercityDriverGate, IntercityPublisher } from './intercity-driver-gate';
import { IntercityFitService } from './intercity-fit.service';
import { IntercityNotifier } from './intercity-notifier';
import { INTERCITY_REQUEST_REASONS, departureFitsWindow, withRequestBonus } from './intercity-request-policy';
import { IntercityRequestView } from './intercity-request-view';
import { IntercityRequestsService } from './intercity-requests.service';
import { IntercityTripsService } from './intercity-trips.service';
import { claimSeats, claimWholeCar, lockTripForCompletion, returnedRows } from './intercity-seat-ledger';
import { evaluateTripPublish, findOverlappingDeparture } from './intercity-trip-policy';
import { IntercityZonesService } from './intercity-zones.service';

type RequestWithRoute = IntercityRequest & {
  route: IntercityRoute & { originPoint: IntercityPoint; destinationPoint: IntercityPoint };
};

/** Qabul qilish natijasi: band qaysi qatnovga tushdi. */
export interface IntercityRequestAcceptView {
  request: IntercityRequestView;
  tripId: string;
  orderId: string;
  /** true — so'rov uchun yangi qatnov yaratildi (qolgan joylar ochiq). */
  tripCreated: boolean;
}

/** Band tushadigan joy: mavjud qatnov yoki yaratiladigan yangisi. */
type Target =
  | { kind: 'existing'; trip: IntercityTrip }
  | { kind: 'new'; departureAt: Date; seatsTotal: number; seatPrice: number; wholeCarPrice: number };

/**
 * Haydovchi so'rovni qabul qiladi → yo'lovchi uning qatnoviga band bo'ladi.
 *
 *  · `tripId` berilsa — o'sha qatnov (o'ziniki, shu yo'nalish/klass, ochiq,
 *    jo'nashi oraliq ichida);
 *  · berilmasa — haydovchining oraliqdagi mos ochiq qatnovi;
 *  · u ham bo'lmasa — `departureAt` bilan YANGI qatnov (qolgan joylarni
 *    boshqa yo'lovchilar odatdagidek band qiladi).
 *
 * ⚠️ BITTA TRANZAKSIYA: so'rov qatori `FOR UPDATE` bilan qulflanadi — ikki
 * haydovchi bir vaqtda bossa, ikkinchisi birinchisi COMMIT bo'lishini kutadi
 * va so'rovni allaqachon `accepted` ko'radi (409). Yangi qatnov, o'rindiq
 * va band ham shu tranzaksiyada: yarim qabul (qatnov bor, band yo'q) qolmaydi.
 */
@Injectable()
export class IntercityRequestAcceptService {
  private readonly logger = new Logger(IntercityRequestAcceptService.name);

  constructor(
    @InjectRepository(IntercityRequest)
    private readonly requestRepository: Repository<IntercityRequest>,
    @InjectRepository(IntercityTrip)
    private readonly tripRepository: Repository<IntercityTrip>,
    @InjectRepository(Tariff)
    private readonly tariffRepository: Repository<Tariff>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly gate: IntercityDriverGate,
    private readonly fit: IntercityFitService,
    private readonly zones: IntercityZonesService,
    private readonly notifier: IntercityNotifier,
    private readonly requests: IntercityRequestsService,
    private readonly trips: IntercityTripsService,
  ) {}

  async accept(
    userId: string,
    requestId: string,
    dto: AcceptIntercityRequestDto,
    now: Date = new Date(),
  ): Promise<IntercityRequestAcceptView> {
    const settings = await this.settings.getIntercitySettings();
    if (!settings.intercityEnabled) {
      throw codedNotFound(ERROR_CODES.intercityDisabled, 'Shaharlararo qatnov hozircha mavjud emas');
    }
    const driver = await this.gate.loadPublisher(userId, now);
    const request = await this.loadOpenRequest(requestId, now);
    await this.assertClassAllowed(driver, request);

    const target = await this.resolveTarget(driver, request, dto, now, settings.intercityMaxAheadDays);
    const zones = target.kind === 'existing' ? await this.zones.zonesOfTrip(target.trip.id) : null;
    if (target.kind === 'existing' && zones) {
      const zoneFit = await this.fit.check({
        trip: this.fitTrip(target.trip.id, request),
        zones,
        pickup: this.pickup(request),
        dropoff: this.dropoff(request),
        seatBooking: false,
        maxDetourMinutes: 0,
      });
      if (!zoneFit.zoneOk) {
        throw codedConflict(
          ERROR_CODES.intercityOutOfZone,
          `Yo'lovchi manzili qatnovingiz tumanlariga kirmaydi (${zoneFit.outOfZone?.zoneNames.join(', ') ?? ''})`,
          { details: { side: zoneFit.outOfZone?.side ?? null, zones: zoneFit.outOfZone?.zoneNames.join(', ') ?? '' } },
        );
      }
    }

    const tariffId = await intercityTariffId(this.tariffRepository);
    const fare = withRequestBonus(request.fareBreakdown, Number(request.bonus));

    const result = await this.dataSource.transaction(async (manager) => {
      const locked = returnedRows<{ id: string; bonus: string }>(
        await manager.query(
          `SELECT "id", "bonus" FROM "intercity_requests"
            WHERE "id" = $1 AND "status" = 'open' AND "window_end" > $2
            FOR UPDATE`,
          [requestId, now],
        ),
      );
      if (locked.length === 0) throw this.closed();
      // Bir haydovchining ikki parallel qabuli (har biri yangi qatnov bilan)
      // ±3 soat tekshiruvidan birga o'tib ketmasin — tekshiruv qulf ostida takrorlanadi.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`intercity-driver:${driver.id}`]);
      if (target.kind === 'new') await this.assertNoOverlap(manager, driver.id, target.departureAt);
      // Yo'lovchi qulfdan oldin narxni oshirgan bo'lsa — yangi summa bilan.
      const lockedFare =
        Number(locked[0].bonus) === Number(request.bonus)
          ? fare
          : withRequestBonus(request.fareBreakdown, Number(locked[0].bonus));

      const trip = target.kind === 'existing' ? target.trip : await this.createTrip(manager, driver, request, target);
      // `IntercityBookingsService.book` bilan BIR XIL kalit: yo'lovchi aynan
      // shu lahzada o'zi ham shu qatnovga yozilayotgan bo'lsa — navbat bilan.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `intercity-book:${trip.id}:${request.passengerId}`,
      ]);
      await assertNoActiveBooking(manager, trip.id, request.passengerId);

      if (target.kind === 'existing' && zones && request.kind === IntercityBookingKind.SEAT && settings.intercityMaxDetourMinutes > 0) {
        await lockTripForCompletion(manager, trip.id);
        const detour = await this.fit.check({
          trip: this.fitTrip(trip.id, request),
          zones,
          pickup: this.pickup(request),
          dropoff: this.dropoff(request),
          seatBooking: true,
          maxDetourMinutes: settings.intercityMaxDetourMinutes,
          executor: manager,
        });
        if (detour.detourTooLong) {
          throw codedConflict(
            ERROR_CODES.intercityDetourTooLong,
            `Yo'lovchi manzili qatnovingizga katta aylanma qiladi (+${detour.detourMinutes} daqiqa)`,
            { details: { addedMinutes: detour.detourMinutes, limit: settings.intercityMaxDetourMinutes } },
          );
        }
      }

      const claimed =
        request.kind === IntercityBookingKind.WHOLE_CAR
          ? await claimWholeCar(manager, trip.id, now)
          : await claimSeats(manager, trip.id, request.seats, now);
      if (!claimed) {
        throw codedConflict(
          ERROR_CODES.intercitySeatsUnavailable,
          request.kind === IntercityBookingKind.WHOLE_CAR
            ? "Qatnovingizda allaqachon yo'lovchi bor — butun mashina so'rovini yangi qatnov bilan qabul qiling"
            : "Qatnovingizda yetarli bo'sh joy yo'q",
        );
      }

      const orderId = await insertBookingOrder(manager, {
        passengerId: request.passengerId,
        driverUserId: driver.userId,
        tariffId,
        tripId: trip.id,
        departureAt: trip.departureAt,
        seats: request.seats,
        kind: request.kind,
        pickup: this.pickup(request),
        dropoff: this.dropoff(request),
        fare: lockedFare,
        paymentMethod: PaymentMethod.CASH,
      });

      await manager.query(
        `UPDATE "intercity_requests"
            SET "status" = 'accepted', "trip_id" = $2, "order_id" = $3,
                "accepted_at" = $4, "closed_at" = $4, "updated_at" = now()
          WHERE "id" = $1`,
        [requestId, trip.id, orderId, now],
      );
      return { tripId: trip.id, orderId, departureAt: trip.departureAt };
    });

    // COMMIT'dan KEYIN (notifier xato tashlamaydi).
    await this.notifier.tripUpdated(result.tripId);
    await this.notifier.requestAccepted(requestId, request.passengerId, result.tripId, result.orderId, result.departureAt);
    this.logger.log(
      `Intercity so'rov ${requestId}: haydovchi ${driver.id} qabul qildi → qatnov ${result.tripId}${target.kind === 'new' ? ' (yangi)' : ''}`,
    );
    return {
      request: await this.requests.getView(requestId),
      tripId: result.tripId,
      orderId: result.orderId,
      tripCreated: target.kind === 'new',
    };
  }

  // ---------------------------------------------------------------- ichki

  private async resolveTarget(
    driver: IntercityPublisher,
    request: RequestWithRoute,
    dto: AcceptIntercityRequestDto,
    now: Date,
    maxAheadDays: number,
  ): Promise<Target> {
    const liveTrips = await this.tripRepository.find({
      where: { driverId: driver.id, status: In([...INTERCITY_TRIP_LIVE_STATUSES]) },
    });
    const fits = (trip: IntercityTrip): boolean =>
      trip.routeId === request.routeId &&
      trip.tripClass === request.tripClass &&
      trip.status === IntercityTripStatus.OPEN &&
      departureFitsWindow(trip.departureAt, request, now);

    if (dto.tripId) {
      const trip = liveTrips.find((candidate) => candidate.id === dto.tripId);
      if (!trip) throw codedNotFound(ERROR_CODES.intercityTripNotFound, 'Qatnov topilmadi');
      if (!fits(trip)) throw this.tripMismatch();
      return { kind: 'existing', trip };
    }

    const matching = liveTrips.find(fits);
    if (matching) return { kind: 'existing', trip: matching };

    if (!dto.departureAt) {
      throw this.invalidReason(INTERCITY_REQUEST_REASONS.departureOutsideWindow, "Jo'nash vaqtini tanlang");
    }
    const departureAt = new Date(dto.departureAt);
    if (!departureFitsWindow(departureAt, request, now)) {
      throw this.invalidReason(INTERCITY_REQUEST_REASONS.departureOutsideWindow, "Jo'nash vaqti yo'lovchi oralig'idan tashqarida");
    }
    const overlap = findOverlappingDeparture(
      departureAt,
      liveTrips.map((trip) => trip.departureAt),
    );
    if (overlap) {
      throw codedConflict(ERROR_CODES.intercityTripOverlap, "Shu vaqtga yaqin (±3 soat) boshqa qatnovingiz bor", {
        details: { otherDepartureAt: overlap.toISOString() },
      });
    }

    // Narx va sig'im — odatdagi e'lon qoidalari. Oldindan e'lon qilish
    // chegarasi (30 daq) bu yerda yo'q: yo'lovchi allaqachon kutyapti, eng
    // erta vaqtni `departureFitsWindow` cheklaydi.
    const publish = evaluateTripPublish({
      route: request.route,
      departureAt,
      now,
      tripClass: request.tripClass,
      seatsTotal: undefined,
      driverTier: driver.approvedTariffTier,
      // Klass ruxsati `assertClassAllowed` da tekshirildi.
      comfortTier: 0,
      minLeadMinutes: 0,
      maxAheadDays,
    });
    if (!publish.ok) {
      throw codedBadRequest(ERROR_CODES.intercityTripInvalid, publish.reasons.map((r) => r.message).join('; '), {
        reasons: publish.reasons,
      });
    }
    return { kind: 'new', departureAt, ...publish };
  }

  /** Qulf ostida qayta tekshiruv — `resolveTarget` dagi o'qish tranzaksiyadan tashqarida edi. */
  private async assertNoOverlap(manager: EntityManager, driverId: string, departureAt: Date): Promise<void> {
    const rows = returnedRows<{ departure_at: Date }>(
      await manager.query(
        `SELECT "departure_at" FROM "intercity_trips"
          WHERE "driver_id" = $1 AND "status" IN (${INTERCITY_TRIP_LIVE_STATUSES.map((status) => `'${status}'`).join(', ')})`,
        [driverId],
      ),
    );
    const overlap = findOverlappingDeparture(
      departureAt,
      rows.map((row) => new Date(row.departure_at)),
    );
    if (overlap) {
      throw codedConflict(ERROR_CODES.intercityTripOverlap, "Shu vaqtga yaqin (±3 soat) boshqa qatnovingiz bor", {
        details: { otherDepartureAt: overlap.toISOString() },
      });
    }
  }

  private async createTrip(
    manager: EntityManager,
    driver: IntercityPublisher,
    request: RequestWithRoute,
    target: Extract<Target, { kind: 'new' }>,
  ): Promise<IntercityTrip> {
    return manager.save(
      IntercityTrip,
      manager.create(IntercityTrip, {
        routeId: request.routeId,
        driverId: driver.id,
        tripClass: request.tripClass,
        departureAt: target.departureAt,
        seatsTotal: target.seatsTotal,
        seatsTaken: 0,
        wholeCarBooked: false,
        status: IntercityTripStatus.OPEN,
        seatPrice: target.seatPrice,
        wholeCarPrice: target.wholeCarPrice,
        cancelReason: null,
      }),
    );
  }

  private async loadOpenRequest(requestId: string, now: Date): Promise<RequestWithRoute> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: { route: { originPoint: true, destinationPoint: true } },
    });
    if (!request?.route?.originPoint || !request.route.destinationPoint) {
      throw codedNotFound(ERROR_CODES.intercityRequestNotFound, "So'rov topilmadi");
    }
    if (request.status !== IntercityRequestStatus.OPEN || request.windowEnd <= now) throw this.closed();
    return request as RequestWithRoute;
  }

  private async assertClassAllowed(driver: IntercityPublisher, request: IntercityRequest): Promise<void> {
    if (request.tripClass !== IntercityTripClass.COMFORT) return;
    if (driver.approvedTariffTier < (await this.trips.resolveComfortTier())) {
      throw codedForbidden(
        ERROR_CODES.intercityTripInvalid,
        "Comfort so'rov uchun avtomobilingiz Comfort darajasiga tasdiqlanmagan",
      );
    }
  }

  private fitTrip(tripId: string, request: RequestWithRoute) {
    return { id: tripId, origin: request.route.originPoint, destination: request.route.destinationPoint };
  }

  private pickup(request: IntercityRequest) {
    return { lat: Number(request.pickupLat), lng: Number(request.pickupLng), address: request.pickupAddress };
  }

  private dropoff(request: IntercityRequest) {
    return { lat: Number(request.dropoffLat), lng: Number(request.dropoffLng), address: request.dropoffAddress };
  }

  private tripMismatch() {
    return codedConflict(
      ERROR_CODES.intercityTripActionNotAllowed,
      "Bu qatnov so'rovga mos emas: yo'nalish, klass yoki jo'nash vaqti boshqa",
      { details: { reason: 'trip_mismatch' } },
    );
  }

  private invalidReason(code: string, message: string) {
    return codedBadRequest(ERROR_CODES.intercityRequestInvalid, message, { reasons: [{ code, message }] });
  }

  private closed() {
    return codedConflict(ERROR_CODES.intercityRequestClosed, "So'rovni boshqa haydovchi oldi yoki u endi ochiq emas", {
      details: { status: 'closed' },
    });
  }
}
