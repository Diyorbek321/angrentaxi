import { Order, OrderStatus } from '../../database/entities/order.entity';

export interface TrackingPoint {
  address: string | null;
  lat: number;
  lng: number;
}

/**
 * The courier ride as the food/market customer sees it: who is bringing the
 * bag, in which car, and the two ends of the trip for the live map.
 *
 * `orderId` is the courier ride's id — the customer joins `order:<orderId>`
 * to receive the courier's `driver:location` pings. That already works
 * because the ride is created with `passengerId = customerId`, so the
 * gateway's room check lets the customer in.
 */
export interface CourierTracking {
  orderId: string;
  status: OrderStatus;
  driverName: string | null;
  driverPhone: string | null;
  carModel: string | null;
  carNumber: string | null;
  pickup: TrackingPoint | null;
  dropoff: TrackingPoint | null;
  /** Yetkazish hodisalari (INCIDENT-POLICY §2): kuryer manzilga yetdi / yetkazib bo'lmadi. */
  dropoffArrivedAt: string | null;
  deliveryFailedAt: string | null;
  deliveryFailureReason: string | null;
  /** `returned` — qaytarildi; `null` — topshirildi yoki hali yo'lda. */
  deliveryOutcome: string | null;
  /**
   * Topshirish kodi — FAQAT mijozga (`withHandoverCode`); sotuvchi panelida
   * va kuryerda hech qachon. Bu yerda doim `null`.
   */
  handoverCode: string | null;
}

/**
 * Expects a ride read through `OrdersService.findByIdOrThrow`, which attaches
 * `pickup`/`dropoff` as {address, lat, lng} and the driver's car fields (the
 * raw columns are PostGIS geometry and a bare User).
 */
export function courierTracking(ride: Order): CourierTracking {
  const record = ride as unknown as Record<string, unknown>;
  const driver = ride.driver as unknown as Record<string, unknown> | null;

  return {
    orderId: ride.id,
    status: ride.status,
    driverName:
      [ride.driver?.firstName, ride.driver?.lastName].filter(Boolean).join(' ').trim() || null,
    driverPhone: ride.driver?.phone ?? null,
    carModel: (driver?.carModel as string | null | undefined) ?? null,
    carNumber: (driver?.carNumber as string | null | undefined) ?? null,
    pickup: toPoint(record.pickup),
    dropoff: toPoint(record.dropoff),
    dropoffArrivedAt: isoOrNull(ride.dropoffArrivedAt),
    deliveryFailedAt: isoOrNull(ride.deliveryFailedAt),
    deliveryFailureReason: ride.deliveryFailureReason ?? null,
    deliveryOutcome: ride.deliveryOutcome ?? null,
    handoverCode: null,
  };
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  return value == null ? null : new Date(value).toISOString();
}

/** A point without coordinates is dropped rather than drawn at (0, 0). */
function toPoint(value: unknown): TrackingPoint | null {
  if (!value || typeof value !== 'object') return null;
  const { address, lat, lng } = value as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { address: typeof address === 'string' ? address : null, lat, lng };
}
