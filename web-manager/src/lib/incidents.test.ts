import { describe, expect, it } from 'vitest';
import {
  buildResolvePayload,
  emptyOutcome,
  needsAdmin,
  orderIncidentTargets,
  slaTone,
  suggestedOutcome,
  type ResolveDraft,
} from './incidents';

const draft = (over: Partial<ResolveDraft> = {}): ResolveDraft => ({
  status: 'resolved',
  note: 'Tasdiqlandi',
  confirmedAgainstSubject: true,
  outcomes: [],
  appealDecision: null,
  ...over,
});

describe('incidents', () => {
  it('SLA nishoni', () => {
    expect(slaTone({ status: 'open', ageHours: 3 })).toBe('ok');
    expect(slaTone({ status: 'investigating', ageHours: 30 })).toBe('warn');
    expect(slaTone({ status: 'open', ageHours: 49 })).toBe('late');
    expect(slaTone({ status: 'resolved', ageHours: 100 })).toBeNull();
  });

  it('admin kutilmoqda', () => {
    expect(needsAdmin({ escalatedToAdmin: true, appealedAt: null, appealDecision: null })).toBe(true);
    expect(needsAdmin({ escalatedToAdmin: false, appealedAt: '2026-11-01', appealDecision: null })).toBe(true);
    expect(needsAdmin({ escalatedToAdmin: false, appealedAt: '2026-11-01', appealDecision: 'upheld' })).toBe(false);
  });

  it("izoh majburiy; summa butun musbat; to'xtatish kuni ixtiyoriy", () => {
    expect(buildResolvePayload(draft({ note: ' ' }), { pendingAppeal: false, isAdmin: false }).problems).toEqual(['note']);
    const bad = buildResolvePayload(draft({ outcomes: [{ ...emptyOutcome('refund'), amount: '12.5' }] }), {
      pendingAppeal: false,
      isAdmin: false,
    });
    expect(bad.problems).toEqual(['amount']);
    const ok = buildResolvePayload(
      draft({ outcomes: [{ ...emptyOutcome('refund'), amount: '5 000' }, emptyOutcome('suspension')] }),
      { pendingAppeal: false, isAdmin: false },
    );
    expect(ok.payload).toEqual({
      status: 'resolved',
      note: 'Tasdiqlandi',
      confirmedAgainstSubject: true,
      outcomes: [{ type: 'refund', amount: 5000, refundMethod: 'wallet' }, { type: 'suspension' }],
    });
  });

  it("rad etilsa natija va tasdiq yuborilmaydi", () => {
    const { payload } = buildResolvePayload(draft({ status: 'rejected', outcomes: [emptyOutcome('warning')] }), {
      pendingAppeal: false,
      isAdmin: false,
    });
    expect(payload).toMatchObject({ status: 'rejected', outcomes: [], confirmedAgainstSubject: false });
  });

  it("menejer bloklay olmaydi; e'tirozda qaror majburiy", () => {
    expect(buildResolvePayload(draft({ outcomes: [emptyOutcome('block')] }), { pendingAppeal: false, isAdmin: false }).problems).toEqual([
      'block_admin',
    ]);
    expect(buildResolvePayload(draft(), { pendingAppeal: true, isAdmin: true }).problems).toEqual(['appeal']);
    expect(buildResolvePayload(draft({ appealDecision: 'overturned' }), { pendingAppeal: true, isAdmin: true }).payload).toMatchObject({
      appealDecision: 'overturned',
    });
  });

  it('zinapoya taklifi', () => {
    expect(suggestedOutcome('warning')).toBe('warning');
    expect(suggestedOutcome('suspension')).toBe('suspension');
    expect(suggestedOutcome('escalate_block')).toBeNull();
  });

  it('buyurtma sahifasi: kuryer safarida sotuvchi buyurtmasi ham', () => {
    expect(orderIncidentTargets({ id: 'o1' })).toEqual([{ vertical: 'taxi', id: 'o1' }]);
    expect(orderIncidentTargets({ id: 'o1', details: { foodOrderId: 'f1' } })).toEqual([
      { vertical: 'taxi', id: 'o1' },
      { vertical: 'food', id: 'f1' },
    ]);
  });
});
