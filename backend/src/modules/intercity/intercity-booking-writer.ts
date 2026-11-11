import { InternalServerErrorException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { ERROR_CODES, codedConflict } from '../../common/errors/coded-error';
import { IntercityBookingKind, OrderStatus, PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import { Tariff } from '../../database/entities/tariff.entity';
import { FareBreakdown } from '../tariffs/fare-breakdown';
import { returnedRows } from './intercity-seat-ledger';

/**
 * Band = `orders` qatori — YAGONA yozish nuqtasi. Yo'lovchi o'zi band
 * qilganda ham (`IntercityBookingsService.book`), haydovchi so'rovni qabul
 * qilganda ham (`IntercityRequestsService.accept`) buyurtma aynan bir xil
 * ko'rinishda yoziladi — komissiya, chek va yakunlash ikkalasini farqlamaydi.
 *
 * Chaqiruvchining tranzaksiyasida, o'rindiq olingandan KEYIN chaqiriladi.
 */

interface BookingPlace {
  lat: number;
  lng: number;
  address: string;
}

export interface BookingOrderInsert {
  passengerId: string;
  /** `users.id` (qatnovdagi `drivers.id` EMAS). */
  driverUserId: string;
  tariffId: string;
  tripId: string;
  departureAt: Date;
  seats: number;
  kind: IntercityBookingKind;
  pickup: BookingPlace;
  dropoff: BookingPlace;
  fare: FareBreakdown;
  paymentMethod: PaymentMethod;
}

export async function insertBookingOrder(manager: EntityManager, booking: BookingOrderInsert): Promise<string> {
  const inserted = returnedRows<{ id: string }>(
    await manager.query(
      `INSERT INTO "orders" ("passenger_id", "driver_id", "tariff_id", "pickup_location", "dropoff_location",
         "pickup_address", "dropoff_address", "estimated_price", "status", "payment_method",
         "service_type", "fare_breakdown", "is_fixed_price", "scheduled_at",
         "intercity_trip_id", "seats", "booking_kind")
       VALUES ($1, $2, $3,
         ST_SetSRID(ST_MakePoint($4, $5), 4326),
         ST_SetSRID(ST_MakePoint($6, $7), 4326),
         $8, $9, $10, $11, $12, $13, $14::jsonb, true, $15, $16, $17, $18)
       RETURNING "id"`,
      [
        booking.passengerId,
        booking.driverUserId,
        booking.tariffId,
        booking.pickup.lng,
        booking.pickup.lat,
        booking.dropoff.lng,
        booking.dropoff.lat,
        booking.pickup.address,
        booking.dropoff.address,
        booking.fare.total,
        // SCHEDULED: haydovchi allaqachon ma'lum, lekin u yo'lovchilarni
        // yig'ishni boshlaguncha (`start-boarding`) buyurtma haydovchini
        // BAND qilmaydi — u shu orada shahar ichida ishlay oladi.
        OrderStatus.SCHEDULED,
        booking.paymentMethod,
        ServiceType.INTERCITY,
        JSON.stringify(booking.fare),
        booking.departureAt,
        booking.tripId,
        booking.seats,
        booking.kind,
      ],
    ),
  );
  return inserted[0].id;
}

/** Yo'lovchining shu qatnovdagi tugamagan bandi bo'lsa — 409. */
export async function assertNoActiveBooking(manager: EntityManager, tripId: string, passengerId: string): Promise<void> {
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

/** 035 migratsiyasi qo'ygan "Shaharlararo" tarifi (`orders.tariff_id` NOT NULL). */
export async function intercityTariffId(tariffRepository: Repository<Tariff>): Promise<string> {
  const tariff = await tariffRepository.findOne({
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
