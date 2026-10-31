import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  INTERCITY_EVENTS,
  IntercityBookingEventPayload,
  IntercityRequestClosedPayload,
  IntercityTripCancelledPayload,
  IntercityTripSnapshot,
  publishTripUpdated,
  loadTripSnapshot,
} from './intercity-events';
import { formatTashkentDayMonth, formatTashkentTime } from './intercity-time';
import type { IntercityRequestView } from './intercity-request-view';
import { intercityPush } from './intercity-push-texts';
import { IntercityBookingKind } from '../../database/entities/order.entity';

/**
 * Yangi so'rov haqida push oladigan haydovchilar — pilot parki kichik;
 * chegara katta park bo'lganda push xizmatini bosib yubormaslik uchun.
 */
const REQUEST_PUSH_DRIVER_LIMIT = 300;

/** Haydovchilar ro'yxati shuncha vaqt qayta ishlatiladi (yangi yoqilgan haydovchi kechikishi shu). */
const REQUEST_DRIVERS_CACHE_MS = 30_000;

/** Kim bekor qildi — yo'lovchiga ko'rsatiladigan matn shunga bog'liq. */
export type IntercityCancelledBy = 'driver' | 'system';

/**
 * Shaharlararo realtime hodisalari va push xabarlari.
 *
 * ⚠️ HAR BIR metod tranzaksiya COMMIT bo'lgandan KEYIN chaqiriladi va HECH
 * QACHON xato tashlamaydi: band allaqachon saqlangan — push yoki socket
 * yiqilgani uchun yo'lovchiga "xato" qaytarish uni qayta band qilishga
 * undardi (oddiy buyurtma pushlari ham shunday — `notifications.service.ts`).
 *
 * Har bir qism ALOHIDA himoyalangan: snapshot o'qilmasa ham bekor qilingan
 * yo'lovchilar `trip:cancelled` ni baribir oladi.
 *
 * Push matnlari har foydalanuvchiga o'z tilida (`intercity-push-texts.ts`).
 */
@Injectable()
export class IntercityNotifier {
  private readonly logger = new Logger(IntercityNotifier.name);
  private requestDriversCache: { userIds: string[]; expiresAt: number } | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** Yo'lovchi band qildi → haydovchiga xabar, kuzatuvchilarga yangi joylar soni. */
  async bookingCreated(event: IntercityBookingEventPayload): Promise<void> {
    const snapshot = await this.publish(event.tripId);
    if (!snapshot) return;
    await this.safely('booking:created', async () => {
      this.gateway.emitToUser(snapshot.driverUserId, INTERCITY_EVENTS.BOOKING_CREATED, event);
      await this.notifications.notifyUserIds(
        [snapshot.driverUserId],
        intercityPush.bookingCreated(event.bookingKind === 'whole_car', event.seats, this.departure(snapshot)),
        'intercity_booking_created',
        { tripId: event.tripId, orderId: event.orderId },
      );
    });
  }

  /** Yo'lovchi bandini bekor qildi → haydovchiga xabar. */
  async bookingCancelled(event: IntercityBookingEventPayload): Promise<void> {
    const snapshot = await this.publish(event.tripId);
    if (!snapshot) return;
    await this.safely('booking:cancelled', async () => {
      this.gateway.emitToUser(snapshot.driverUserId, INTERCITY_EVENTS.BOOKING_CANCELLED, event);
      await this.notifications.notifyUserIds(
        [snapshot.driverUserId],
        intercityPush.bookingCancelled(event.bookingKind === 'whole_car', event.seats, this.departure(snapshot)),
        'intercity_booking_cancelled',
        { tripId: event.tripId, orderId: event.orderId },
      );
    });
  }

  /** Dispetcher yo'lovchining bandini bekor qildi — yo'lovchi sababini bilishi kerak. */
  async bookingCancelledByDispatcher(
    passengerId: string,
    tripId: string,
    orderId: string,
    reason: string,
  ): Promise<void> {
    await this.safely('booking:cancelled by dispatcher', () =>
      this.notifications.notifyUserIds(
        [passengerId],
        intercityPush.bookingCancelledByDispatcher(reason),
        'intercity_booking_cancelled_by_dispatcher',
        { tripId, orderId },
      ),
    );
  }

  /** Haydovchi yig'ishni boshladi → yo'lovchilar "haydovchi kelmoqda" oladi. */
  async boardingStarted(tripId: string): Promise<void> {
    const snapshot = await this.publish(tripId);
    if (!snapshot || snapshot.passengerIds.length === 0) return;
    await this.safely('boarding', () =>
      this.notifications.notifyUserIds(
        snapshot.passengerIds,
        intercityPush.boardingStarted(),
        'intercity_boarding_started',
        { tripId },
      ),
    );
  }

  /** Jo'nash — yo'lovchi allaqachon mashinada, push keraksiz. */
  async departed(tripId: string): Promise<void> {
    await this.publish(tripId);
  }

  /** Kelmagan yo'lovchi — faqat joylar/holat yangilanadi. */
  async noShow(tripId: string): Promise<void> {
    await this.publish(tripId);
  }

  /** Qatnov yakunlandi yoki boshqa holat o'zgarishi — faqat `trip:updated`. */
  async tripUpdated(tripId: string): Promise<void> {
    await this.publish(tripId);
  }

  /**
   * Qatnov bekor qilindi (haydovchi yoki cron). `passengerIds` — AYNI SHU
   * bekor qilishda bandi yopilgan yo'lovchilar: tranzaksiyadan keyin ular
   * endi "faol" emas, snapshot ularni topa olmaydi.
   */
  async tripCancelled(
    tripId: string,
    reason: string,
    passengerIds: readonly string[],
    by: IntercityCancelledBy,
  ): Promise<void> {
    await this.publish(tripId);
    if (passengerIds.length === 0) return;
    const payload: IntercityTripCancelledPayload = { tripId, reason };
    await this.safely('trip:cancelled', async () => {
      for (const passengerId of new Set(passengerIds)) {
        this.gateway.emitToUser(passengerId, INTERCITY_EVENTS.TRIP_CANCELLED, payload);
      }
    });
    // Tizim sababi ("stale", "no_bookings") — ichki kod, yo'lovchiga ko'rsatilmaydi.
    await this.safely('trip:cancelled push', () =>
      this.notifications.notifyUserIds(
        passengerIds,
        intercityPush.tripCancelled(by === 'driver', reason),
        'intercity_trip_cancelled',
        { tripId },
      ),
    );
  }

  /** Jo'nashdan ~1 soat oldin. Bir martaligini cron ta'minlaydi (`reminder_sent_at`). */
  async departureReminder(tripId: string): Promise<void> {
    await this.safely('reminder', async () => {
      const snapshot = await loadTripSnapshot(this.dataSource, tripId);
      if (!snapshot) return;
      const time = this.departure(snapshot);
      await this.notifications.notifyUserIds(
        [snapshot.driverUserId],
        intercityPush.driverReminder(time, snapshot.passengerIds.length),
        'intercity_departure_reminder',
        { tripId },
      );
      if (snapshot.passengerIds.length > 0) {
        await this.notifications.notifyUserIds(
          snapshot.passengerIds,
          intercityPush.passengerReminder(time),
          'intercity_departure_reminder',
          { tripId },
        );
      }
    });
  }

  // ---------------------------------------------------------------- so'rovlar doskasi

  /** Yangi so'rov → shaharlararo haydovchilarga push va doskaga hodisa. */
  async requestCreated(request: IntercityRequestView): Promise<void> {
    await this.safely('request:created', async () => {
      const driverUserIds = await this.requestDrivers();
      for (const userId of driverUserIds) {
        this.gateway.emitToUser(userId, INTERCITY_EVENTS.REQUEST_CREATED, request);
      }
      this.gateway.emitToManagers(INTERCITY_EVENTS.REQUEST_CREATED, request);
      await this.notifications.notifyUserIds(
        driverUserIds,
        intercityPush.requestCreated(
          `${request.originName ?? ''} → ${request.destinationName ?? ''}`,
          this.windowText(request),
          request.kind === IntercityBookingKind.WHOLE_CAR,
          request.seats,
          request.total,
        ),
        'intercity_request_created',
        { requestId: request.id },
      );
    });
  }

  /** Yo'lovchi narxni oshirdi — faqat doska yangilanadi (har "+" uchun push spam bo'lardi). */
  async requestUpdated(request: IntercityRequestView): Promise<void> {
    await this.safely('request:updated', async () => {
      const driverUserIds = await this.requestDrivers();
      for (const userId of driverUserIds) {
        this.gateway.emitToUser(userId, INTERCITY_EVENTS.REQUEST_UPDATED, request);
      }
      this.gateway.emitToManagers(INTERCITY_EVENTS.REQUEST_UPDATED, request);
    });
  }

  /** So'rov doskadan chiqdi (bekor, qabul yoki eskirdi). */
  async requestClosed(requestId: string, status: string): Promise<void> {
    await this.safely('request:closed', async () => {
      const payload: IntercityRequestClosedPayload = { requestId, status };
      for (const userId of await this.requestDrivers()) {
        this.gateway.emitToUser(userId, INTERCITY_EVENTS.REQUEST_CLOSED, payload);
      }
      this.gateway.emitToManagers(INTERCITY_EVENTS.REQUEST_CLOSED, payload);
    });
  }

  /** Haydovchi qabul qildi → yo'lovchiga "haydovchi topildi". */
  async requestAccepted(
    requestId: string,
    passengerId: string,
    tripId: string,
    orderId: string,
    departureAt: Date,
  ): Promise<void> {
    await this.requestClosed(requestId, 'accepted');
    await this.safely('request:accepted', async () => {
      const payload: IntercityRequestClosedPayload = { requestId, status: 'accepted', tripId, orderId };
      this.gateway.emitToUser(passengerId, INTERCITY_EVENTS.REQUEST_RESOLVED, payload);
      await this.notifications.notifyUserIds(
        [passengerId],
        intercityPush.requestAccepted(formatTashkentTime(departureAt)),
        'intercity_request_accepted',
        { requestId, tripId, orderId },
      );
    });
  }

  /** Oraliq tugadi, hech kim olmadi → yo'lovchiga xabar. */
  async requestExpired(requestId: string, passengerId: string): Promise<void> {
    await this.requestClosed(requestId, 'expired');
    await this.safely('request:expired', async () => {
      const payload: IntercityRequestClosedPayload = { requestId, status: 'expired' };
      this.gateway.emitToUser(passengerId, INTERCITY_EVENTS.REQUEST_RESOLVED, payload);
      await this.notifications.notifyUserIds(
        [passengerId],
        intercityPush.requestExpired(),
        'intercity_request_expired',
        { requestId },
      );
    });
  }

  // ---------------------------------------------------------------- ichki

  private async publish(tripId: string): Promise<IntercityTripSnapshot | null> {
    let snapshot: IntercityTripSnapshot | null = null;
    await this.safely('trip:updated', async () => {
      snapshot = await publishTripUpdated(this.dataSource, this.gateway, tripId);
    });
    return snapshot;
  }

  /**
   * "Shaharlararo" xizmati yoqilgan faol haydovchilar (`users.id`). Comfort
   * so'rov ham hammaga boradi — doska uni Comfort darajasiz haydovchiga
   * ko'rsatmaydi (`IntercityRequestsService.board`), push esa umumiy.
   */
  private async requestDrivers(): Promise<string[]> {
    // Cron bir tick'da o'nlab so'rovni eskirtiradi — ro'yxat qisqa muddat qayta ishlatiladi.
    if (this.requestDriversCache && this.requestDriversCache.expiresAt > Date.now()) {
      return this.requestDriversCache.userIds;
    }
    const rows = (await this.dataSource.query(
      `SELECT d."user_id" FROM "drivers" d
         JOIN "users" u ON u."id" = d."user_id"
        WHERE d."service_types" ? 'intercity' AND u."status" = 'active'
        LIMIT ${REQUEST_PUSH_DRIVER_LIMIT}`,
    )) as Array<{ user_id: string }>;
    const userIds = rows.map((row) => row.user_id);
    this.requestDriversCache = { userIds, expiresAt: Date.now() + REQUEST_DRIVERS_CACHE_MS };
    return userIds;
  }

  /** "18.10 14:00–16:00" — so'rov boshqa kunga bo'lishi mumkin. */
  private windowText(request: IntercityRequestView): string {
    const start = new Date(request.windowStart);
    return `${formatTashkentDayMonth(start)} ${formatTashkentTime(start)}–${formatTashkentTime(new Date(request.windowEnd))}`;
  }

  private departure(snapshot: IntercityTripSnapshot): string {
    return formatTashkentTime(new Date(snapshot.payload.departureAt));
  }

  private async safely(label: string, work: () => Promise<void> | void): Promise<void> {
    try {
      await work();
    } catch (err) {
      this.logger.warn(`Shaharlararo xabar (${label}) yuborilmadi: ${err instanceof Error ? err.message : err}`);
    }
  }
}
