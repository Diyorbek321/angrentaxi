import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  INTERCITY_EVENTS,
  IntercityBookingEventPayload,
  IntercityTripCancelledPayload,
  IntercityTripSnapshot,
  publishTripUpdated,
  loadTripSnapshot,
} from './intercity-events';
import { formatTashkentTime } from './intercity-time';

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
 * Push matnlari o'zbekcha — foydalanuvchida til maydoni yo'q, mavjud
 * buyurtma pushlari bilan bir xil.
 */
@Injectable()
export class IntercityNotifier {
  private readonly logger = new Logger(IntercityNotifier.name);

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
      const what = event.bookingKind === 'whole_car' ? 'butun mashina' : `${event.seats} joy`;
      await this.notifications.notifyUserIds(
        [snapshot.driverUserId],
        `Yangi band: ${what}`,
        `${this.departure(snapshot)} dagi qatnovingizga yo'lovchi yozildi`,
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
      const what = event.bookingKind === 'whole_car' ? 'Butun mashina' : `${event.seats} joy`;
      await this.notifications.notifyUserIds(
        [snapshot.driverUserId],
        'Band bekor qilindi',
        `${what} bo'shadi — ${this.departure(snapshot)} dagi qatnov`,
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
        'Bandingiz bekor qilindi',
        `Dispetcher shaharlararo bandingizni bekor qildi: ${reason}`,
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
        "Haydovchi yo'lga chiqdi",
        'Haydovchi sizni olishga kelmoqda',
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
    const body =
      by === 'driver'
        ? `Haydovchi qatnovni bekor qildi: ${reason}. Boshqa qatnov tanlang.`
        : "Haydovchi qatnovni boshlamadi — bandingiz bekor qilindi. Boshqa qatnov tanlang.";
    await this.safely('trip:cancelled push', () =>
      this.notifications.notifyUserIds(passengerIds, 'Qatnov bekor qilindi', body, 'intercity_trip_cancelled', {
        tripId,
      }),
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
        'Qatnovingizga 1 soat qoldi',
        `${time} da jo'nash · ${snapshot.passengerIds.length} ta yo'lovchi`,
        'intercity_departure_reminder',
        { tripId },
      );
      if (snapshot.passengerIds.length > 0) {
        await this.notifications.notifyUserIds(
          snapshot.passengerIds,
          'Qatnovga 1 soat qoldi',
          `${time} da jo'nash. Olish manzilida tayyor turing.`,
          'intercity_departure_reminder',
          { tripId },
        );
      }
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
