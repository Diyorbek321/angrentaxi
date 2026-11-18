import { haversineDistance } from '../orders/orders.distance.util';

/** Safar davomida haydovchidan kelgan bitta GPS nuqtasi. */
export interface TrackPoint {
  lat: number;
  lng: number;
  recordedAt: Date;
}

/**
 * GPS shovqinidan himoya chegaralari.
 *
 * JITTER: mashina turganda ham GPS nuqtasi bir necha metr "sakraydi". Har bir
 * sakrash qo'shilsa, svetoforda turgan taksometr pul sanayveradi. Shuning
 * uchun langar nuqtadan kamida shuncha uzoqlashmaguncha masofa qo'shilmaydi.
 *
 * TELEPORT: noto'g'ri fiks (tunnel, bino orasi) bir lahzada yuzlab metrga
 * otib ketadi. Ikkala nuqta orasidagi tezlik shahar uchun imkonsiz bo'lsa,
 * nuqta tashlab yuboriladi.
 */
export const JITTER_METERS = 15;
export const MAX_SPEED_KMH = 150;

/** OSRM `match` ga yuboriladigan nuqtalar orasidagi eng kam masofa. */
export const MATCH_SAMPLE_METERS = 40;

/**
 * Filtrlangan iz: shovqin va imkonsiz sakrashlar olib tashlangan, tartiblangan
 * nuqtalar. Birinchi nuqta doim saqlanadi.
 */
export function cleanTrack(points: readonly TrackPoint[]): TrackPoint[] {
  const sorted = [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  if (sorted.length === 0) return [];

  const kept: TrackPoint[] = [sorted[0]];
  for (const point of sorted.slice(1)) {
    const anchor = kept[kept.length - 1];
    const meters = haversineDistance(anchor.lat, anchor.lng, point.lat, point.lng) * 1000;
    if (meters < JITTER_METERS) continue;

    const hours = (point.recordedAt.getTime() - anchor.recordedAt.getTime()) / 3_600_000;
    // Bir xil vaqt belgisi yoki imkonsiz tezlik — ishonchsiz fiks.
    if (hours <= 0 || meters / 1000 / hours > MAX_SPEED_KMH) continue;

    kept.push(point);
  }
  return kept;
}

/** Tozalangan iz bo'ylab to'g'ri chiziqli bo'laklar yig'indisi (km). */
export function trackDistanceKm(points: readonly TrackPoint[]): number {
  const track = cleanTrack(points);
  let km = 0;
  for (let i = 1; i < track.length; i++) {
    km += haversineDistance(track[i - 1].lat, track[i - 1].lng, track[i].lat, track[i].lng);
  }
  return km;
}

/**
 * OSRM `match` uchun siyrak iz: har ~40 m da bitta nuqta, oxirgisi doim
 * qo'shiladi. 10 km safarda ~250 nuqta = 3 ta so'rov (OSRM 100 tadan bo'ladi).
 */
export function sampleForMatching(points: readonly TrackPoint[]): TrackPoint[] {
  const track = cleanTrack(points);
  if (track.length <= 2) return track;

  const sampled: TrackPoint[] = [track[0]];
  for (const point of track.slice(1, -1)) {
    const last = sampled[sampled.length - 1];
    if (haversineDistance(last.lat, last.lng, point.lat, point.lng) * 1000 >= MATCH_SAMPLE_METERS) {
      sampled.push(point);
    }
  }
  sampled.push(track[track.length - 1]);
  return sampled;
}
