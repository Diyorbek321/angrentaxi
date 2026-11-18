import { IncidentSignalsService, ratingSignalTriggered } from './incident-signals.service';

describe('IncidentSignalsService (INCIDENT-POLICY §3 — reyting signali)', () => {
  it('oxirgi N o\'rtachasi chegaradan past — signal; N to\'lmagan — yo\'q', () => {
    expect(ratingSignalTriggered(Array(19).fill(1), 20, 4.3)).toBeNull();
    expect(ratingSignalTriggered([...Array(10).fill(5), ...Array(10).fill(3)], 20, 4.3)).toBe(4);
    expect(ratingSignalTriggered(Array(20).fill(5), 20, 4.3)).toBeNull();
  });

  function build(opts: { scores?: number[]; open?: unknown; recent?: number; userDraft?: number } = {}) {
    const repo = {
      count: jest.fn(async (q: { where: Record<string, unknown> }) =>
        'reporterUserId' in q.where ? (opts.userDraft ?? 0) : (opts.recent ?? 0),
      ),
      findOne: jest.fn(async () => opts.open ?? null),
      create: jest.fn((x: Record<string, unknown>) => x),
      save: jest.fn(async (x: Record<string, unknown>) => x),
      update: jest.fn(),
    };
    const dataSource = { query: jest.fn(async () => (opts.scores ?? []).map((score) => ({ score }))) };
    return { service: new IncidentSignalsService(repo as never, dataSource as never), repo };
  }

  const rating = { id: 'r1', orderId: 'o1', fromUserId: 'pax', toUserId: 'drv', fromRole: 'passenger' as const, score: 1, comment: 'Chekdi' };

  it("past baho + izoh — qoralama hodisa (izoh o'qiladi)", async () => {
    const ctx = build();
    await ctx.service.onRatingSubmitted(rating);
    expect(ctx.repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'low_rating', subjectUserId: 'drv', category: 'low_rating', ratingId: 'r1' }),
    );
  });

  it('izohsiz yoki 3★ — qoralama yo\'q', async () => {
    const ctx = build();
    await ctx.service.onRatingSubmitted({ ...rating, comment: null });
    await ctx.service.onRatingSubmitted({ ...rating, score: 3 });
    expect(ctx.repo.save).not.toHaveBeenCalled();
  });

  it('trend: tizim hodisasi, 30 kunda bir marta, ochig\'i yangilanadi', async () => {
    const low = Array(20).fill(4);
    const ctx = build({ scores: low });
    await ctx.service.onRatingSubmitted({ ...rating, comment: null, score: 4 });
    expect(ctx.repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'rating_signal', reporterUserId: null, reporterRole: 'system', subjectUserId: 'drv' }),
    );
    const cooled = build({ scores: low, recent: 1 });
    await cooled.service.onRatingSubmitted({ ...rating, comment: null, score: 4 });
    expect(cooled.repo.save).not.toHaveBeenCalled();
    const open = build({ scores: low, open: { id: 'sig-1' } });
    await open.service.onRatingSubmitted({ ...rating, comment: null, score: 4 });
    expect(open.repo.update).toHaveBeenCalledWith('sig-1', expect.objectContaining({ description: expect.stringContaining('4') }));
  });
});
