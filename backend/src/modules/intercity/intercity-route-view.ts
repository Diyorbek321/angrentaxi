import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';

/** Ilovaga ko'rinadigan nuqta — tartib/holat kabi ichki maydonlarsiz. */
export interface IntercityPointView {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

/**
 * `GET /intercity/routes` elementi.
 *
 * Comfort narxlari alohida guruhda: `comfort: null` — bu yo'nalishda
 * komfort yo'q. Ikkita alohida nullable maydondan ko'ra ilova uchun aniqroq —
 * "biri bor, biri yo'q" holati shaklning o'zida mumkin emas.
 */
export interface IntercityRouteView {
  id: string;
  origin: IntercityPointView;
  destination: IntercityPointView;
  seatPrice: number;
  wholeCarPrice: number;
  comfort: { seatPrice: number; wholeCarPrice: number } | null;
  seatsDefault: number;
}

export function toIntercityPointView(point: IntercityPoint): IntercityPointView {
  return {
    id: point.id,
    name: point.name,
    centerLat: point.centerLat,
    centerLng: point.centerLng,
    radiusKm: point.radiusKm,
  };
}

/** `originPoint`/`destinationPoint` yuklangan bo'lishi shart. */
export function toIntercityRouteView(
  route: IntercityRoute & { originPoint: IntercityPoint; destinationPoint: IntercityPoint },
): IntercityRouteView {
  const comfort =
    route.comfortSeatPrice !== null && route.comfortWholeCarPrice !== null
      ? { seatPrice: route.comfortSeatPrice, wholeCarPrice: route.comfortWholeCarPrice }
      : null;
  return {
    id: route.id,
    origin: toIntercityPointView(route.originPoint),
    destination: toIntercityPointView(route.destinationPoint),
    seatPrice: route.seatPrice,
    wholeCarPrice: route.wholeCarPrice,
    comfort,
    seatsDefault: route.seatsDefault,
  };
}
