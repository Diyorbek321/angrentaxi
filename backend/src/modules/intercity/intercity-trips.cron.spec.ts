import { IntercityTripsCron } from './intercity-trips.cron';

const NOW = new Date('2026-10-20T09:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const updated = (rows: unknown[]) => [rows, rows.length];

function build(candidates: Array<{ id: string; status: string; departure_at: Date; active: number }>) {
  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('UPDATE "intercity_trips"')) return updated([{ id: 'x' }]);
      if (sql.includes('UPDATE "orders"')) return updated([]);
      throw new Error(`unexpected ${sql}`);
    }),
  };
  const dataSource = {
    query: jest.fn(async () => candidates),
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  return { cron: new IntercityTripsCron(dataSource as never), dataSource, manager };
}

const tripUpdates = (manager: { query: jest.Mock }) =>
  (manager.query.mock.calls as unknown[][]).filter((call) => String(call[0]).includes('"intercity_trips"'));

describe('IntercityTripsCron.expireTrips', () => {
  it("bandsiz qatnov jo'nash +20 daqiqada — 'no_bookings' bilan bekor", async () => {
    const { cron, manager } = build([{ id: 't1', status: 'open', departure_at: minutesAgo(20), active: 0 }]);
    await expect(cron.expireTrips(NOW)).resolves.toBe(1);
    const [call] = tripUpdates(manager);
    expect(call[1]).toEqual(['t1', 'no_bookings', NOW]);
    expect(String(call[0])).toContain(`"status" IN ('open', 'full')`);
  });

  it("band bor, +30 daqiqa — haydovchiga hali vaqt bor, tegilmaydi", async () => {
    const { cron, manager } = build([{ id: 't2', status: 'full', departure_at: minutesAgo(30), active: 3 }]);
    await expect(cron.expireTrips(NOW)).resolves.toBe(0);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it("band bor, +60 — 'stale': qatnov va uning SCHEDULED bandlari bekor", async () => {
    const { cron, manager } = build([{ id: 't3', status: 'full', departure_at: minutesAgo(60), active: 2 }]);
    await expect(cron.expireTrips(NOW)).resolves.toBe(1);
    expect(tripUpdates(manager)[0][1]).toEqual(['t3', 'stale', NOW]);
    const orders = (manager.query.mock.calls as unknown[][]).find((call) => String(call[0]).includes('UPDATE "orders"'));
    expect(String(orders?.[0])).toContain(`"status" = 'scheduled'`);
  });

  it("nomzodlar so'rovi faqat open/full va 15 daqiqa o'tganlarni oladi", async () => {
    const { cron, dataSource } = build([]);
    await cron.expireTrips(NOW);
    const [sql, params] = dataSource.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain(`"status" IN ('open', 'full')`);
    expect(params[0]).toEqual(minutesAgo(15));
  });

  it("bitta qatnov xatosi qolganlarini to'xtatmaydi", async () => {
    const { cron, manager } = build([
      { id: 'bad', status: 'open', departure_at: minutesAgo(20), active: 0 },
      { id: 'ok', status: 'open', departure_at: minutesAgo(20), active: 0 },
    ]);
    manager.query.mockRejectedValueOnce(new Error('boom'));
    await expect(cron.expireTrips(NOW)).resolves.toBe(1);
  });

  it("tick o'rami xatoni yutadi — scheduler jim qolmasligi kerak", async () => {
    const { cron, dataSource } = build([]);
    dataSource.query.mockRejectedValueOnce(new Error('db down'));
    await expect(cron.handleTick()).resolves.toBeUndefined();
  });
});
