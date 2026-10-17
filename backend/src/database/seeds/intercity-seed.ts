import { QueryRunner } from 'typeorm';

/**
 * Shaharlararo nuqtalar va yo'nalishlar (dev seed). Migratsiya 034 qator
 * qo'ymaydi — prod'da bular admin paneli orqali kiritiladi.
 *
 * Idempotent: avval o'chiradi, keyin qayta yozadi (seed.ts dagi boshqa
 * jadvallar bilan bir xil yondashuv).
 */
interface PointSeed {
  key: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  /** "Shahar ichiga davom" (migratsiya 038); yo'q — o'chiq. */
  extension?: { maxKm: number; pricePerKm: number; comfortPricePerKm: number | null };
}

interface RouteSeed {
  from: string;
  to: string;
  seatPrice: number;
  wholeCarPrice: number;
  comfortSeatPrice: number | null;
  comfortWholeCarPrice: number | null;
}

const POINTS: readonly PointSeed[] = [
  { key: 'angren', name: 'Angren', lat: 40.0956, lng: 70.9432, radiusKm: 12 },
  // "Rohat krugi" — Toshkentdagi aylanma, qat'iy olish/tushirish joyi, butun
  // Toshkent EMAS. Koordinata egasidan (41°16'04.9"N 69°22'00.5"E). Narx
  // aylanmagacha; undan shahar ichiga davom — yo'l km haqi: Start 2 000,
  // Comfort 2 500 so'm/km (egasi qarori, 2026-10-17), 30 km gacha.
  {
    key: 'rohat',
    name: 'Rohat krugi (Toshkent)',
    lat: 41.268028,
    lng: 69.366806,
    radiusKm: 1.5,
    extension: { maxKm: 30, pricePerKm: 2000, comfortPricePerKm: 2500 },
  },
  { key: 'olmaliq', name: 'Olmaliq', lat: 40.8447, lng: 69.5986, radiusKm: 10 },
  { key: 'ohangaron', name: 'Ohangaron', lat: 40.9064, lng: 69.6383, radiusKm: 8 },
];

/** Har bir juftlik ikkala yo'nalishda yoziladi. */
const ROUTE_PAIRS: readonly RouteSeed[] = [
  // Egasi bergan narxlar (2026-10-17), Rohat krugigacha: Start 25 000,
  // Comfort 30 000 — bitta o'rindiq; butun mashina = 4 o'rindiq.
  {
    from: 'angren',
    to: 'rohat',
    seatPrice: 25000,
    wholeCarPrice: 100000,
    comfortSeatPrice: 30000,
    comfortWholeCarPrice: 120000,
  },
  // PLACEHOLDER — egasi narxini bermagan.
  { from: 'angren', to: 'olmaliq', seatPrice: 15000, wholeCarPrice: 60000, comfortSeatPrice: null, comfortWholeCarPrice: null },
  // PLACEHOLDER — egasi narxini bermagan.
  { from: 'angren', to: 'ohangaron', seatPrice: 12000, wholeCarPrice: 48000, comfortSeatPrice: null, comfortWholeCarPrice: null },
];

export async function seedIntercity(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DELETE FROM intercity_routes;`);
  await queryRunner.query(`DELETE FROM intercity_points;`);

  const ids = new Map<string, string>();
  for (const [index, point] of POINTS.entries()) {
    const [row] = await queryRunner.query(
      `INSERT INTO intercity_points (name, center_lat, center_lng, radius_km, sort_order,
         extension_max_km, extension_price_per_km, extension_comfort_price_per_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        point.name,
        point.lat,
        point.lng,
        point.radiusKm,
        index,
        point.extension?.maxKm ?? 0,
        point.extension?.pricePerKm ?? 0,
        point.extension?.comfortPricePerKm ?? null,
      ],
    );
    ids.set(point.key, row.id);
  }

  let sortOrder = 0;
  for (const pair of ROUTE_PAIRS) {
    for (const [from, to] of [
      [pair.from, pair.to],
      [pair.to, pair.from],
    ]) {
      await queryRunner.query(
        `INSERT INTO intercity_routes
           (origin_point_id, destination_point_id, seat_price, whole_car_price,
            comfort_seat_price, comfort_whole_car_price, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ids.get(from),
          ids.get(to),
          pair.seatPrice,
          pair.wholeCarPrice,
          pair.comfortSeatPrice,
          pair.comfortWholeCarPrice,
          sortOrder++,
        ],
      );
    }
  }
}
