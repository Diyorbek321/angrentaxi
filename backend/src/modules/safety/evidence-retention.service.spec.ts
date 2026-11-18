import { batchDeleteSql, RETENTION_BATCH_SIZE, RETENTION_TABLES } from './evidence-retention';
import { EvidenceRetentionService } from './evidence-retention.service';

describe('EvidenceRetentionService (INCIDENT-POLICY §6)', () => {
  function build(opts: { batches?: number[]; photoRows?: Array<{ id: string; photo_keys: unknown }>; failKey?: string } = {}) {
    const batches = [...(opts.batches ?? [])];
    let photoRows = opts.photoRows ?? [];
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('jsonb_array_length')) {
        const rows = photoRows;
        photoRows = [];
        return rows;
      }
      if (sql.includes('UPDATE incidents')) return [];
      if (sql.includes('trip_share_links')) return [{ deleted: 2 }];
      return [{ deleted: batches.length ? batches.shift() : 0 }];
    });
    const storage = {
      delete: jest.fn(async (key: string) => {
        if (key === opts.failKey) throw new Error('r2 down');
      }),
    };
    const settings = { getSafetyPolicySettings: jest.fn(async () => ({ evidenceRetentionDays: 180 })) };
    const service = new EvidenceRetentionService({ query } as never, settings as never, storage as never);
    return { service, query, storage };
  }

  it("har jadval bo'laklab: to'liq bo'lak bo'lsa davom etadi, kichigida to'xtaydi", async () => {
    const { service, query } = build({ batches: [RETENTION_BATCH_SIZE, 5] });
    const report = await service.purge();
    expect(report.deleted.trip_track_points).toBe(RETENTION_BATCH_SIZE + 5);
    expect(report.deleted.trip_messages).toBe(0);
    expect(report.deleted.trip_share_links).toBe(2);
    expect(report.retentionDays).toBe(180);
    const firstCall = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(firstCall[1]).toEqual([180, RETENTION_BATCH_SIZE]);
  });

  it("muddat SQL now() dan (JS sanasi emas); ochiq hodisa safarlari himoyalangan; faol SOS qoladi", () => {
    for (const table of RETENTION_TABLES) {
      const sql = batchDeleteSql(table);
      expect(sql).toContain('now() - make_interval(days => $1::int)');
      expect(sql).toContain('NOT IN (SELECT id FROM protected');
      expect(sql).toContain(`DELETE FROM ${table.table}`);
    }
    expect(batchDeleteSql(RETENTION_TABLES.find((t) => t.table === 'sos_alerts')!)).toContain("status <> 'active'");
  });

  it("hodisa fotolari: obyekt o'chadi, kalit ro'yxatdan olinadi; o'chmagani qoladi", async () => {
    const { service, query, storage } = build({
      photoRows: [{ id: 'i1', photo_keys: ['incident-photos/a.jpg', 'incident-photos/b.jpg'] }],
      failKey: 'incident-photos/b.jpg',
    });
    const report = await service.purge();
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(report.incidentPhotos).toBe(1);
    expect(report.failedPhotoKeys).toBe(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE incidents'), ['i1', '["incident-photos/b.jpg"]']);
  });

  it("cron xatosi yutiladi va jurnalga yoziladi", async () => {
    const { service, query } = build();
    query.mockRejectedValueOnce(new Error('db down'));
    await expect(service.scheduled()).resolves.toBeUndefined();
  });
});
