import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { OrderStatus } from '../../database/entities/order.entity';
import {
  INTERCITY_NO_BOOKINGS_GRACE_MINUTES,
  IntercityExpiryReason,
  expiryReasonFor,
} from './intercity-lifecycle-policy';
import { returnedRows } from './intercity-seat-ledger';
import { IntercityNotifier } from './intercity-notifier';
import { IntercityRequestsService } from './intercity-requests.service';

/** Qatnovning tugamagan bandlari (korrelyatsiyalangan: tashqi alias `t`). */
const LIVE_BOOKINGS_SQL = `SELECT 1 FROM "orders" o
  WHERE o."intercity_trip_id" = t."id" AND o."status" NOT IN ('completed', 'cancelled')`;

/** Bir tick'da ko'rib chiqiladigan qatnovlar — backend uzoq o'chib tursa ham yuk cheklangan. */
const EXPIRY_BATCH = 100;

/** Eslatma jo'nashdan qancha oldin yuboriladi (daqiqa). */
export const INTERCITY_REMINDER_LEAD_MINUTES = 60;

/** Yig'ishda qolib ketgan qatnov shuncha vaqtdan keyin tashlab ketilgan hisoblanadi. */
export const INTERCITY_ABANDONED_BOARDING_HOURS = 3;

/** Tashlab ketilgan qatnovning bandlariga yoziladigan sabab. */
const ABANDONED_BOOKING_REASON = "Haydovchi qatnovni yakunlamadi";

/** Eskirgan qatnovning bandlariga yoziladigan sabab. */
const STALE_BOOKING_REASON = "Haydovchi qatnovni boshlamadi";

interface ExpiryCandidate {
  id: string;
  status: IntercityTripStatus;
  departure_at: Date;
  active: number;
}

/**
 * Jo'nash vaqti o'tgan, lekin hech kim tegmagan qatnovlarni yopadi:
 *  · bandsiz — jo'nash +15 daqiqada ('no_bookings');
 *  · bandi bor, haydovchi yig'ishni boshlamagan — +60 da ('stale'),
 *    bandlar bilan birga (yo'lovchi abadiy kutib qolmasin).
 * Yo'lga chiqqan qatnovga tegilmaydi (`expiryReasonFor`).
 *
 * Bir nechta instansda ishlasa ham xavfsiz: har bir yopish — shartli
 * UPDATE (`status IN ('open','full')`), ikkinchi instans 0 qator ko'radi.
 */
@Injectable()
export class IntercityTripsCron {
  private readonly logger = new Logger(IntercityTripsCron.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifier: IntercityNotifier,
    private readonly requests: IntercityRequestsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'intercity-trips-expiry' })
  async handleTick(): Promise<void> {
    // Ikki ish ALOHIDA himoyalangan: eslatma yiqilgani uchun eskirgan
    // qatnovlar yopilmay qolmasligi kerak (va aksincha). Ushlanmagan xato
    // scheduler'ni jim qoldirishi mumkin (`scheduled-orders.service.ts`).
    try {
      await this.expireTrips();
    } catch (err) {
      this.logger.error(`Shaharlararo qatnovlarni yopish yiqildi: ${err}`);
    }
    try {
      await this.sendDepartureReminders();
    } catch (err) {
      this.logger.error(`Shaharlararo eslatmalar yiqildi: ${err}`);
    }
    try {
      await this.sweepStuckTrips();
    } catch (err) {
      this.logger.error(`Shaharlararo qotgan qatnovlarni yopish yiqildi: ${err}`);
    }
    try {
      await this.requests.expireDue();
    } catch (err) {
      this.logger.error(`Shaharlararo so'rovlarni eskirtirish yiqildi: ${err}`);
    }
  }

  /**
   * Xavfsizlik supurgisi — oddiy oqimda bunga ehtiyoj yo'q, lekin biror
   * yo'l qatnovni oraliq holatda qoldirsa (yoki kelajakdagi xato), haydovchi
   * abadiy BAND hisoblanib qolmasligi kerak:
   *  · `in_progress`, tirik bandi yo'q → 'completed';
   *  · `boarding`, tirik bandi yo'q → 'no_passengers' bilan bekor;
   *  · `boarding`, jo'nashdan 3 soatdan ko'p o'tgan → tashlab ketilgan:
   *    qatnov va olinmagan bandlar bekor.
   * Har biri shartli UPDATE — bir nechta instansda xavfsiz.
   * Qaytaradi: yopilgan qatnovlar soni.
   */
  async sweepStuckTrips(now: Date = new Date()): Promise<number> {
    const finished = returnedRows<{ id: string }>(
      await this.dataSource.query(
        `UPDATE "intercity_trips" t
            SET "status" = 'completed', "completed_at" = $1, "updated_at" = now()
          WHERE t."status" = 'in_progress'
            AND NOT EXISTS (${LIVE_BOOKINGS_SQL})
          RETURNING t."id"`,
        [now],
      ),
    );
    for (const { id } of finished) await this.notifier.tripUpdated(id);

    const emptied = returnedRows<{ id: string }>(
      await this.dataSource.query(
        `UPDATE "intercity_trips" t
            SET "status" = 'cancelled', "cancel_reason" = 'no_passengers', "cancelled_at" = $1, "updated_at" = now()
          WHERE t."status" = 'boarding'
            AND NOT EXISTS (${LIVE_BOOKINGS_SQL})
          RETURNING t."id"`,
        [now],
      ),
    );
    for (const { id } of emptied) await this.notifier.tripCancelled(id, 'no_passengers', [], 'system');

    const abandonedCutoff = new Date(now.getTime() - INTERCITY_ABANDONED_BOARDING_HOURS * 60 * 60_000);
    const abandoned: Array<{ id: string }> = await this.dataSource.query(
      `SELECT t."id" FROM "intercity_trips" t
        WHERE t."status" = 'boarding' AND t."departure_at" <= $1
        ORDER BY t."departure_at" ASC
        LIMIT $2`,
      [abandonedCutoff, EXPIRY_BATCH],
    );
    let closedAbandoned = 0;
    for (const { id } of abandoned) {
      try {
        const passengerIds = await this.closeAbandoned(id, now);
        if (passengerIds) {
          closedAbandoned += 1;
          await this.notifier.tripCancelled(id, 'abandoned', passengerIds, 'system');
        }
      } catch (err) {
        this.logger.error(`Tashlab ketilgan qatnov ${id} yopilmadi: ${err}`);
      }
    }

    const total = finished.length + emptied.length + closedAbandoned;
    if (total > 0) this.logger.warn(`Shaharlararo: ${total} ta qotib qolgan qatnov yopildi`);
    return total;
  }

  private closeAbandoned(tripId: string, now: Date): Promise<string[] | null> {
    return this.dataSource.transaction(async (manager) => {
      const closed = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE "intercity_trips"
              SET "status" = 'cancelled', "cancel_reason" = 'abandoned', "cancelled_at" = $2, "updated_at" = now()
            WHERE "id" = $1 AND "status" = 'boarding'
            RETURNING "id"`,
          [tripId, now],
        ),
      );
      if (closed.length === 0) return null;
      const bookings = returnedRows<{ passenger_id: string }>(
        await manager.query(
          `UPDATE "orders" SET "status" = $2, "cancel_reason" = $3, "updated_at" = now()
            WHERE "intercity_trip_id" = $1 AND "status" IN ('accepted', 'arrived')
            RETURNING "passenger_id"`,
          [tripId, OrderStatus.CANCELLED, ABANDONED_BOOKING_REASON],
        ),
      );
      return bookings.map((booking) => booking.passenger_id);
    });
  }

  /**
   * Jo'nashga ≤1 soat qolgan, bandi bor qatnovlar uchun BIR MARTALIK eslatma.
   * Qatnov shartli UPDATE bilan "egallanadi" (`reminder_sent_at IS NULL`):
   * keyingi tick yoki ikkinchi instans uni qayta olmaydi. Push yiqilsa ham
   * qayta urinilmaydi — ikki marta eslatish bir marta eslatmaslikdan yomonroq.
   * Qaytaradi: eslatma yuborilgan qatnovlar soni.
   */
  async sendDepartureReminders(now: Date = new Date()): Promise<number> {
    const horizon = new Date(now.getTime() + INTERCITY_REMINDER_LEAD_MINUTES * 60_000);
    const claimed = returnedRows<{ id: string }>(
      await this.dataSource.query(
        `UPDATE "intercity_trips" t
            SET "reminder_sent_at" = $1, "updated_at" = now()
          WHERE t."status" IN ('open', 'full')
            AND t."reminder_sent_at" IS NULL
            AND t."departure_at" > $1 AND t."departure_at" <= $2
            AND EXISTS (
              SELECT 1 FROM "orders" o
               WHERE o."intercity_trip_id" = t."id"
                 AND o."status" NOT IN ('completed', 'cancelled'))
          RETURNING t."id"`,
        [now, horizon],
      ),
    );
    for (const { id } of claimed) {
      await this.notifier.departureReminder(id);
    }
    return claimed.length;
  }

  /** Qaytaradi: haqiqatda yopilgan qatnovlar soni. `now` — testlar uchun. */
  async expireTrips(now: Date = new Date()): Promise<number> {
    const earliestCutoff = new Date(now.getTime() - INTERCITY_NO_BOOKINGS_GRACE_MINUTES * 60_000);
    const candidates: ExpiryCandidate[] = await this.dataSource.query(
      `SELECT t."id", t."status", t."departure_at",
              (SELECT count(*) FROM "orders" o
                WHERE o."intercity_trip_id" = t."id"
                  AND o."status" NOT IN ('completed', 'cancelled'))::int AS "active"
         FROM "intercity_trips" t
        WHERE t."status" IN ('open', 'full') AND t."departure_at" <= $1
        ORDER BY t."departure_at" ASC
        LIMIT $2`,
      [earliestCutoff, EXPIRY_BATCH],
    );

    let expired = 0;
    for (const candidate of candidates) {
      const reason = expiryReasonFor(
        { status: candidate.status, departureAt: new Date(candidate.departure_at) },
        candidate.active,
        now,
      );
      if (!reason) continue;
      try {
        const passengerIds = await this.expire(candidate.id, reason, now);
        if (passengerIds) {
          expired += 1;
          // COMMIT'dan keyin; notifier xato tashlamaydi.
          await this.notifier.tripCancelled(candidate.id, reason, passengerIds, 'system');
        }
      } catch (err) {
        // Bitta buzuq qatnov qolganlarini to'xtatmasin.
        this.logger.error(`Qatnov ${candidate.id} yopilmadi: ${err}`);
      }
    }
    if (expired > 0) this.logger.log(`Shaharlararo: ${expired} ta qatnov avtomatik yopildi`);
    return expired;
  }

  /** Yopilsa — bandi bekor bo'lgan yo'lovchilar; boshqa instans ulgurgan bo'lsa `null`. */
  private expire(tripId: string, reason: IntercityExpiryReason, now: Date): Promise<string[] | null> {
    return this.dataSource.transaction(async (manager) => {
      const closed = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE "intercity_trips"
              SET "status" = 'cancelled', "cancel_reason" = $2, "cancelled_at" = $3, "updated_at" = now()
            WHERE "id" = $1 AND "status" IN ('open', 'full')
            RETURNING "id"`,
          [tripId, reason, now],
        ),
      );
      if (closed.length === 0) return null;
      const bookings = returnedRows<{ passenger_id: string }>(
        await manager.query(
          `UPDATE "orders" SET "status" = $2, "cancel_reason" = $3, "updated_at" = now()
            WHERE "intercity_trip_id" = $1 AND "status" = 'scheduled'
            RETURNING "passenger_id"`,
          [tripId, OrderStatus.CANCELLED, STALE_BOOKING_REASON],
        ),
      );
      return bookings.map((booking) => booking.passenger_id);
    });
  }
}
