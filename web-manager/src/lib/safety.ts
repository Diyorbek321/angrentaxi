/**
 * Xavfsizlik (INCIDENT-POLICY §4): SOS yopish izohi va buyurtma dalillari.
 * Sof qoidalar shu yerda (vitest), so'rovlar — pastda, `apiClient` orqali.
 */
import { apiClient, type ApiResponse } from './api';

/** Backend `ResolveSosDto` bilan bir xil chegaralar. */
export const SOS_NOTE_MIN = 3;
export const SOS_NOTE_MAX = 500;

export function sosNoteError(note: string): 'tooShort' | 'tooLong' | null {
  const trimmed = note.trim();
  if (trimmed.length < SOS_NOTE_MIN) return 'tooShort';
  if (trimmed.length > SOS_NOTE_MAX) return 'tooLong';
  return null;
}

export interface EvidenceTrackPoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface OrderEvidence {
  orderId: string;
  track: EvidenceTrackPoint[];
  trackTruncated: boolean;
  chat: Array<{ id: string; senderRole: 'passenger' | 'driver' | string; body: string; createdAt: string }>;
  sos: Array<{
    id: string;
    reportedByRole: string;
    status: string;
    lat: number;
    lng: number;
    createdAt: string;
    resolvedAt: string | null;
    resolvedBy: string | null;
    resolutionNote: string | null;
  }>;
  ratings: Array<{ fromRole: string; score: number; comment: string | null; createdAt: string }>;
  calls: Array<{ callerRole: string; calleeType?: string | null; createdAt: string }>;
  incidents: Array<{ id: string; category: string; status: string; createdAt: string }>;
}

/** Xaritaga chiziladigan nuqtalar: [lat, lng], koordinatasi buzuqlari tashlanadi. */
export function trackPolyline(track: readonly EvidenceTrackPoint[]): Array<[number, number]> {
  return track
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    .map((p) => [p.lat, p.lng]);
}

/** Iz uzunligi, km (haversine yig'indisi) — "qancha yurgan" savoliga. */
export function trackDistanceKm(points: ReadonlyArray<[number, number]>): number {
  const R = 6371;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [lat1, lng1] = points[i - 1];
    const [lat2, lng2] = points[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return Math.round(total * 100) / 100;
}

export function evidenceIsEmpty(e: OrderEvidence): boolean {
  return (
    e.track.length === 0 &&
    e.chat.length === 0 &&
    e.sos.length === 0 &&
    e.ratings.length === 0 &&
    e.calls.length === 0 &&
    e.incidents.length === 0
  );
}

/** ⚠️ Har chaqiruv serverda audit yozuvi — faqat menejer "Ko'rsatish" ni bosganda. */
export async function getOrderEvidence(orderId: string): Promise<OrderEvidence> {
  const res = await apiClient.get<ApiResponse<OrderEvidence>>(`/manager/orders/${orderId}/evidence`);
  return res.data.data;
}
