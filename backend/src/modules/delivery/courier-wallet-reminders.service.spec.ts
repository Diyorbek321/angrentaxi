import {
  CourierWalletRemindersService,
  formatUzbekDayMonth,
} from './courier-wallet-reminders.service';

/**
 * 2026-12-12 dan oldin kuryerlarga ogohlantirish (docs/LEGAL-COMPLIANCE.md §16):
 * sanadan 14 kun oldin boshlab, kuniga ko'pi bilan bitta push.
 */
describe('CourierWalletRemindersService', () => {
  const FROM = '2026-12-11T19:00:00.000Z'; // 2026-12-12 00:00 Toshkent

  function build(opts: { from?: string | null; effective?: 'cash' | 'wallet' } = {}) {
    const sent = new Set<string>();
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM drivers')) {
        return [
          { user_id: 'courier-1', fcm_token: 'tok-1' },
          { user_id: 'courier-2', fcm_token: null },
        ];
      }
      if (sql.includes('INSERT INTO courier_wallet_reminders')) {
        const key = `${params[0]}|${params[1]}`;
        if (sent.has(key)) return [];
        sent.add(key);
        return [{ user_id: params[0] }];
      }
      throw new Error(`unexpected sql: ${sql}`);
    });
    const notifications = { notifyWalletEvent: jest.fn(async () => undefined) };
    const settings = {
      getVendorSettlementSettings: jest.fn(async () => ({
        vendorSettlementMode: 'cash',
        vendorWalletSettlementFrom: opts.from === undefined ? FROM : opts.from,
        effectiveVendorSettlementMode: opts.effective ?? 'cash',
      })),
    };
    const service = new CourierWalletRemindersService(
      { query } as never,
      settings as never,
      notifications as never,
    );
    return { service, notifications, query, sent };
  }

  it("sana formati: '12-dekabr'", () => {
    expect(formatUzbekDayMonth(new Date(FROM))).toBe('12-dekabr');
  });

  it("14 kundan oldin — hech narsa yuborilmaydi", async () => {
    const h = build();
    const res = await h.service.sendReminders(new Date('2026-11-27T05:00:00Z'));
    expect(res).toEqual({ notified: 0, skipped: 'not_in_window' });
    expect(h.notifications.notifyWalletEvent).not.toHaveBeenCalled();
  });

  it("oynada: har bir kuryerga bitta push, matnda sana", async () => {
    const h = build();
    const res = await h.service.sendReminders(new Date('2026-11-28T05:00:00Z'));
    expect(res.notified).toBe(2);
    expect(h.notifications.notifyWalletEvent).toHaveBeenCalledWith(
      { id: 'courier-1', fcmToken: 'tok-1' },
      expect.any(String),
      "12-dekabrdan restoran/do'kon bilan hisob-kitob hamyon orqali bo'ladi — hamyoningizni to'ldiring",
      'courier_wallet_settlement_reminder',
      expect.objectContaining({ effectiveFrom: FROM }),
    );
    // Toshkent sanasi bilan idempotent.
    expect(h.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT DO NOTHING'), ['courier-1', '2026-11-28']);
  });

  it("o'sha kuni ikkinchi ishga tushish — takroriy push yo'q; ertasi kuni — yana", async () => {
    const h = build();
    await h.service.sendReminders(new Date('2026-11-28T05:00:00Z'));
    const again = await h.service.sendReminders(new Date('2026-11-28T15:00:00Z'));
    expect(again.notified).toBe(0);
    const nextDay = await h.service.sendReminders(new Date('2026-11-29T05:00:00Z'));
    expect(nextDay.notified).toBe(2);
    expect(h.notifications.notifyWalletEvent).toHaveBeenCalledTimes(4);
  });

  it("sana o'tgan, sana yo'q yoki hamyon rejimi allaqachon amalda — yuborilmaydi", async () => {
    expect((await build().service.sendReminders(new Date('2026-12-12T05:00:00Z'))).skipped).toBe('not_in_window');
    expect((await build({ from: null }).service.sendReminders(new Date('2026-12-01T05:00:00Z'))).skipped).toBe(
      'no_date',
    );
    expect(
      (await build({ effective: 'wallet' }).service.sendReminders(new Date('2026-12-01T05:00:00Z'))).skipped,
    ).toBe('already_wallet');
  });
});
