import { Injectable, Logger } from '@nestjs/common';
import { haversineDistance } from '../orders/orders.distance.util';
import { Coordinate, OsrmService } from '../routing/osrm.service';
import { DetourSide, DurationMatrix, PathAnchors, addedDetourSeconds, bestPath } from './intercity-route-optimizer';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlanStopInput extends LatLng {
  id: string;
}

export interface DetourCheck {
  /** false — marshrut xizmati javob bermadi; band RUXSAT etiladi (fail-open). */
  checked: boolean;
  addedMinutes: number | null;
}

export interface PlannedStop {
  id: string;
  /** Oldingi bekatdan (yoki haydovchi/nuqtadan) daqiqa; noma'lum bo'lsa null. */
  etaMinutesFromPrev: number | null;
}

export interface RoutePlan {
  stops: PlannedStop[];
  /** Olish rejasida: oxirgi yo'lovchidan nuqtagacha (Rohat krugi) daqiqa. */
  terminalEtaMinutes: number | null;
  totalMinutes: number | null;
  /** false — marshrut xizmatisiz "eng yaqindan" tartib. */
  optimized: boolean;
}

const toCoordinate = (p: LatLng): Coordinate => [p.lng, p.lat];
const minutes = (seconds: number): number => Math.round(seconds / 60);

/**
 * Shahar ichidagi bekatlar: aylanma (yangi yo'lovchi qo'shilsa mashina
 * qancha ortiqcha yuradi) va haydovchi uchun tartib. Hisob —
 * `intercity-route-optimizer.ts`, vaqtlar — OSRM `/table`.
 *
 * ⚠️ Marshrut xizmati ishlamasa: aylanma "tekshirilmadi" (band o'tadi —
 * router uzilishi yo'lovchini qatnovsiz qoldirmasin), reja esa to'g'ri
 * chiziq bo'yicha "eng yaqindan".
 */
@Injectable()
export class IntercityDetourService {
  private readonly logger = new Logger(IntercityDetourService.name);

  constructor(private readonly osrm: OsrmService) {}

  async addedMinutes(
    side: DetourSide,
    point: LatLng,
    existing: readonly LatLng[],
    candidate: LatLng,
  ): Promise<DetourCheck> {
    if (existing.length === 0) return { checked: true, addedMinutes: 0 };
    const matrix = await this.osrm.durationMatrix([point, ...existing, candidate].map(toCoordinate));
    const seconds = matrix
      ? addedDetourSeconds(matrix, side, 0, existing.map((_, i) => i + 1), existing.length + 1)
      : null;
    if (seconds === null) {
      this.logger.warn(`Aylanma tekshirilmadi (${side}): marshrut xizmati javob bermadi`);
      return { checked: false, addedMinutes: null };
    }
    return { checked: true, addedMinutes: minutes(seconds) };
  }

  /**
   * `dropoff` — nuqtadan boshlab tushirish tartibi; `pickup` — nuqtada
   * tugaydigan olish tartibi (`from` — haydovchining hozirgi joyi, ixtiyoriy).
   */
  async plan(side: DetourSide, point: LatLng, stops: readonly PlanStopInput[], from?: LatLng): Promise<RoutePlan> {
    if (stops.length === 0) return { stops: [], terminalEtaMinutes: null, totalMinutes: 0, optimized: true };

    const hasFrom = side === 'pickup' && from !== undefined;
    const coords = [point, ...(hasFrom ? [from] : []), ...stops];
    const offset = hasFrom ? 2 : 1;
    const matrix = await this.osrm.durationMatrix(coords.map(toCoordinate));
    const anchors: PathAnchors =
      side === 'dropoff' ? { start: 0 } : hasFrom ? { start: 1, end: 0 } : { end: 0 };
    const path = matrix ? bestPath(matrix, anchors, stops.map((_, i) => i + offset)) : null;

    if (!matrix || !path) {
      this.logger.warn(`Bekatlar rejasi: marshrut xizmatisiz eng yaqindan tartib (${side})`);
      return { stops: this.nearestFirst(side, point, stops, from), terminalEtaMinutes: null, totalMinutes: null, optimized: false };
    }
    return this.withEtas(matrix, anchors, path.order, stops, offset, path.seconds);
  }

  private withEtas(
    m: DurationMatrix,
    anchors: PathAnchors,
    order: readonly number[],
    stops: readonly PlanStopInput[],
    offset: number,
    totalSeconds: number,
  ): RoutePlan {
    const planned = order.map((index, position): PlannedStop => {
      const previous = position === 0 ? anchors.start : order[position - 1];
      const leg = previous === undefined ? null : m[previous][index];
      return { id: stops[index - offset].id, etaMinutesFromPrev: leg === null ? null : minutes(leg) };
    });
    const last = order[order.length - 1];
    const terminal = anchors.end !== undefined ? m[last][anchors.end] : null;
    return {
      stops: planned,
      terminalEtaMinutes: terminal === null ? null : minutes(terminal),
      totalMinutes: minutes(totalSeconds),
      optimized: true,
    };
  }

  /** Marshrut xizmatisiz: to'g'ri chiziq bo'yicha ochko'z tartib. */
  private nearestFirst(
    side: DetourSide,
    point: LatLng,
    stops: readonly PlanStopInput[],
    from?: LatLng,
  ): PlannedStop[] {
    const remaining = [...stops];
    const sequence: PlanStopInput[] = [];
    // Olish: nuqtadan ORQAGA quriladi (nuqtaga eng yaqini oxirida), agar
    // haydovchi joyi ma'lum bo'lmasa.
    const backward = side === 'pickup' && from === undefined;
    let current: LatLng = side === 'pickup' && from ? from : point;
    while (remaining.length > 0) {
      let best = 0;
      for (let i = 1; i < remaining.length; i += 1) {
        const distance = haversineDistance(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
        const bestDistance = haversineDistance(current.lat, current.lng, remaining[best].lat, remaining[best].lng);
        if (distance < bestDistance) best = i;
      }
      const [next] = remaining.splice(best, 1);
      sequence.push(next);
      current = next;
    }
    return (backward ? sequence.reverse() : sequence).map((stop) => ({ id: stop.id, etaMinutesFromPrev: null }));
  }
}
