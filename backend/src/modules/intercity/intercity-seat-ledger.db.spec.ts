import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { claimSeats, claimWholeCar, releaseSeats } from './intercity-seat-ledger';

/**
 * O'rindiq hisobining POYGA isboti — haqiqiy Postgres'da, IKKI ulanish bilan.
 *
 * Mock'langan spec SQL matnini tekshiradi; "oxirgi joyni ikki kishi bir
 * vaqtda olsa — faqat bittasi oladi" ni esa faqat haqiqiy qator qulfi
 * isbotlaydi. A ulanish tranzaksiyada oxirgi joyni oladi (commit qilmaydi),
 * B xuddi shu joyni so'raydi va QULFDA KUTADI; A commit bo'lgach B shartni
 * yangi qiymatga qarab qayta tekshiradi va 0 qator oladi.
 *
 * Bazadagi ma'lumotga tegmaydi: har ishga tushishda alohida schema ochiladi
 * (`public.intercity_trips` tuzilmasi CHECK'lari bilan nusxalanadi, FK'siz)
 * va oxirida o'chiriladi.
 *
 * Faqat `INTERCITY_DB_SPEC_DATABASE_URL` berilganda ishlaydi (masalan
 * `postgres://angren:angren_pass@localhost:5433/angren_taxi`), aks holda
 * o'tkazib yuboriladi — CI'da Postgres bo'lmasa ham suite yashil qoladi.
 */
const url = process.env.INTERCITY_DB_SPEC_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const SCHEMA = `intercity_spec_${process.pid}`;
const TRIP = '00000000-0000-0000-0000-0000000000c1';
const NOW = new Date('2026-10-20T03:00:00.000Z');
const DEPARTURE = new Date('2026-10-20T07:00:00.000Z');

describeDb('intercity-seat-ledger — parallel band (Postgres)', () => {
  let ds: DataSource;
  let a: QueryRunner;
  let b: QueryRunner;

  const asManager = (runner: QueryRunner) =>
    ({ query: (sql: string, params?: unknown[]) => runner.query(sql, params) }) as unknown as EntityManager;

  const seedTrip = async (overrides: { seatsTotal?: number; seatsTaken?: number } = {}) => {
    await a.query(`DELETE FROM "intercity_trips"`);
    await a.query(
      `INSERT INTO "intercity_trips" ("id", "route_id", "driver_id", "class", "departure_at", "seats_total",
         "seats_taken", "whole_car_booked", "status", "seat_price", "whole_car_price")
       VALUES ($1, gen_random_uuid(), gen_random_uuid(), 'start', $2, $3, $4, false, 'open', 25000, 100000)`,
      [TRIP, DEPARTURE, overrides.seatsTotal ?? 4, overrides.seatsTaken ?? 3],
    );
  };

  const readTrip = async () =>
    ((await a.query(`SELECT "seats_taken", "status", "whole_car_booked" FROM "intercity_trips" WHERE "id" = $1`, [TRIP])) as Array<{
      seats_taken: number;
      status: string;
      whole_car_booked: boolean;
    }>)[0];

  beforeAll(async () => {
    ds = new DataSource({ type: 'postgres', url, entities: [] });
    await ds.initialize();
    await ds.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
    await ds.query(
      `CREATE TABLE IF NOT EXISTS "${SCHEMA}"."intercity_trips" (LIKE public."intercity_trips" INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`,
    );
    a = ds.createQueryRunner();
    b = ds.createQueryRunner();
    await a.connect();
    await b.connect();
    for (const runner of [a, b]) await runner.query(`SET search_path TO "${SCHEMA}", public`);
  });

  afterAll(async () => {
    await a?.release();
    await b?.release();
    await ds?.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await ds?.destroy();
  });

  it("oxirgi joy: ikki parallel band — FAQAT bittasi oladi, qatnov 'full'", async () => {
    await seedTrip({ seatsTotal: 4, seatsTaken: 3 });

    await a.startTransaction();
    await b.startTransaction();
    const first = await claimSeats(asManager(a), TRIP, 1, NOW);
    // B qatorda qulf kutadi — A commit qilmaguncha javob kelmaydi.
    const secondPromise = claimSeats(asManager(b), TRIP, 1, NOW);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await a.commitTransaction();
    const second = await secondPromise;
    await b.commitTransaction();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    await expect(readTrip()).resolves.toMatchObject({ seats_taken: 4, status: 'full' });
  });

  it("butun mashina va o'rindiq bir vaqtda — faqat bittasi o'tadi", async () => {
    await seedTrip({ seatsTotal: 4, seatsTaken: 0 });

    await a.startTransaction();
    await b.startTransaction();
    const seat = await claimSeats(asManager(a), TRIP, 1, NOW);
    const wholePromise = claimWholeCar(asManager(b), TRIP, NOW);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await a.commitTransaction();
    const whole = await wholePromise;
    await b.commitTransaction();

    expect(seat).not.toBeNull();
    expect(whole).toBeNull();
    await expect(readTrip()).resolves.toMatchObject({ seats_taken: 1, whole_car_booked: false, status: 'open' });
  });

  it("A bekor qilinsa (rollback) — kutayotgan B joyni oladi", async () => {
    await seedTrip({ seatsTotal: 4, seatsTaken: 3 });

    await a.startTransaction();
    await b.startTransaction();
    await claimSeats(asManager(a), TRIP, 1, NOW);
    const secondPromise = claimSeats(asManager(b), TRIP, 1, NOW);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await a.rollbackTransaction();
    const second = await secondPromise;
    await b.commitTransaction();

    expect(second).not.toBeNull();
    await expect(readTrip()).resolves.toMatchObject({ seats_taken: 4, status: 'full' });
  });

  it("bekor qilish joyni qaytaradi va to'lgan qatnovni yana ochadi; butun mashina bayrog'i tozalanadi", async () => {
    await seedTrip({ seatsTotal: 4, seatsTaken: 0 });
    await claimWholeCar(asManager(a), TRIP, NOW);
    await expect(readTrip()).resolves.toMatchObject({ seats_taken: 4, whole_car_booked: true, status: 'full' });

    await releaseSeats(asManager(a), TRIP, { seats: 4, clearsWholeCar: true }, NOW);
    await expect(readTrip()).resolves.toMatchObject({ seats_taken: 0, whole_car_booked: false, status: 'open' });
  });

  it("jo'nash vaqti o'tgan qatnovga band yozilmaydi", async () => {
    await seedTrip({ seatsTotal: 4, seatsTaken: 0 });
    await expect(claimSeats(asManager(a), TRIP, 1, new Date(DEPARTURE.getTime() + 1))).resolves.toBeNull();
  });

  it("CHECK oxirgi himoya: seats_taken > seats_total bazada rad etiladi", async () => {
    await seedTrip({ seatsTotal: 4, seatsTaken: 4 });
    await expect(a.query(`UPDATE "intercity_trips" SET "seats_taken" = 5 WHERE "id" = $1`, [TRIP])).rejects.toThrow();
  });
});
