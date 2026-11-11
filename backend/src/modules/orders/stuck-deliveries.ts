import { DeliveryIncidentSettings } from '../settings/delivery-incident-settings';

/** "Osilib qolgan" yetkazish sababi (docs/INCIDENT-POLICY.md §2). */
export type StuckReason = 'too_long' | 'stale_location';

/** Dispetcher "Istisnolar" sahifasidagi qator. */
export interface StuckDelivery {
  orderId: string;
  status: string;
  serviceType: string;
  /** "Qaytarilmoqda" (yetkazib bo'lmadi belgilangan). */
  returning: boolean;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  startedAt: string | null;
  locationUpdatedAt: string | null;
  reasons: StuckReason[];
}

export interface ActiveDeliveryRow {
  id: string;
  status: string;
  service_type: string;
  driver_id: string | null;
  driver_first_name: string | null;
  driver_last_name: string | null;
  driver_phone: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  delivery_failed_at: Date | string | null;
  start_time: Date | string | null;
  location_updated_at: Date | string | null;
}

const toDate = (value: Date | string | null): Date | null => (value == null ? null : new Date(value));

/**
 * Sabablar: IN_PROGRESS `stuckDeliveryMinutes` dan uzoq yoki kuryer
 * joylashuvi `staleCourierLocationMinutes` dan eski (yoki umuman yo'q).
 * Vaqtlar JS'da solishtiriladi — `trips.start_time` mintaqasiz `timestamp`
 * va JS `Date` dan yozilgan (kutish hisobi bilan bir xil soat).
 */
export function stuckReasonsOf(
  row: ActiveDeliveryRow,
  now: Date,
  settings: Pick<DeliveryIncidentSettings, 'stuckDeliveryMinutes' | 'staleCourierLocationMinutes'>,
): StuckReason[] {
  const reasons: StuckReason[] = [];
  const started = toDate(row.start_time);
  if (row.status === 'in_progress' && started && now.getTime() - started.getTime() > settings.stuckDeliveryMinutes * 60_000) {
    reasons.push('too_long');
  }
  const seen = toDate(row.location_updated_at);
  if (!seen || now.getTime() - seen.getTime() > settings.staleCourierLocationMinutes * 60_000) {
    reasons.push('stale_location');
  }
  return reasons;
}

export function toStuckDelivery(row: ActiveDeliveryRow, reasons: StuckReason[]): StuckDelivery {
  const name = [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ').trim();
  return {
    orderId: row.id,
    status: row.status,
    serviceType: row.service_type,
    returning: row.status === 'in_progress' && row.delivery_failed_at != null,
    driverId: row.driver_id,
    driverName: name || null,
    driverPhone: row.driver_phone,
    pickupAddress: row.pickup_address,
    dropoffAddress: row.dropoff_address,
    startedAt: toDate(row.start_time)?.toISOString() ?? null,
    locationUpdatedAt: toDate(row.location_updated_at)?.toISOString() ?? null,
    reasons,
  };
}
