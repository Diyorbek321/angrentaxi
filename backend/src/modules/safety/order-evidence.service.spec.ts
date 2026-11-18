import { NotFoundException } from '@nestjs/common';
import { OrderEvidenceService } from './order-evidence.service';

describe('OrderEvidenceService (INCIDENT-POLICY §4)', () => {
  function build(rowsBySql: Array<[RegExp, unknown[]]>) {
    const query = jest.fn(async (sql: string) => {
      const hit = rowsBySql.find(([re]) => re.test(sql));
      return hit ? hit[1] : [];
    });
    const audit = { record: jest.fn(async () => ({ id: 'a1' })) };
    return { service: new OrderEvidenceService({ query } as never, audit as never), query, audit };
  }

  it("iz, chat, SOS, baho, qo'ng'iroq, hodisa — va ko'rish auditga yoziladi", async () => {
    const { service, audit } = build([
      [/FROM orders/, [{ '?column?': 1 }]],
      [/trip_track_points/, [{ lat: '41.0', lng: '70.1', recorded_at: new Date('2026-11-04T10:00:00Z') }]],
      [/trip_messages/, [{ id: 'm1', sender_role: 'passenger', body: 'salom', created_at: new Date('2026-11-04T10:01:00Z') }]],
      [/sos_alerts/, [{ id: 's1', reported_by_role: 'passenger', status: 'resolved', lat: '41', lng: '70', created_at: new Date(), resolved_at: null, resolved_by: 'm1', resolution_note: 'ok' }]],
      [/FROM ratings/, [{ from_role: 'passenger', score: 2, comment: 'yomon', created_at: new Date() }]],
      [/order_call_logs/, [{ caller_role: 'driver', created_at: new Date() }]],
      [/FROM incidents/, [{ id: 'i1', category: 'rude', status: 'open', created_at: new Date() }]],
    ]);
    const evidence = await service.getEvidence('o1', 'manager-1');
    expect(evidence.track).toEqual([{ lat: 41, lng: 70.1, recordedAt: '2026-11-04T10:00:00.000Z' }]);
    expect(evidence.trackTruncated).toBe(false);
    expect(evidence.chat[0]).toMatchObject({ senderRole: 'passenger', body: 'salom' });
    expect(evidence.sos[0]).toMatchObject({ resolvedBy: 'm1', resolutionNote: 'ok' });
    expect(evidence.ratings[0].score).toBe(2);
    expect(evidence.calls).toHaveLength(1);
    expect(evidence.incidents[0].id).toBe('i1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'manager-1', action: 'order.evidence_view', targetType: 'order', targetId: 'o1' }),
    );
  });

  it("buyurtma yo'q — 404, audit yozilmaydi", async () => {
    const { service, audit } = build([]);
    await expect(service.getEvidence('o1', 'm')).rejects.toThrow(NotFoundException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
