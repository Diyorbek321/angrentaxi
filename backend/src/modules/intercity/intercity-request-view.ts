import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { IntercityRequest, IntercityRequestStatus } from '../../database/entities/intercity-request.entity';
import { IntercityBookingKind } from '../../database/entities/order.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { User } from '../../database/entities/user.entity';
import { IntercityExtensionCharge } from '../tariffs/fare-breakdown';
import { INTERCITY_REQUEST_BONUS_STEP, maxRequestBonus } from './intercity-request-policy';

interface PlaceView {
  lat: number;
  lng: number;
  address: string;
}

/**
 * So'rov — yo'lovchiga va haydovchi doskasiga BIR XIL ko'rinish. Yo'lovchi
 * ismi/telefoni YO'Q: haydovchi ularni faqat qabul qilgandan keyin, band
 * orqali ko'radi (`intercity-booking-driver-view.ts` qoidalari bilan).
 */
export interface IntercityRequestView {
  id: string;
  status: IntercityRequestStatus;
  routeId: string;
  originName: string | null;
  destinationName: string | null;
  tripClass: IntercityTripClass;
  kind: IntercityBookingKind;
  seats: number;
  pickup: PlaceView;
  dropoff: PlaceView;
  /** ISO 8601, UTC. */
  windowStart: string;
  windowEnd: string;
  /** Qat'iy narx + davom (oshirishsiz). */
  basePrice: number;
  extensions: IntercityExtensionCharge[];
  bonus: number;
  total: number;
  /** Ilova "+" tugmasi uchun. */
  maxBonus: number;
  bonusStep: number;
  tripId: string | null;
  orderId: string | null;
  createdAt: string;
}

/** Dispetcher — yo'lovchi telefoni bilan (u qo'ng'iroq qilib so'rovni aniqlaydi). */
export interface IntercityRequestManageView extends IntercityRequestView {
  passengerName: string | null;
  passengerPhone: string | null;
}

export type IntercityRequestWithRoute = IntercityRequest & {
  route?: (IntercityRoute & { originPoint?: IntercityPoint; destinationPoint?: IntercityPoint }) | null;
  passenger?: User | null;
};

export function toIntercityRequestView(request: IntercityRequestWithRoute): IntercityRequestView {
  const basePrice = Number(request.basePrice);
  const bonus = Number(request.bonus);
  return {
    id: request.id,
    status: request.status,
    routeId: request.routeId,
    originName: request.route?.originPoint?.name ?? null,
    destinationName: request.route?.destinationPoint?.name ?? null,
    tripClass: request.tripClass,
    kind: request.kind,
    seats: request.seats,
    pickup: { lat: Number(request.pickupLat), lng: Number(request.pickupLng), address: request.pickupAddress },
    dropoff: { lat: Number(request.dropoffLat), lng: Number(request.dropoffLng), address: request.dropoffAddress },
    windowStart: new Date(request.windowStart).toISOString(),
    windowEnd: new Date(request.windowEnd).toISOString(),
    basePrice,
    extensions: request.fareBreakdown?.intercityExtensions ?? [],
    bonus,
    total: basePrice + bonus,
    maxBonus: maxRequestBonus(basePrice),
    bonusStep: INTERCITY_REQUEST_BONUS_STEP,
    tripId: request.tripId,
    orderId: request.orderId,
    createdAt: new Date(request.createdAt).toISOString(),
  };
}

export function toIntercityRequestManageView(request: IntercityRequestWithRoute): IntercityRequestManageView {
  const passenger = request.passenger;
  const name = [passenger?.firstName, passenger?.lastName].filter(Boolean).join(' ');
  return {
    ...toIntercityRequestView(request),
    passengerName: name || null,
    passengerPhone: passenger?.phone ?? null,
  };
}
