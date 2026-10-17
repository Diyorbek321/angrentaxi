/**
 * Shahar ichidagi bekatlar tartibi (olish yoki tushirish) — sof funksiyalar.
 *
 * Kirish — OSRM `/table` dan olingan yo'l vaqti matritsasi (soniya,
 * `m[i][j]` — i dan j ga; bir tomonlama ko'chalar sabab ASSIMETRIK bo'lishi
 * mumkin), indekslar shu matritsaning qatorlari.
 *
 * Qatnovda ko'pi bilan 8 o'rindiq (`intercity_trips.seats_total` CHECK) —
 * demak bir tomonda ko'pi bilan 8 bekat. 2^8 · 8² ≈ 16 ming qadam: aniq
 * yechim (Held–Karp) arzon, evristika faqat ehtiyot uchun (kelajakda
 * miniven/avtobus).
 */

/** Shundan ko'p bekatda aniq yechim o'rniga yaqin qo'shni + 2-opt. */
export const EXACT_STOP_LIMIT = 8;

export type DurationMatrix = ReadonlyArray<ReadonlyArray<number | null>>;

/** Yo'lning qat'iy uchlari: `start` — boshlanish, `end` — tugash (ikkalasi ixtiyoriy). */
export interface PathAnchors {
  start?: number;
  end?: number;
}

export interface PathResult {
  /** Bekatlar tashrif tartibi (matritsa indekslari, uchlarsiz). */
  order: number[];
  /** Butun yo'l, soniya (uchlar bilan). */
  seconds: number;
}

export type DetourSide = 'pickup' | 'dropoff';

function edge(m: DurationMatrix, from: number, to: number): number {
  const value = m[from]?.[to];
  return value === null || value === undefined ? Infinity : value;
}

function pathCost(m: DurationMatrix, anchors: PathAnchors, order: readonly number[]): number {
  if (order.length === 0) {
    return anchors.start !== undefined && anchors.end !== undefined ? edge(m, anchors.start, anchors.end) : 0;
  }
  let total = anchors.start !== undefined ? edge(m, anchors.start, order[0]) : 0;
  for (let i = 1; i < order.length; i += 1) total += edge(m, order[i - 1], order[i]);
  return total + (anchors.end !== undefined ? edge(m, order[order.length - 1], anchors.end) : 0);
}

/** Held–Karp: bekatlar soni ≤ EXACT_STOP_LIMIT. */
function exactPath(m: DurationMatrix, anchors: PathAnchors, stops: readonly number[]): number[] {
  const k = stops.length;
  const full = (1 << k) - 1;
  const cost: number[][] = Array.from({ length: 1 << k }, () => new Array<number>(k).fill(Infinity));
  const parent: number[][] = Array.from({ length: 1 << k }, () => new Array<number>(k).fill(-1));

  for (let j = 0; j < k; j += 1) {
    cost[1 << j][j] = anchors.start !== undefined ? edge(m, anchors.start, stops[j]) : 0;
  }
  for (let mask = 1; mask <= full; mask += 1) {
    for (let j = 0; j < k; j += 1) {
      const here = cost[mask][j];
      if (!(mask & (1 << j)) || here === Infinity) continue;
      for (let next = 0; next < k; next += 1) {
        if (mask & (1 << next)) continue;
        const nextMask = mask | (1 << next);
        const candidate = here + edge(m, stops[j], stops[next]);
        if (candidate < cost[nextMask][next]) {
          cost[nextMask][next] = candidate;
          parent[nextMask][next] = j;
        }
      }
    }
  }

  let last = -1;
  let best = Infinity;
  for (let j = 0; j < k; j += 1) {
    const total = cost[full][j] + (anchors.end !== undefined ? edge(m, stops[j], anchors.end) : 0);
    if (total < best) {
      best = total;
      last = j;
    }
  }
  if (last < 0) return [];

  const reversed: number[] = [];
  let mask = full;
  while (last >= 0) {
    reversed.push(stops[last]);
    const previous = parent[mask][last];
    mask &= ~(1 << last);
    last = previous;
  }
  return reversed.reverse();
}

/** Yaqin qo'shni (qat'iy uchdan) + 2-opt. */
function heuristicPath(m: DurationMatrix, anchors: PathAnchors, stops: readonly number[]): number[] {
  const remaining = new Set(stops);
  const backward = anchors.start === undefined && anchors.end !== undefined;
  const sequence: number[] = [];
  let current = backward ? anchors.end : anchors.start;
  while (remaining.size > 0) {
    let pick = -1;
    let pickCost = Infinity;
    for (const stop of remaining) {
      const value = current === undefined ? 0 : backward ? edge(m, stop, current) : edge(m, current, stop);
      if (pick < 0 || value < pickCost) {
        pick = stop;
        pickCost = value;
      }
    }
    sequence.push(pick);
    remaining.delete(pick);
    current = pick;
  }
  let order = backward ? sequence.reverse() : sequence;

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        const candidate = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (pathCost(m, anchors, candidate) < pathCost(m, anchors, order)) {
          order = candidate;
          improved = true;
        }
      }
    }
  }
  return order;
}

/**
 * Bekatlarning eng qisqa tashrif tartibi. Biror bekatga yetib bo'lmasa
 * (matritsada `null`) — `null`: chaqiruvchi "tekshirib bo'lmadi" deb o'qiydi.
 */
export function bestPath(m: DurationMatrix, anchors: PathAnchors, stops: readonly number[]): PathResult | null {
  const order =
    stops.length === 0
      ? []
      : stops.length <= EXACT_STOP_LIMIT
        ? exactPath(m, anchors, stops)
        : heuristicPath(m, anchors, stops);
  const seconds = pathCost(m, anchors, order);
  if (seconds === Infinity || order.length !== stops.length) return null;
  return { order, seconds };
}

/**
 * Yangi yo'lovchi qo'shilsa mashina shahar ichida qancha ORTIQCHA yuradi.
 *
 *   aylanma = yo'l(mavjud + yangi) − yo'l(mavjud) − to'g'ridan(nuqta ↔ yangi)
 *
 * ⚠️ NEGA to'g'ridan-to'g'ri yo'l ayiriladi: yangi yo'lovchini o'z
 * manziliga eltish vaqti — uning o'zi km uchun to'laydigan, muqarrar yo'l.
 * Usiz yolg'iz uzoq yo'lovchi (birinchi band) yoki shu yo'nalishda
 * uzoqroqdagi yo'lovchi ham "aylanma" bo'lib rad etilardi. Qolgan qism —
 * haqiqiy aylanib yurish: qarama-qarshi chekkaga borib qaytish.
 *
 * `dropoff` — yo'l nuqtadan boshlanadi; `pickup` — nuqtada tugaydi.
 * Natija soniya, ≥ 0; yetib bo'lmasa `null`.
 */
export function addedDetourSeconds(
  m: DurationMatrix,
  side: DetourSide,
  pointIndex: number,
  existing: readonly number[],
  candidate: number,
): number | null {
  if (existing.length === 0) return 0;
  const anchors: PathAnchors = side === 'dropoff' ? { start: pointIndex } : { end: pointIndex };
  const withCandidate = bestPath(m, anchors, [...existing, candidate]);
  const without = bestPath(m, anchors, existing);
  const direct = side === 'dropoff' ? edge(m, pointIndex, candidate) : edge(m, candidate, pointIndex);
  if (!withCandidate || !without || direct === Infinity) return null;
  return Math.max(0, withCandidate.seconds - without.seconds - direct);
}
