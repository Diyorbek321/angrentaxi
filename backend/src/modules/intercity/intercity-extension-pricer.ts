import { Injectable, Logger } from '@nestjs/common';
import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { haversineDistance } from '../orders/orders.distance.util';
import { Coordinate, OsrmService } from '../routing/osrm.service';
import { IntercityExtensionCharge } from '../tariffs/fare-breakdown';
import {
  ExtensionPoint,
  ROAD_DISTANCE_FALLBACK_FACTOR,
  extensionRate,
  kmFromMeters,
  priceExtension,
} from './intercity-extension';

/**
 * Yo'lovchi narxni kutib turgan ekranda — 3 soniyadan keyin taxminga o'tamiz
 * (buyurtma yaratishdagi OSRM byudjeti bilan bir xil fikr).
 */
const ROUTE_TIMEOUT_MS = 3000;

interface LatLng {
  lat: number;
  lng: number;
}

/** "Shahar ichiga davom" haqi — nuqta markazi va manzil orasidagi YO'L km. */
@Injectable()
export class IntercityExtensionPricer {
  private readonly logger = new Logger(IntercityExtensionPricer.name);

  constructor(private readonly osrm: OsrmService) {}

  async charge(
    side: IntercityExtensionCharge['side'],
    point: ExtensionPoint,
    tripClass: IntercityTripClass,
    address: LatLng,
  ): Promise<IntercityExtensionCharge> {
    const centre: Coordinate = [point.centerLng, point.centerLat];
    const home: Coordinate = [address.lng, address.lat];
    // Olishda haydovchi uydan nuqtaga, tushirishda nuqtadan uyga yuradi —
    // bir tomonlama ko'chalar sabab masofa farq qilishi mumkin.
    const path = side === 'pickup' ? [home, centre] : [centre, home];

    const roadMeters = await this.osrm.routeDistanceMeters(path, ROUTE_TIMEOUT_MS).catch((err: Error) => {
      this.logger.warn(`Davom masofasi: OSRM xatosi — taxmin ishlatiladi (${err.message})`);
      return null;
    });
    const estimated = roadMeters === null;
    const meters = estimated
      ? haversineDistance(point.centerLat, point.centerLng, address.lat, address.lng) *
        1000 *
        ROAD_DISTANCE_FALLBACK_FACTOR
      : roadMeters;

    const km = kmFromMeters(meters);
    const pricePerKm = extensionRate(point, tripClass);
    return { side, pointName: point.name, km, pricePerKm, fare: priceExtension(km, pricePerKm), estimated };
  }
}
