import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { cellToBoundary, cellToLatLng, gridDisk, latLngToCell } from 'h3-js';
import { Order } from '../../database/entities/order.entity';
import { DriversService } from '../drivers/drivers.service';

export interface SurgeSnapshot {
  multiplier: number;
  /** Ride requests in the zone over [DEMAND_WINDOW_MINUTES]. */
  demand: number;
  /** Drivers currently online in the zone. */
  supply: number;
  /** H3 index of the zone the pickup fell in — useful for logs/analytics. */
  zone: string;
}

/**
 * How busy a zone is, coarse enough to show a driver.
 *
 * This — not the multiplier — is what the app draws. A driver who can read the
 * exact number learns to park and wait for it to climb, which takes supply off
 * the street at the moment the city needs it most and lengthens every
 * passenger's wait. Three buckets say "drive there" without saying "wait here".
 */
export type SurgeLevel = 'normal' | 'elevated' | 'high';

/** A zone snapshot plus the hexagon that carries it, ready to be drawn. */
export interface SurgeZone extends SurgeSnapshot {
  /**
   * The hexagon as a GeoJSON linear ring: [lng, lat] pairs, first point
   * repeated as the last so the ring is closed.
   */
  boundary: [number, number][];
}

/** Pickup coordinates as the demand query returns them. */
interface PickupRow {
  lat: number;
  lng: number;
}

/**
 * Demand-based surge.
 *
 * The multiplier used to be a column an admin edited by hand, so it only ever
 * moved when someone remembered to move it — exactly the wrong response time
 * for a rush hour. This computes it from the same two numbers Uber's
 * marketplace reacts to: how many people are asking for a ride in a small area
 * right now, and how many drivers are there to take them.
 *
 * Zones are H3 cells. Hexagons are used rather than a lat/lng grid because
 * every neighbour is the same distance away, so "this cell plus its ring"
 * really is a disc on the ground — a square grid's diagonal neighbours are
 * 1.4x further than its edge ones, which skews the ratio near zone borders.
 */
@Injectable()
export class SurgeService {
  private readonly logger = new Logger(SurgeService.name);

  /**
   * H3 resolution 8 ≈ 0.74 km² per cell — roughly a neighbourhood. Plus one
   * ring of neighbours (7 cells, ~5 km²) that is the area a driver can
   * realistically reach within a few minutes in a city like Angren.
   */
  private static readonly ZONE_RESOLUTION = 8;
  private static readonly ZONE_RING = 1;

  /** Radius covering the 7-cell disc, with slack so supply is never undercounted. */
  private static readonly SUPPLY_RADIUS_KM = 2;

  private static readonly DEMAND_WINDOW_MINUTES = 10;

  /** Ceiling. Matches the bound the manual admin control already enforced. */
  static readonly MAX_MULTIPLIER = 2.0;

  /** Below this, surge stays off — small-number noise must not move prices. */
  private static readonly MIN_DEMAND_TO_SURGE = 3;

  /**
   * Rings of hexagons the demand map covers around the driver.
   *
   * 4 rings ≈ 61 cells ≈ a 6 km disc: the whole of Angren from anywhere in it,
   * so a driver never has to pan to find the busy side of town.
   */
  static readonly DEFAULT_MAP_RINGS = 4;

  /**
   * Hard cap on that radius. Cell count grows as 3n²+3n+1 and every cell costs
   * one Redis lookup for supply, so an unbounded `rings` turns a map refresh
   * into a self-inflicted load test. 6 rings (127 cells) already covers far
   * more ground than a driver can act on.
   */
  static readonly MAX_MAP_RINGS = 6;

  /** Multiplier at which a zone stops reading as "normal" on the map. */
  private static readonly ELEVATED_FROM = 1.2;

  /** ...and at which it reads as "high". */
  private static readonly HIGH_FROM = 1.6;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly driversService: DriversService,
  ) {}

  /**
   * Surge for a pickup point, as a multiplier in [1.0, MAX_MULTIPLIER].
   *
   * Returns 1.0 (no surge) whenever the picture is unclear — too few requests
   * to be meaningful, or a failed query. Charging more on the strength of a
   * broken query is the one outcome worth engineering against.
   */
  async snapshotFor(lat: number, lng: number): Promise<SurgeSnapshot> {
    const zone = latLngToCell(lat, lng, SurgeService.ZONE_RESOLUTION);

    try {
      const [pickups, supply] = await Promise.all([
        this.recentPickups(),
        this.driversService.countOnlineDriversNear(
          lat,
          lng,
          SurgeService.SUPPLY_RADIUS_KM,
        ),
      ]);

      return SurgeService.snapshotOf(
        zone,
        SurgeService.bucketPickups(pickups),
        supply,
      );
    } catch (err) {
      this.logger.error(`Surge calculation failed: ${(err as Error).message}`);
      return { multiplier: 1.0, demand: 0, supply: 0, zone };
    }
  }

  /**
   * Every zone within [rings] hexagons of a point, for the driver's demand map.
   *
   * The map has to agree with the price: a hexagon drawn as busy must be busy
   * by the same definition the passenger's quote was computed from, so each
   * cell is scored exactly the way snapshotFor scores a pickup — same window,
   * same neighbour ring, same ratio. Anything else and drivers chase colour
   * that pays nothing.
   *
   * Recent pickups are read once for the whole disc instead of once per cell;
   * only supply still costs a lookup per hexagon, which is what MAX_MAP_RINGS
   * bounds.
   */
  async zonesAround(
    lat: number,
    lng: number,
    rings: number = SurgeService.DEFAULT_MAP_RINGS,
  ): Promise<SurgeZone[]> {
    const centre = latLngToCell(lat, lng, SurgeService.ZONE_RESOLUTION);
    const cells = gridDisk(centre, SurgeService.boundedRings(rings));

    try {
      const [pickups, supplies] = await Promise.all([
        this.recentPickups(),
        Promise.all(cells.map((cell) => this.supplyIn(cell))),
      ]);
      const byCell = SurgeService.bucketPickups(pickups);

      return cells.map((cell, index) => ({
        ...SurgeService.snapshotOf(cell, byCell, supplies[index]),
        boundary: SurgeService.ringOf(cell),
      }));
    } catch (err) {
      // No map at all, rather than a map built on half the data. A driver who
      // sees nothing keeps working their own patch; one who sees a wrong
      // hexagon drives across town for a fare that was never there.
      this.logger.error(`Surge map failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * The bucket a multiplier falls into.
   *
   * Boundaries are inclusive-below: 1.1 is still normal, 1.2 is elevated,
   * 1.6 is high.
   */
  static levelFor(multiplier: number): SurgeLevel {
    if (multiplier < SurgeService.ELEVATED_FROM) return 'normal';
    if (multiplier < SurgeService.HIGH_FROM) return 'elevated';
    return 'high';
  }

  /**
   * Ratio of unmet demand to available supply, damped and capped.
   *
   * With no drivers at all the multiplier goes straight to the ceiling: that is
   * the strongest signal the platform can send to nearby drivers, and it is
   * bounded, so a passenger can still see the price before agreeing to it.
   */
  static multiplierFor(demand: number, supply: number): number {
    if (supply <= 0) return SurgeService.MAX_MULTIPLIER;
    if (demand <= supply) return 1.0;

    // Half the excess ratio: 2 requests per driver → 1.5x, not 2x. Surge is
    // meant to rebalance the market, not to extract from a bad minute.
    const raw = 1 + (demand / supply - 1) * 0.5;

    return (
      Math.round(Math.min(raw, SurgeService.MAX_MULTIPLIER) * 10) / 10
    );
  }

  /**
   * Score one zone against an already-bucketed demand map.
   *
   * Shared by the single-pickup quote and the multi-zone map so the two can
   * never drift apart.
   */
  private static snapshotOf(
    zone: string,
    demandByCell: Map<string, number>,
    supply: number,
  ): SurgeSnapshot {
    const demand = SurgeService.demandAround(zone, demandByCell);

    if (demand < SurgeService.MIN_DEMAND_TO_SURGE) {
      return { zone, demand, supply, multiplier: 1.0 };
    }

    return {
      zone,
      demand,
      supply,
      multiplier: SurgeService.multiplierFor(demand, supply),
    };
  }

  /** Requests in the cell and its ring — the disc a driver can actually reach. */
  private static demandAround(
    zone: string,
    demandByCell: Map<string, number>,
  ): number {
    return gridDisk(zone, SurgeService.ZONE_RING).reduce(
      (total, cell) => total + (demandByCell.get(cell) ?? 0),
      0,
    );
  }

  /** Drivers online around a cell, measured from its centre. */
  private supplyIn(cell: string): Promise<number> {
    const [lat, lng] = cellToLatLng(cell);

    return this.driversService.countOnlineDriversNear(
      lat,
      lng,
      SurgeService.SUPPLY_RADIUS_KM,
    );
  }

  /**
   * The hexagon as a GeoJSON linear ring.
   *
   * The `true` is load-bearing: h3-js hands back [lat, lng] by default while
   * GeoJSON reads [lng, lat], so without it Angren's hexagons render off the
   * coast of Somalia. It also repeats the first vertex to close the ring, which
   * GeoJSON requires and the raw form omits.
   */
  private static ringOf(cell: string): [number, number][] {
    return cellToBoundary(cell, true);
  }

  /** Clamp a caller-supplied radius into something the backend can afford. */
  private static boundedRings(rings: number): number {
    if (!Number.isFinite(rings)) return SurgeService.DEFAULT_MAP_RINGS;

    return Math.min(
      Math.max(Math.trunc(rings), 0),
      SurgeService.MAX_MAP_RINGS,
    );
  }

  /**
   * Pickup coordinates of every ride requested inside the demand window.
   *
   * Bucketing happens in JS rather than SQL because Postgres has no H3
   * function here; the window is short and a city's order rate is small, so
   * this reads a handful of rows — and one read serves a whole map.
   *
   * ⚠️ `status <> 'scheduled'` — REJALASHTIRILGAN BUYURTMALAR TALABGA
   * KIRMAYDI. Ular `created_at` bo'yicha ushbu 10 daqiqalik oynaga tushadi,
   * lekin ular HOZIR haydovchi so'ramayapti: kechqurun 21:00 da besh kishi
   * ertangi ertalabki safarni rejalashtirsa, filtrisiz hozirgi surge
   * sun'iy ravishda ko'tarilib, o'sha daqiqada haqiqiy safar buyurtma
   * qilayotgan yo'lovchilardan ortiqcha pul olinardi.
   */
  private async recentPickups(): Promise<PickupRow[]> {
    const rows: PickupRow[] = await this.orderRepository.query(
      `SELECT ST_Y(pickup_location::geometry) AS lat,
              ST_X(pickup_location::geometry) AS lng
         FROM orders
        WHERE created_at > NOW() - INTERVAL '${SurgeService.DEMAND_WINDOW_MINUTES} minutes'
          AND status <> 'scheduled'`,
    );

    return rows ?? [];
  }

  /** Requests per H3 cell, so a zone's demand is a lookup rather than a scan. */
  private static bucketPickups(rows: PickupRow[]): Map<string, number> {
    const byCell = new Map<string, number>();

    for (const row of rows) {
      const cell = latLngToCell(
        Number(row.lat),
        Number(row.lng),
        SurgeService.ZONE_RESOLUTION,
      );
      byCell.set(cell, (byCell.get(cell) ?? 0) + 1);
    }

    return byCell;
  }
}
