import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';

/** Bitta buyurtmada ko'rsatiladigan nuqtalar chegarasi (≈ 4 soat × 3 s). */
export const EVIDENCE_TRACK_LIMIT = 5000;
export const EVIDENCE_CHAT_LIMIT = 1000;

export interface EvidenceTrackPoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface OrderEvidence {
  orderId: string;
  track: EvidenceTrackPoint[];
  trackTruncated: boolean;
  chat: Array<{ id: string; senderRole: string; body: string; createdAt: string }>;
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
  calls: Array<{ callerRole: string; createdAt: string }>;
  incidents: Array<{ id: string; category: string; status: string; createdAt: string }>;
}

const iso = (value: Date | string | null): string | null => (value == null ? null : new Date(value).toISOString());

/**
 * Nizoli buyurtmaning dalillari bitta joyda (INCIDENT-POLICY tamoyil 3, §4):
 * GPS izi, safar chati, SOS, baholar, qo'ng'iroq so'rovlari, hodisalar.
 * HAR ko'rish audit jurnaliga yoziladi (kim, qaysi buyurtma).
 */
@Injectable()
export class OrderEvidenceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLog: AuditLogService,
  ) {}

  async getEvidence(orderId: string, actorUserId: string): Promise<OrderEvidence> {
    const exists = (await this.dataSource.query('SELECT 1 FROM orders WHERE id = $1', [orderId])) as unknown[];
    if (!exists.length) throw new NotFoundException(`Order ${orderId} not found`);

    const q = <T>(sql: string, params: unknown[]): Promise<T[]> =>
      this.dataSource.query(sql, params) as Promise<T[]>;
    const [track, chat, sos, ratings, calls, incidents] = await Promise.all([
      q<{ lat: number; lng: number; recorded_at: Date }>(
        `SELECT lat, lng, recorded_at FROM trip_track_points WHERE order_id = $1 ORDER BY recorded_at ASC LIMIT $2`,
        [orderId, EVIDENCE_TRACK_LIMIT + 1],
      ),
      q<{ id: string; sender_role: string; body: string; created_at: Date }>(
        `SELECT id, sender_role, body, created_at FROM trip_messages WHERE order_id = $1 ORDER BY created_at ASC LIMIT $2`,
        [orderId, EVIDENCE_CHAT_LIMIT],
      ),
      q<{
        id: string;
        reported_by_role: string;
        status: string;
        lat: string;
        lng: string;
        created_at: Date;
        resolved_at: Date | null;
        resolved_by: string | null;
        resolution_note: string | null;
      }>(
        `SELECT id, reported_by_role, status, lat, lng, created_at, resolved_at, resolved_by, resolution_note
           FROM sos_alerts WHERE order_id = $1 ORDER BY created_at ASC`,
        [orderId],
      ),
      q<{ from_role: string; score: number; comment: string | null; created_at: Date }>(
        `SELECT from_role, score, comment, created_at FROM ratings WHERE order_id = $1 ORDER BY created_at ASC`,
        [orderId],
      ),
      q<{ caller_role: string; created_at: Date }>(
        `SELECT caller_role, created_at FROM order_call_logs WHERE order_id = $1 ORDER BY created_at ASC`,
        [orderId],
      ),
      q<{ id: string; category: string; status: string; created_at: Date }>(
        `SELECT id, category, status, created_at FROM incidents
          WHERE order_vertical = 'taxi' AND order_id = $1 ORDER BY created_at ASC`,
        [orderId],
      ),
    ]);

    const evidence: OrderEvidence = {
      orderId,
      track: track.slice(0, EVIDENCE_TRACK_LIMIT).map((p) => ({
        lat: Number(p.lat),
        lng: Number(p.lng),
        recordedAt: iso(p.recorded_at) as string,
      })),
      trackTruncated: track.length > EVIDENCE_TRACK_LIMIT,
      chat: chat.map((m) => ({ id: m.id, senderRole: m.sender_role, body: m.body, createdAt: iso(m.created_at) as string })),
      sos: sos.map((s) => ({
        id: s.id,
        reportedByRole: s.reported_by_role,
        status: s.status,
        lat: Number(s.lat),
        lng: Number(s.lng),
        createdAt: iso(s.created_at) as string,
        resolvedAt: iso(s.resolved_at),
        resolvedBy: s.resolved_by,
        resolutionNote: s.resolution_note,
      })),
      ratings: ratings.map((r) => ({
        fromRole: r.from_role,
        score: Number(r.score),
        comment: r.comment,
        createdAt: iso(r.created_at) as string,
      })),
      calls: calls.map((c) => ({ callerRole: c.caller_role, createdAt: iso(c.created_at) as string })),
      incidents: incidents.map((i) => ({ id: i.id, category: i.category, status: i.status, createdAt: iso(i.created_at) as string })),
    };

    await this.auditLog.record({
      actorUserId,
      action: AUDIT_ACTIONS.orderEvidenceView,
      targetType: 'order',
      targetId: orderId,
      metadata: {
        trackPoints: evidence.track.length,
        chatMessages: evidence.chat.length,
        sos: evidence.sos.length,
      },
    });
    return evidence;
  }
}
