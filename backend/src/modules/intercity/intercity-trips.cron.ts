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

/** Bir tick'da ko'rib chiqiladigan qatnovlar — backend uzoq o'chib tursa ham yuk cheklangan. */
const EXPIRY_BATCH = 100;

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

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'intercity-trips-expiry' })
  async handleTick(): Promise<void> {
    try {
      await this.expireTrips();
    } catch (err) {
      // Ushlanmagan xato scheduler'ni jim qoldirishi mumkin
      // (`scheduled-orders.service.ts` dagi bilan bir xil himoya).
      this.logger.error(`Shaharlararo qatnovlarni yopish yiqildi: ${err}`);
    }
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
        if (await this.expire(candidate.id, reason, now)) expired += 1;
      } catch (err) {
        // Bitta buzuq qatnov qolganlarini to'xtatmasin.
        this.logger.error(`Qatnov ${candidate.id} yopilmadi: ${err}`);
      }
    }
    if (expired > 0) this.logger.log(`Shaharlararo: ${expired} ta qatnov avtomatik yopildi`);
    return expired;
  }

  private expire(tripId: string, reason: IntercityExpiryReason, now: Date): Promise<boolean> {
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
      if (closed.length === 0) return false;
      await manager.query(
        `UPDATE "orders" SET "status" = $2, "cancel_reason" = $3, "updated_at" = now()
          WHERE "intercity_trip_id" = $1 AND "status" = 'scheduled'
          RETURNING "id"`,
        [tripId, OrderStatus.CANCELLED, STALE_BOOKING_REASON],
      );
      // TODO(intercity, 6-qadam): yo'lovchilarga push ("qatnov bekor bo'ldi").
      return true;
    });
  }
}
