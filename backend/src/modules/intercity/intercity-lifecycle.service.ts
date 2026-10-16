import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { ERROR_CODES, codedConflict, codedNotFound } from '../../common/errors/coded-error';
import { Driver } from '../../database/entities/driver.entity';
import { IntercityTrip, IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import {
  DRIVER_ACTIVE_ORDER_STATUSES,
  Order,
  OrderStatus,
  ServiceType,
} from '../../database/entities/order.entity';
import { SettingsService } from '../settings/settings.service';
import { boardingBlocker, departBlocker } from './intercity-lifecycle-policy';
import { returnedRows } from './intercity-seat-ledger';
import { IntercityTripView } from './intercity-trip-view';
import { IntercityTripsService } from './intercity-trips.service';

/** Haydovchi "kelmadi" deb belgilaganda bandga yoziladigan sabab. */
export const NO_SHOW_BOOKING_REASON = "Yo'lovchi kelmadi";

/** Kelmagan yo'lovchi belgisi (`orders.fraud_signals`), ko'rib chiqish navbatisiz. */
export const INTERCITY_NO_SHOW_SIGNAL = 'intercity_no_show';

/**
 * Qatnov hayot sikli: yig'ish → jo'nash. Yetib kelish va yakunlash har bir
 * band uchun MAVJUD buyurtma yo'llari orqali (`/orders/:id/arrived|start|complete`):
 * kutish, komissiya, 1% soliq va chek shu yerda qayta yozilmaydi.
 *
 * Holat o'zgarishlari — xom SQL, bitta tranzaksiyada, shartli: qatnov va
 * uning bandlari bir-biridan ajralib qolmasligi kerak (qatnov `boarding`,
 * bandlar esa hali SCHEDULED — haydovchi ilovasi yo'lovchini ko'rmasdi).
 */
@Injectable()
export class IntercityLifecycleService {
  private readonly logger = new Logger(IntercityLifecycleService.name);

  constructor(
    @InjectRepository(IntercityTrip)
    private readonly tripRepository: Repository<IntercityTrip>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly trips: IntercityTripsService,
  ) {}

  /**
   * Yo'lovchilarni yig'ish boshlanadi: bandlar ACCEPTED bo'ladi va shu
   * lahzadan haydovchi BAND hisoblanadi (matching uni o'tkazib yuboradi —
   * `DRIVER_ACTIVE_ORDER_STATUSES`). Shundan oldin u shahar ichida ishlay oladi.
   */
  async startBoarding(userId: string, tripId: string, now: Date = new Date()): Promise<IntercityTripView> {
    await this.assertEnabled();
    const driver = await this.loadDriver(userId);
    const trip = await this.loadOwnTrip(tripId, driver.id);
    const bookings = await this.bookingsOf(tripId);
    const active = bookings.filter((booking) => booking.status === OrderStatus.SCHEDULED).length;

    const blocker = boardingBlocker({ status: trip.status, departureAt: trip.departureAt, now, activeBookings: active });
    if (blocker) throw this.notAllowed(blocker, "Yo'lovchilarni yig'ishni hozir boshlab bo'lmaydi");

    // Shahar ichidagi safar tugamaguncha yig'ish boshlanmaydi — aks holda
    // haydovchida bir vaqtda ikki "faol" safar bo'lardi.
    const busy = await this.orderRepository.count({
      where: { driverId: userId, status: In([...DRIVER_ACTIVE_ORDER_STATUSES]), intercityTripId: IsNull() },
    });
    if (busy > 0) throw this.notAllowed('DRIVER_BUSY', 'Avval joriy safarni yakunlang');

    await this.dataSource.transaction(async (manager) => {
      const moved = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE "intercity_trips" SET "status" = 'boarding', "updated_at" = now()
            WHERE "id" = $1 AND "driver_id" = $2 AND "status" IN ('open', 'full')
            RETURNING "id"`,
          [tripId, driver.id],
        ),
      );
      if (moved.length === 0) throw this.notAllowed('WRONG_STATUS', "Qatnov holati o'zgargan");
      await manager.query(
        `UPDATE "orders" SET "status" = $2, "updated_at" = now()
          WHERE "intercity_trip_id" = $1 AND "status" = $3
          RETURNING "id"`,
        [tripId, OrderStatus.ACCEPTED, OrderStatus.SCHEDULED],
      );
    });
    // TODO(intercity, 6-qadam): yo'lovchilarga `order:accepted` + push.
    this.logger.log(`Intercity qatnov ${tripId}: yig'ish boshlandi (${active} band)`);
    return this.trips.getView(tripId);
  }

  /**
   * Jo'nash: olingan (ARRIVED) yo'lovchilarning safari boshlanadi —
   * `trips` yozuvi `startTrip` dagidek yaratiladi, yakunlash uni o'qiydi.
   */
  async depart(userId: string, tripId: string, now: Date = new Date()): Promise<IntercityTripView> {
    await this.assertEnabled();
    const driver = await this.loadDriver(userId);
    const trip = await this.loadOwnTrip(tripId, driver.id);
    const bookings = await this.bookingsOf(tripId);

    const blocker = departBlocker(trip.status, bookings.map((booking) => booking.status));
    if (blocker) throw this.notAllowed(blocker, "Hozir jo'nab bo'lmaydi");

    await this.dataSource.transaction(async (manager) => {
      const moved = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE "intercity_trips" SET "status" = 'in_progress', "departed_at" = $3, "updated_at" = now()
            WHERE "id" = $1 AND "driver_id" = $2 AND "status" = 'boarding'
            RETURNING "id"`,
          [tripId, driver.id, now],
        ),
      );
      if (moved.length === 0) throw this.notAllowed('WRONG_STATUS', "Qatnov holati o'zgargan");
      const started = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE "orders" SET "status" = $2, "updated_at" = now()
            WHERE "intercity_trip_id" = $1 AND "status" = $3
            RETURNING "id"`,
          [tripId, OrderStatus.IN_PROGRESS, OrderStatus.ARRIVED],
        ),
      );
      if (started.length > 0) {
        await manager.query(
          `INSERT INTO "trips" ("order_id", "start_time") SELECT unnest($1::uuid[]), $2`,
          [started.map((row) => row.id), now],
        );
      }
    });
    // TODO(intercity, 6-qadam): yo'lovchilarga `order:in_progress`.
    this.logger.log(`Intercity qatnov ${tripId}: jo'nadi`);
    return this.trips.getView(tripId);
  }

  /**
   * Yo'lovchi kelmadi: band bekor qilinadi, joy QAYTARILMAYDI — mashina
   * allaqachon yig'ishda, boshqa yo'lovchi bu joyni ola olmaydi.
   */
  async markNoShow(userId: string, orderId: string, now: Date = new Date()): Promise<IntercityTripView> {
    await this.assertEnabled();
    const driver = await this.loadDriver(userId);
    const booking = await this.orderRepository.findOne({
      where: { id: orderId, serviceType: ServiceType.INTERCITY },
    });
    if (!booking?.intercityTripId || booking.driverId !== userId) {
      throw codedNotFound(ERROR_CODES.intercityBookingNotFound, 'Band topilmadi');
    }
    const trip = await this.loadOwnTrip(booking.intercityTripId, driver.id);
    if (trip.status !== IntercityTripStatus.BOARDING) {
      throw this.notAllowed('WRONG_STATUS', "«Kelmadi» faqat yo'lovchilarni yig'ish paytida belgilanadi");
    }

    await this.dataSource.transaction(async (manager) => {
      const rows = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE "orders"
              SET "status" = $2, "cancel_reason" = $3, "updated_at" = now(),
                  "fraud_signals" = COALESCE("fraud_signals", '[]'::jsonb) || $4::jsonb
            WHERE "id" = $1 AND "status" IN ('accepted', 'arrived')
            RETURNING "id"`,
          [orderId, OrderStatus.CANCELLED, NO_SHOW_BOOKING_REASON, JSON.stringify([INTERCITY_NO_SHOW_SIGNAL])],
        ),
      );
      if (rows.length === 0) throw this.notAllowed('WRONG_STATUS', "Band holati o'zgargan");
    });
    this.logger.log(`Intercity band ${orderId}: yo'lovchi kelmadi (${now.toISOString()})`);
    return this.trips.getView(trip.id);
  }

  // ---------------------------------------------------------------- ichki

  private async loadDriver(userId: string): Promise<Driver> {
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  private async loadOwnTrip(tripId: string, driverId: string): Promise<IntercityTrip> {
    const trip = await this.tripRepository.findOne({ where: { id: tripId, driverId } });
    if (!trip) throw codedNotFound(ERROR_CODES.intercityTripNotFound, 'Qatnov topilmadi');
    return trip;
  }

  private bookingsOf(tripId: string): Promise<Array<Pick<Order, 'id' | 'status'>>> {
    return this.orderRepository.find({
      where: { intercityTripId: tripId },
      select: { id: true, status: true },
    });
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.settings.isIntercityEnabled())) {
      throw codedNotFound(ERROR_CODES.intercityDisabled, 'Shaharlararo qatnov hozircha mavjud emas');
    }
  }

  private notAllowed(reason: string, message: string) {
    return codedConflict(ERROR_CODES.intercityTripActionNotAllowed, message, { details: { reason } });
  }
}
