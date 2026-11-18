import { assertNotSuspended, formatTashkent, isSuspended } from './suspension';
import { SuspensionGate } from './suspension-gate.service';

describe("vaqtincha to'xtatish", () => {
  const now = new Date('2026-11-04T10:00:00Z');

  it('muddat ichida — to\'xtatilgan, o\'tgach — yo\'q', () => {
    expect(isSuspended({ suspendedUntil: new Date('2026-11-05T00:00:00Z'), suspensionReason: 'x' }, now)).toBe(true);
    expect(isSuspended({ suspendedUntil: new Date('2026-11-03T00:00:00Z'), suspensionReason: 'x' }, now)).toBe(false);
    expect(isSuspended({ suspendedUntil: null, suspensionReason: null }, now)).toBe(false);
  });

  it('Toshkent vaqti', () => {
    expect(formatTashkent('2026-11-07T10:00:00Z')).toBe('07.11.2026 15:00');
  });

  it('kodli 403: sabab va muddat bilan', () => {
    let error: unknown;
    try {
      assertNotSuspended(
        { suspendedUntil: new Date('2026-11-07T10:00:00Z'), suspensionReason: "Qo'pollik" },
        'go_online',
        now,
      );
    } catch (e) {
      error = e;
    }
    const body = (error as { getResponse(): Record<string, unknown>; getStatus(): number });
    expect(body.getStatus()).toBe(403);
    expect(body.getResponse()).toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
      message: "Hisobingiz 07.11.2026 15:00 gacha vaqtincha to'xtatilgan: Qo'pollik. Bu muddatda onlayn chiqa olmaysiz.",
      details: { until: '2026-11-07T10:00:00.000Z', reason: "Qo'pollik" },
    });
  });

  it('gate: foydalanuvchini o\'qiydi', async () => {
    const repo = { findOne: jest.fn(async () => ({ suspendedUntil: new Date(now.getTime() + 1000), suspensionReason: null })) };
    const gate = new SuspensionGate(repo as never);
    await expect(gate.assertMay('u1', 'new_order', now)).rejects.toMatchObject({ status: 403 });
    repo.findOne.mockResolvedValueOnce(null as never);
    await expect(gate.assertMay('u1', 'new_order', now)).resolves.toBeUndefined();
  });
});
