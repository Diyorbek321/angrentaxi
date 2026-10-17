import { Driver } from '../../database/entities/driver.entity';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import {
  IntercityTrip,
  IntercityTripClass,
  IntercityTripStatus,
} from '../../database/entities/intercity-trip.entity';
import { User } from '../../database/entities/user.entity';

/**
 * Yo'lovchiga ko'rinadigan haydovchi ma'lumoti.
 *
 * ⚠️ TELEFON YO'Q — ataylab. Band qilinmagan qatnov ro'yxatini istalgan
 * foydalanuvchi ko'radi; telefon raqamlari ro'yxatdan yig'ib olinib,
 * platformani chetlab "to'g'ridan-to'g'ri kelishuv"ga ishlatilardi.
 * Aloqa band qilingandan keyin, buyurtma orqali (chat/qo'ng'iroq).
 */
export interface IntercityTripDriverView {
  firstName: string | null;
  rating: number;
  carModel: string | null;
  plate: string | null;
}

/** Haydovchi tanlagan tuman (yo'lovchiga "qaysi tomonga boradi" ko'rinadi). */
export interface IntercityTripZoneView {
  id: string;
  name: string;
}

/**
 * Yo'lovchi manzili bilan qidirilganda: qatnov unga mosmi (`intercity-fit.service.ts`).
 * `out_of_zone` — boshqa tumanga; `detour` — mashinani ortiqcha aylantiradi.
 */
export interface IntercityTripFitView {
  fit: 'ok' | 'out_of_zone' | 'detour';
  addedMinutes: number | null;
  detourChecked: boolean;
  zoneNames: string[];
}

export interface IntercityTripView {
  id: string;
  route: {
    id: string;
    origin: { id: string; name: string };
    destination: { id: string; name: string };
  };
  tripClass: IntercityTripClass;
  departureAt: string;
  status: IntercityTripStatus;
  seatsTotal: number;
  seatsLeft: number;
  /** Butun mashina hali olinishi mumkin: hech kim o'rindiq olmagan. */
  wholeCarAvailable: boolean;
  /** Butun mashina allaqachon band qilingan (o'rindiq sotilmaydi). */
  wholeCarBooked: boolean;
  seatPrice: number;
  wholeCarPrice: number;
  driver: IntercityTripDriverView | null;
  cancelReason: string | null;
  /** Tomonlar bo'yicha tanlangan tumanlar; bo'sh — butun davom hududi. */
  zones: { origin: IntercityTripZoneView[]; destination: IntercityTripZoneView[] };
  /** Faqat yo'lovchi manzili bilan qidirilganda; aks holda null. */
  fit: IntercityTripFitView | null;
}

/** View'ga qo'shimcha: tumanlar va qidiruv belgisi (ikkalasi ixtiyoriy). */
export interface IntercityTripViewExtras {
  zones?: {
    origin: ReadonlyArray<{ id: string; name: string }>;
    destination: ReadonlyArray<{ id: string; name: string }>;
  };
  fit?: IntercityTripFitView | null;
}

/** Faqat dispetcher/admin uchun — haydovchiga qo'ng'iroq qilish kerak bo'ladi. */
export interface IntercityTripManageDriverView extends IntercityTripDriverView {
  phone: string | null;
}

/**
 * Menejer ko'rinishi. ⚠️ Faqat `trips/manage` (MANAGER/ADMIN + DISPATCH)
 * qaytaradi — ommaviy yo'llarda HECH QACHON ishlatilmaydi.
 */
export interface IntercityTripManageView extends Omit<IntercityTripView, 'driver'> {
  driver: IntercityTripManageDriverView | null;
}

export type IntercityTripWithRelations = IntercityTrip & {
  route?: (IntercityRoute & { originPoint?: IntercityPoint; destinationPoint?: IntercityPoint }) | undefined;
  driver?: (Driver & { user?: User }) | undefined;
};

function toDriverView(driver: (Driver & { user?: User }) | undefined): IntercityTripDriverView | null {
  if (!driver) return null;
  return {
    firstName: driver.user?.firstName ?? null,
    rating: driver.rating,
    carModel: driver.carModel,
    plate: driver.licensePlate ?? driver.carNumber,
  };
}

const zoneView = (zone: { id: string; name: string }): IntercityTripZoneView => ({ id: zone.id, name: zone.name });

export function toIntercityTripView(
  trip: IntercityTripWithRelations,
  extras: IntercityTripViewExtras = {},
): IntercityTripView {
  const seatsLeft = trip.wholeCarBooked ? 0 : trip.seatsTotal - trip.seatsTaken;
  return {
    id: trip.id,
    route: {
      id: trip.routeId,
      origin: { id: trip.route?.originPointId ?? '', name: trip.route?.originPoint?.name ?? '' },
      destination: {
        id: trip.route?.destinationPointId ?? '',
        name: trip.route?.destinationPoint?.name ?? '',
      },
    },
    tripClass: trip.tripClass,
    departureAt: trip.departureAt.toISOString(),
    status: trip.status,
    seatsTotal: trip.seatsTotal,
    seatsLeft,
    wholeCarAvailable:
      trip.status === IntercityTripStatus.OPEN && trip.seatsTaken === 0 && !trip.wholeCarBooked,
    wholeCarBooked: trip.wholeCarBooked,
    seatPrice: trip.seatPrice,
    wholeCarPrice: trip.wholeCarPrice,
    driver: toDriverView(trip.driver),
    cancelReason: trip.cancelReason,
    zones: {
      origin: (extras.zones?.origin ?? []).map(zoneView),
      destination: (extras.zones?.destination ?? []).map(zoneView),
    },
    fit: extras.fit ?? null,
  };
}

export function toIntercityTripManageView(
  trip: IntercityTripWithRelations,
  extras: IntercityTripViewExtras = {},
): IntercityTripManageView {
  const view = toIntercityTripView(trip, extras);
  return {
    ...view,
    driver: view.driver ? { ...view.driver, phone: trip.driver?.user?.phone ?? null } : null,
  };
}
