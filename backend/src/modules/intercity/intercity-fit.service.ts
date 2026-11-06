import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ZonePoint, zoneOf } from './intercity-extension';
import { DetourCheck, IntercityDetourService, LatLng } from './intercity-detour.service';
import { returnedRows } from './intercity-seat-ledger';
import { ZoneCircle, sideZoneFit } from './intercity-zone-policy';
import { IntercityZonesService } from './intercity-zones.service';

/** Qidiruvda aylanma faqat shuncha qatnovgacha o'lchanadi — ro'yxat tez ochilsin. */
export const SEARCH_DETOUR_TRIP_LIMIT = 10;

export type ZoneSideName = 'origin' | 'destination';

/** `query` bo'lgan har qanday narsa: DataSource yoki tranzaksiya `EntityManager`. */
export interface QueryExecutor {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

export interface FitTrip {
  id: string;
  origin: ZonePoint & { name?: string };
  destination: ZonePoint & { name?: string };
}

export interface BookingFit {
  zoneOk: boolean;
  outOfZone: { side: ZoneSideName; zoneNames: string[] } | null;
  /** false — marshrut xizmati javob bermadi, aylanma o'lchanmadi (band o'tadi). */
  detourChecked: boolean;
  /** Ikkala tomonning kattasi, daqiqa; o'lchanmagan bo'lsa null. */
  detourMinutes: number | null;
  detourTooLong: boolean;
}

export interface SearchFit {
  fit: 'ok' | 'out_of_zone' | 'detour';
  addedMinutes: number | null;
  detourChecked: boolean;
  zoneNames: string[];
}

interface LiveStopRow {
  order_id: string;
  trip_id: string;
  pickup_lat: number | string;
  pickup_lng: number | string;
  dropoff_lat: number | string;
  dropoff_lng: number | string;
}

/** Qatnov tomonlari bo'yicha tanlangan tumanlar (bo'sh — butun davom hududi). */
export interface FitZones {
  origin: readonly ZoneCircle[];
  destination: readonly ZoneCircle[];
}

interface CheckInput {
  trip: FitTrip;
  zones: FitZones;
  pickup: LatLng;
  dropoff: LatLng;
  /** Butun mashina — mashinada boshqa yo'lovchi yo'q, aylanma ma'nosiz. */
  seatBooking: boolean;
  /** 0 — aylanma tekshiruvi o'chiq. */
  maxDetourMinutes: number;
  /** Band tranzaksiyasi ichida — qatnov qatori qulflangandan keyin. */
  executor?: QueryExecutor;
}

const centre = (point: ZonePoint): LatLng => ({ lat: point.centerLat, lng: point.centerLng });

/**
 * Yo'lovchi shu qatnovga "mos"mi: manzili haydovchi tanlagan tumanlarda
 * (`intercity-zone-policy.ts`) va mashinani ortiqcha aylantirmaydimi
 * (`intercity-detour.service.ts`). Quote, band va qidiruv bitta hisobdan.
 */
@Injectable()
export class IntercityFitService {
  constructor(
    private readonly zones: IntercityZonesService,
    private readonly detour: IntercityDetourService,
    @InjectDataSource()
    private readonly dataSource: QueryExecutor,
  ) {}

  async check(input: CheckInput): Promise<BookingFit> {
    const outOfZone = this.outOfZone(input.trip, input.zones, input.pickup, input.dropoff);
    if (outOfZone) {
      return { zoneOk: false, outOfZone, detourChecked: true, detourMinutes: null, detourTooLong: false };
    }
    if (!input.seatBooking || input.maxDetourMinutes <= 0) {
      return { zoneOk: true, outOfZone: null, detourChecked: true, detourMinutes: 0, detourTooLong: false };
    }
    const stops = await this.liveStops(input.executor ?? this.dataSource, [input.trip.id]);
    const result = await this.measure(input.trip, stops, input.pickup, input.dropoff);
    return {
      zoneOk: true,
      outOfZone: null,
      detourChecked: result.checked,
      detourMinutes: result.addedMinutes,
      detourTooLong: result.checked && (result.addedMinutes ?? 0) > input.maxDetourMinutes,
    };
  }

  /**
   * Qidiruv: har qatnov uchun belgi. Tuman — har doim (tarmoqsiz, arzon);
   * aylanma — faqat ≤ SEARCH_DETOUR_TRIP_LIMIT qatnovda, parallel.
   */
  async fitForSearch(
    trips: readonly FitTrip[],
    address: { pickup?: LatLng; dropoff?: LatLng },
    maxDetourMinutes: number,
  ): Promise<Map<string, SearchFit>> {
    const result = new Map<string, SearchFit>();
    if ((!address.pickup && !address.dropoff) || trips.length === 0) return result;

    const zonesByTrip = await this.zones.zonesOfTrips(trips.map((trip) => trip.id));
    const measurable = trips.length <= SEARCH_DETOUR_TRIP_LIMIT && maxDetourMinutes > 0;
    const stops = measurable ? await this.liveStops(this.dataSource, trips.map((trip) => trip.id)) : [];

    await Promise.all(
      trips.map(async (trip) => {
        const zones = zonesByTrip.get(trip.id) ?? { origin: [], destination: [] };
        const outOfZone = this.outOfZone(trip, zones, address.pickup, address.dropoff);
        if (outOfZone) {
          result.set(trip.id, { fit: 'out_of_zone', addedMinutes: null, detourChecked: true, zoneNames: outOfZone.zoneNames });
          return;
        }
        if (!measurable) {
          result.set(trip.id, { fit: 'ok', addedMinutes: null, detourChecked: false, zoneNames: [] });
          return;
        }
        const measured = await this.measure(
          trip,
          stops.filter((stop) => stop.trip_id === trip.id),
          address.pickup,
          address.dropoff,
        );
        const tooLong = measured.checked && (measured.addedMinutes ?? 0) > maxDetourMinutes;
        result.set(trip.id, {
          fit: tooLong ? 'detour' : 'ok',
          addedMinutes: measured.addedMinutes,
          detourChecked: measured.checked,
          zoneNames: [],
        });
      }),
    );
    return result;
  }

  // ---------------------------------------------------------------- ichki

  private outOfZone(
    trip: FitTrip,
    zones: FitZones,
    pickup?: LatLng,
    dropoff?: LatLng,
  ): BookingFit['outOfZone'] {
    const sides: Array<[ZoneSideName, ZonePoint, readonly ZoneCircle[], LatLng | undefined]> = [
      ['origin', trip.origin, zones.origin, pickup],
      ['destination', trip.destination, zones.destination, dropoff],
    ];
    for (const [side, point, chosen, address] of sides) {
      if (!address) continue;
      const fit = sideZoneFit(point, chosen, address);
      if (!fit.ok) return { side, zoneNames: fit.zoneNames };
    }
    return null;
  }

  /** Ikkala tomon alohida; natija — kattasi. Biri o'lchanmasa — butun javob "tekshirilmadi". */
  private async measure(
    trip: FitTrip,
    stops: readonly LiveStopRow[],
    pickup?: LatLng,
    dropoff?: LatLng,
  ): Promise<DetourCheck> {
    const checks = await Promise.all([
      this.measureSide('pickup', trip.origin, stops.map((s) => ({ lat: Number(s.pickup_lat), lng: Number(s.pickup_lng) })), pickup),
      this.measureSide(
        'dropoff',
        trip.destination,
        stops.map((s) => ({ lat: Number(s.dropoff_lat), lng: Number(s.dropoff_lng) })),
        dropoff,
      ),
    ]);
    if (checks.some((check) => !check.checked)) return { checked: false, addedMinutes: null };
    return { checked: true, addedMinutes: Math.max(...checks.map((check) => check.addedMinutes ?? 0)) };
  }

  /**
   * Faqat DAVOM hududidagi manzillar bekat: nuqta radiusi ichidagisi
   * (Rohat krugining o'zi) haydovchini shaharga kiritmaydi.
   */
  private async measureSide(
    side: 'pickup' | 'dropoff',
    point: ZonePoint,
    existing: readonly LatLng[],
    candidate?: LatLng,
  ): Promise<DetourCheck> {
    if (!candidate || zoneOf(point, candidate.lat, candidate.lng) !== 'extension') {
      return { checked: true, addedMinutes: 0 };
    }
    const cityStops = existing.filter((stop) => zoneOf(point, stop.lat, stop.lng) === 'extension');
    return this.detour.addedMinutes(side, centre(point), cityStops, candidate);
  }

  private async liveStops(executor: QueryExecutor, tripIds: readonly string[]): Promise<LiveStopRow[]> {
    if (tripIds.length === 0) return [];
    return returnedRows<LiveStopRow>(
      await executor.query(
        `SELECT o."id" AS order_id, o."intercity_trip_id" AS trip_id,
                ST_Y(o."pickup_location"::geometry) AS pickup_lat,
                ST_X(o."pickup_location"::geometry) AS pickup_lng,
                ST_Y(o."dropoff_location"::geometry) AS dropoff_lat,
                ST_X(o."dropoff_location"::geometry) AS dropoff_lng
           FROM "orders" o
          WHERE o."intercity_trip_id" = ANY($1::uuid[])
            AND o."status" NOT IN ('completed', 'cancelled')`,
        [tripIds],
      ),
    );
  }
}
