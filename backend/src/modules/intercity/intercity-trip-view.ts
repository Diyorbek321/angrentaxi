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

export function toIntercityTripView(trip: IntercityTripWithRelations): IntercityTripView {
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
  };
}

export function toIntercityTripManageView(trip: IntercityTripWithRelations): IntercityTripManageView {
  const view = toIntercityTripView(trip);
  return {
    ...view,
    driver: view.driver ? { ...view.driver, phone: trip.driver?.user?.phone ?? null } : null,
  };
}
