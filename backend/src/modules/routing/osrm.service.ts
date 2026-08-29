import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/** A [lng, lat] pair — OSRM's coordinate order, not Leaflet's. */
export type Coordinate = readonly [number, number];

export interface MatchedTrace {
  /** Metres actually driven along the road network. */
  distanceMeters: number;
  /** Seconds the matched trace took, per OSRM. */
  durationSeconds: number;
  /** The trace snapped onto roads, as [lng, lat] pairs. */
  geometry: Coordinate[];
}

/**
 * The public demo server. It is rate-limited, carries no SLA and is explicitly
 * not for production traffic — we keep it only as a last-resort default so a
 * dev machine without OSRM_URL still works, and warn loudly at startup.
 */
export const OSRM_PUBLIC_DEMO = 'https://router.project-osrm.org';

/**
 * Thin OSRM client for the three services dispatch actually needs:
 *
 * - `/table`  — pickup-to-driver ETA matrix, so matching can rank by driving
 *               time instead of straight-line distance (a driver across a
 *               river is "near" by air and 7 minutes away by road).
 * - `/match`  — snaps a raw GPS trace to the road network, which is how the
 *               billed trip distance stops inheriting GPS scatter.
 * - `/route`  — pickup → dropoff geometry and ETA.
 *
 * Every method degrades to null rather than throwing: routing is an accuracy
 * improvement, never a reason to fail a ride.
 */
@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);
  private readonly http: AxiosInstance;
  readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('OSRM_URL') || OSRM_PUBLIC_DEMO
    ).replace(/\/+$/, '');

    if (this.baseUrl === OSRM_PUBLIC_DEMO) {
      this.logger.warn(
        `OSRM_URL is not set — falling back to the public demo server ` +
          `(${OSRM_PUBLIC_DEMO}). It is rate-limited and has no SLA; ` +
          `run your own OSRM before taking real traffic.`,
      );
    }

    this.http = axios.create({
      baseURL: this.baseUrl,
      // Dispatch waits on this call, so it must fail fast. A slow router is
      // worse than no router here — matching falls back to distance order.
      timeout: 3000,
    });
  }

  private static toParam(coords: readonly Coordinate[]): string {
    return coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
  }

  /**
   * Driving seconds from each `sources` point to `destination`.
   *
   * Returns an array aligned with `sources`; an entry is null when OSRM could
   * not route to it (unmapped road, island). Returns null altogether when the
   * whole call fails, which callers read as "keep the existing order".
   */
  async durationsTo(
    sources: readonly Coordinate[],
    destination: Coordinate,
  ): Promise<(number | null)[] | null> {
    if (sources.length === 0) return [];

    const coords = OsrmService.toParam([...sources, destination]);
    const destinationIndex = sources.length;

    try {
      const { data } = await this.http.get<{
        code: string;
        durations?: (number | null)[][];
      }>(`/table/v1/driving/${coords}`, {
        params: {
          sources: sources.map((_, i) => i).join(';'),
          destinations: String(destinationIndex),
        },
      });

      if (data.code !== 'Ok' || !data.durations) return null;

      // One column (the single destination) per source row.
      return data.durations.map((row) => row?.[0] ?? null);
    } catch (err) {
      this.logger.warn(`OSRM /table failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Snaps a raw GPS trace onto roads and reports the distance actually driven.
   *
   * OSRM caps a match at 100 coordinates, so a long trip is matched in
   * overlapping chunks and the per-chunk distances are summed. Returns null if
   * any chunk fails — a partially matched trip would under-report the fare,
   * and silently under-charging is worse than falling back to the raw trace.
   */
  async matchTrace(trace: readonly Coordinate[]): Promise<MatchedTrace | null> {
    if (trace.length < 2) return null;

    const CHUNK = 100;
    let distanceMeters = 0;
    let durationSeconds = 0;
    const geometry: Coordinate[] = [];

    for (let start = 0; start < trace.length - 1; start += CHUNK - 1) {
      // Chunks overlap by one point so the join between them is still driven
      // distance rather than a gap.
      const chunk = trace.slice(start, start + CHUNK);
      if (chunk.length < 2) break;

      const matched = await this.matchChunk(chunk);
      if (!matched) return null;

      distanceMeters += matched.distanceMeters;
      durationSeconds += matched.durationSeconds;
      geometry.push(...matched.geometry);
    }

    if (distanceMeters === 0) return null;

    return { distanceMeters, durationSeconds, geometry };
  }

  /**
   * Road distance in metres along the given points, in order.
   *
   * Used to price a finished ride by what was actually driven rather than by
   * the straight line between its stops. Returns null if the route can't be
   * computed, so the caller can keep its existing measure.
   */
  async routeDistanceMeters(
    points: readonly Coordinate[],
    timeoutMs = 6000,
  ): Promise<number | null> {
    if (points.length < 2) return null;

    try {
      const { data } = await this.http.get<{
        code: string;
        routes?: { distance: number }[];
      }>(`/route/v1/driving/${OsrmService.toParam(points)}`, {
        params: { overview: 'false' },
        // Trip completion runs off the passenger's critical path and can
        // afford 6s. Order creation cannot: the passenger is staring at a
        // spinner, so that caller passes a tighter budget and falls back to
        // the straight-line estimate when the router is slow.
        timeout: timeoutMs,
      });

      if (data.code !== 'Ok' || !data.routes?.length) return null;

      return data.routes[0].distance;
    } catch (err) {
      this.logger.warn(`OSRM /route failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async matchChunk(chunk: readonly Coordinate[]): Promise<MatchedTrace | null> {
    try {
      const { data } = await this.http.get<{
        code: string;
        matchings?: {
          distance: number;
          duration: number;
          geometry: { coordinates: [number, number][] };
        }[];
      }>(`/match/v1/driving/${OsrmService.toParam(chunk)}`, {
        params: { geometries: 'geojson', overview: 'full', tidy: 'true' },
        // Matching runs after the trip ends, so it can afford to wait longer
        // than dispatch does.
        timeout: 8000,
      });

      if (data.code !== 'Ok' || !data.matchings?.length) return null;

      return data.matchings.reduce<MatchedTrace>(
        (acc, m) => ({
          distanceMeters: acc.distanceMeters + m.distance,
          durationSeconds: acc.durationSeconds + m.duration,
          geometry: [...acc.geometry, ...m.geometry.coordinates],
        }),
        { distanceMeters: 0, durationSeconds: 0, geometry: [] },
      );
    } catch (err) {
      this.logger.warn(`OSRM /match failed: ${(err as Error).message}`);
      return null;
    }
  }
}
