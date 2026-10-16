import { EntityManager } from 'typeorm';
import { SeatRelease } from './intercity-booking-policy';

/**
 * `intercity_trips` dagi o'rindiq hisobining YAGONA yozish nuqtasi.
 *
 * ⚠️ HAR BIR AMAL — BITTA SHARTLI UPDATE. "O'qib, tekshirib, yozish" ikki
 * parallel bandga oxirgi joyni ikki marta berardi. Shart UPDATE'ning
 * `WHERE` ida: Postgres qatorni qulflaydi, ikkinchi so'rov birinchisi
 * commit bo'lishini kutadi va SHARTNI YANGI qiymatga qarab qayta tekshiradi
 * (READ COMMITTED'da UPDATE shunday ishlaydi) — 0 qator qaytadi va
 * chaqiruvchi 409 beradi. CHECK (`seats_taken <= seats_total`) — oxirgi
 * himoya qatlami.
 *
 * Funksiyalar `EntityManager` oladi: chaqiruvchining tranzaksiyasida
 * buyurtma qatori bilan BIRGA yoziladi — joy olinib, buyurtma yozilmay
 * qolishi (yoki aksincha) mumkin emas.
 */

export interface ClaimedTrip {
  id: string;
  seats_taken: number;
  seats_total: number;
  status: string;
}

/**
 * `manager.query` natijasidagi qatorlar.
 *
 * ⚠️ TypeORM (0.3, Postgres) UPDATE/DELETE ... RETURNING uchun `[rows, count]`
 * qaytaradi, SELECT/INSERT uchun esa faqat `rows`. `result.length === 0`
 * deb tekshirish UPDATE'da HECH QACHON ishlamaydi — massiv doim 2 elementli.
 */
export function returnedRows<T>(result: unknown): T[] {
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function firstRow(result: unknown): ClaimedTrip | null {
  return returnedRows<ClaimedTrip>(result)[0] ?? null;
}

/** [seats] ta o'rindiq oladi. Joy yetmasa / qatnov ochiq emas — `null`. */
export async function claimSeats(
  manager: EntityManager,
  tripId: string,
  seats: number,
  now: Date,
): Promise<ClaimedTrip | null> {
  return firstRow(
    await manager.query(
      `UPDATE "intercity_trips"
          SET "seats_taken" = "seats_taken" + $2,
              "status" = CASE WHEN "seats_taken" + $2 = "seats_total" THEN 'full' ELSE "status" END,
              "updated_at" = now()
        WHERE "id" = $1
          AND "status" = 'open'
          AND NOT "whole_car_booked"
          AND "seats_taken" + $2 <= "seats_total"
          AND "departure_at" > $3
        RETURNING "id", "seats_taken", "seats_total", "status"`,
      [tripId, seats, now],
    ),
  );
}

/** Butun mashinani oladi — faqat hech kim o'rindiq olmagan bo'lsa. */
export async function claimWholeCar(
  manager: EntityManager,
  tripId: string,
  now: Date,
): Promise<ClaimedTrip | null> {
  return firstRow(
    await manager.query(
      `UPDATE "intercity_trips"
          SET "whole_car_booked" = true,
              "seats_taken" = "seats_total",
              "status" = 'full',
              "updated_at" = now()
        WHERE "id" = $1
          AND "status" = 'open'
          AND "seats_taken" = 0
          AND NOT "whole_car_booked"
          AND "departure_at" > $2
        RETURNING "id", "seats_taken", "seats_total", "status"`,
      [tripId, now],
    ),
  );
}

/**
 * Bekor qilingan bandning joylarini qaytaradi. To'lgan qatnov jo'nash
 * vaqti hali kelmagan bo'lsa yana `open` bo'ladi — boshqa yo'lovchi band
 * qila olsin. Faqat `open`/`full` qatnovda: yo'lga chiqqan qatnovga joy
 * qaytarishning ma'nosi yo'q.
 */
export async function releaseSeats(
  manager: EntityManager,
  tripId: string,
  release: SeatRelease,
  now: Date,
): Promise<ClaimedTrip | null> {
  return firstRow(
    await manager.query(
      `UPDATE "intercity_trips"
          SET "seats_taken" = GREATEST("seats_taken" - $2, 0),
              "whole_car_booked" = CASE WHEN $3 THEN false ELSE "whole_car_booked" END,
              "status" = CASE WHEN "status" = 'full' AND "departure_at" > $4 THEN 'open' ELSE "status" END,
              "updated_at" = now()
        WHERE "id" = $1 AND "status" IN ('open', 'full')
        RETURNING "id", "seats_taken", "seats_total", "status"`,
      [tripId, release.seats, release.clearsWholeCar, now],
    ),
  );
}

/**
 * Yo'ldagi qatnovning oxirgi bandi yakunlangan bo'lsa qatnovni ham
 * yakunlaydi. `OrdersCompletionService` buni buyurtma qatori COMPLETED
 * bo'lgan O'SHA tranzaksiyada chaqiradi, shuning uchun `NOT EXISTS` shu
 * buyurtmani allaqachon yakunlangan deb ko'radi. Ikki band bir vaqtda
 * yakunlansa — har biri o'z tranzaksiyasida qolganini ko'radi; oxirgi commit
 * bo'lgani qatnovni yopadi (UPDATE qatorni qulflaydi va shartni qayta
 * tekshiradi).
 */
export async function completeTripIfDone(
  manager: EntityManager,
  tripId: string,
  now: Date,
): Promise<boolean> {
  const row = firstRow(
    await manager.query(
      `UPDATE "intercity_trips" t
          SET "status" = 'completed', "completed_at" = $2, "updated_at" = now()
        WHERE t."id" = $1
          AND t."status" = 'in_progress'
          AND NOT EXISTS (
            SELECT 1 FROM "orders" o
             WHERE o."intercity_trip_id" = t."id"
               AND o."status" NOT IN ('completed', 'cancelled')
          )
        RETURNING t."id", t."seats_taken", t."seats_total", t."status"`,
      [tripId, now],
    ),
  );
  return row !== null;
}
