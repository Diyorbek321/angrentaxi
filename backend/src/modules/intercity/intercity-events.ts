/**
 * Shaharlararo realtime hodisalari — mobil ilova va panellar bilan KONTRAKT.
 * Nomlarni o'zgartirmang, faqat qo'shing.
 *
 * Bu fayl Nest DI'siz (sof funksiyalar): `OrdersCompletionService` ham
 * qatnov yakunlanganini e'lon qiladi, lekin u `IntercityModule` ni import
 * qilmaydi (aylanma bog'liqlik bo'lardi) — `intercity-seat-ledger.ts` dagi
 * bilan bir xil yondashuv.
 */
export const INTERCITY_EVENTS = {
  /** {@link IntercityTripUpdatedPayload} → haydovchi, faol yo'lovchilar, menejerlar. */
  TRIP_UPDATED: 'intercity:trip:updated',
  /** `{ tripId, reason }` → bandi bekor bo'lgan yo'lovchilar. */
  TRIP_CANCELLED: 'intercity:trip:cancelled',
  /** {@link IntercityBookingEventPayload} → haydovchi. */
  BOOKING_CREATED: 'intercity:booking:created',
  /** {@link IntercityBookingEventPayload} → haydovchi. */
  BOOKING_CANCELLED: 'intercity:booking:cancelled',
} as const;

export interface IntercityTripUpdatedPayload {
  tripId: string;
  status: string;
  seatsTaken: number;
  seatsTotal: number;
  wholeCarBooked: boolean;
  /** ISO 8601, UTC. */
  departureAt: string;
}

export interface IntercityBookingEventPayload {
  tripId: string;
  orderId: string;
  seats: number;
  bookingKind: string;
}

export interface IntercityTripCancelledPayload {
  tripId: string;
  reason: string;
}

export interface IntercityTripSnapshot {
  payload: IntercityTripUpdatedPayload;
  driverUserId: string;
  /** Bandi hali tugamagan (completed/cancelled emas) yo'lovchilar. */
  passengerIds: string[];
}

/** `DataSource`, `EntityManager` yoki repository `.manager` — hammasi mos. */
export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

/** `RealtimeGateway` ning kerakli qismi — testda oddiy mock. */
export interface IntercityEmitter {
  emitToUser(userId: string, event: string, data: unknown): void;
  emitToManagers(event: string, data: unknown): void;
}

interface SnapshotRow {
  id: string;
  status: string;
  seats_taken: number | string;
  seats_total: number | string;
  whole_car_booked: boolean;
  departure_at: Date | string;
  driver_user_id: string;
  passenger_ids: string[] | null;
}

/** Xom qatordan payload — pg int/bool turlari drayverga qarab string kelishi mumkin. */
export function tripUpdatedPayload(row: Omit<SnapshotRow, 'driver_user_id' | 'passenger_ids'>): IntercityTripUpdatedPayload {
  return {
    tripId: row.id,
    status: row.status,
    seatsTaken: Number(row.seats_taken),
    seatsTotal: Number(row.seats_total),
    wholeCarBooked: row.whole_car_booked === true,
    departureAt: new Date(row.departure_at).toISOString(),
  };
}

/**
 * Qatnovning JORIY holati va kimga yuborish kerakligi — bitta so'rovda.
 * Tranzaksiya COMMIT bo'lgandan KEYIN chaqiriladi: aks holda boshqa
 * ulanishdan o'qilganda eski holat ko'rinardi.
 */
export async function loadTripSnapshot(db: Queryable, tripId: string): Promise<IntercityTripSnapshot | null> {
  const rows = (await db.query(
    `SELECT t."id", t."status", t."seats_taken", t."seats_total", t."whole_car_booked", t."departure_at",
            d."user_id" AS "driver_user_id",
            ARRAY(SELECT DISTINCT o."passenger_id" FROM "orders" o
                   WHERE o."intercity_trip_id" = t."id"
                     AND o."status" NOT IN ('completed', 'cancelled')) AS "passenger_ids"
       FROM "intercity_trips" t
       JOIN "drivers" d ON d."id" = t."driver_id"
      WHERE t."id" = $1`,
    [tripId],
  )) as SnapshotRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    payload: tripUpdatedPayload(row),
    driverUserId: row.driver_user_id,
    passengerIds: row.passenger_ids ?? [],
  };
}

/** `intercity:trip:updated` — haydovchi, faol yo'lovchilar va menejerlarga. */
export async function publishTripUpdated(
  db: Queryable,
  emitter: IntercityEmitter,
  tripId: string,
): Promise<IntercityTripSnapshot | null> {
  const snapshot = await loadTripSnapshot(db, tripId);
  if (!snapshot) return null;
  const recipients = new Set([snapshot.driverUserId, ...snapshot.passengerIds]);
  for (const userId of recipients) {
    emitter.emitToUser(userId, INTERCITY_EVENTS.TRIP_UPDATED, snapshot.payload);
  }
  emitter.emitToManagers(INTERCITY_EVENTS.TRIP_UPDATED, snapshot.payload);
  return snapshot;
}
