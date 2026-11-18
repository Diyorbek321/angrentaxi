import { IntercityTripsCron } from './intercity-trips.cron';

const NOW = new Date('2026-10-20T09:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const updated = (rows: unknown[]) => [rows, rows.length];

function build(
  candidates: Array<{ id: string; status: string; departure_at: Date; active: number }>,
  passengers: string[] = [],
) {
  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('UPDATE "intercity_trips"')) return updated([{ id: 'x' }]);
      if (sql.includes('UPDATE "orders"')) return updated(passengers.map((id) => ({ passenger_id: id })));
      throw new Error(`unexpected ${sql}`);
    }),
  };
  const dataSource = {
    query: jest.fn(async () => candidates),
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const notifier = {
    tripCancelled: jest.fn(async () => undefined),
    departureReminder: jest.fn(async () => undefined),
    tripUpdated: jest.fn(async () => undefined),
  };
  const requests = { expireDue: jest.fn(async () => 0) };
  return {
    cron: new IntercityTripsCron(dataSource as never, notifier as never, requests as never),
    dataSource,
    manager,
    notifier,
    requests,
  };
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

describe('IntercityTripsCron — xabarlar', () => {
  it("'stale' bekor qilingach bandi yopilgan yo'lovchilarga tizim xabari", async () => {
    const { cron, manager, notifier } = build(
      [{ id: 't1', status: 'full', departure_at: minutesAgo(61), active: 2 }],
      ['p1', 'p2'],
    );
    await cron.expireTrips(NOW);

    const ordersSql = (manager.query.mock.calls as unknown[][]).map((call) => String(call[0])).find((sql) => sql.includes('UPDATE "orders"'));
    expect(ordersSql).toContain('RETURNING "passenger_id"');
    expect(notifier.tripCancelled).toHaveBeenCalledWith('t1', 'stale', ['p1', 'p2'], 'system');
  });

  it("yopilmagan qatnov uchun xabar yo'q", async () => {
    const { cron, notifier } = build([{ id: 't1', status: 'open', departure_at: minutesAgo(30), active: 1 }]);
    await cron.expireTrips(NOW);
    expect(notifier.tripCancelled).not.toHaveBeenCalled();
  });
});

describe('IntercityTripsCron.sendDepartureReminders', () => {
  it("jo'nashga ≤60 daqiqa qolgan, bandi bor qatnovlarni bir martalik egallab eslatma yuboradi", async () => {
    const { cron, dataSource, notifier } = build([]);
    dataSource.query.mockResolvedValueOnce(updated([{ id: 't1' }, { id: 't2' }]) as never);

    await expect(cron.sendDepartureReminders(NOW)).resolves.toBe(2);

    const [sql, params] = dataSource.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('"reminder_sent_at" IS NULL');
    expect(sql).toContain(`"status" IN ('open', 'full')`);
    expect(sql).toContain("NOT IN ('completed', 'cancelled')");
    expect(sql).toContain('RETURNING');
    expect(params).toEqual([NOW, new Date(NOW.getTime() + 60 * 60_000)]);
    expect(notifier.departureReminder).toHaveBeenCalledWith('t1');
    expect(notifier.departureReminder).toHaveBeenCalledWith('t2');
  });

  it("egallanadigan qatnov yo'q — xabar yo'q", async () => {
    const { cron, dataSource, notifier } = build([]);
    dataSource.query.mockResolvedValueOnce(updated([]) as never);

    await expect(cron.sendDepartureReminders(NOW)).resolves.toBe(0);
    expect(notifier.departureReminder).not.toHaveBeenCalled();
  });

  it("tick: eslatma yiqilsa ham yopish ishlaydi (va aksincha)", async () => {
    const { cron, dataSource } = build([]);
    const expire = jest.spyOn(cron, 'expireTrips').mockRejectedValue(new Error('boom'));
    const remind = jest.spyOn(cron, 'sendDepartureReminders').mockResolvedValue(0);
    const sweep = jest.spyOn(cron, 'sweepStuckTrips').mockRejectedValue(new Error('boom'));

    await expect(cron.handleTick()).resolves.toBeUndefined();
    expect(expire).toHaveBeenCalled();
    expect(remind).toHaveBeenCalled();
    expect(sweep).toHaveBeenCalled();
    void dataSource;
  });

  it("tick: qatnov ishlari yiqilsa ham so'rovlar eskiradi", async () => {
    const { cron, requests } = build([]);
    jest.spyOn(cron, 'expireTrips').mockRejectedValue(new Error('boom'));
    jest.spyOn(cron, 'sendDepartureReminders').mockRejectedValue(new Error('boom'));
    jest.spyOn(cron, 'sweepStuckTrips').mockRejectedValue(new Error('boom'));
    requests.expireDue.mockRejectedValueOnce(new Error('boom'));

    await expect(cron.handleTick()).resolves.toBeUndefined();
    expect(requests.expireDue).toHaveBeenCalled();
  });
});

describe('IntercityTripsCron.sweepStuckTrips — qotib qolgan qatnovlar', () => {
  /** SQL matniga qarab javob beradi: supurgining har bir bosqichi alohida so'rov. */
  function sweepBuild(answers: { finished?: string[]; emptied?: string[]; abandoned?: string[]; passengers?: string[] }) {
    const built = build([], answers.passengers ?? []);
    built.dataSource.query.mockImplementation((async (sql: string) => {
      if (sql.includes(`SET "status" = 'completed'`)) return updated((answers.finished ?? []).map((id) => ({ id })));
      if (sql.includes(`"cancel_reason" = 'no_passengers'`)) return updated((answers.emptied ?? []).map((id) => ({ id })));
      if (sql.includes('SELECT t."id"') && sql.includes(`'boarding'`)) return (answers.abandoned ?? []).map((id) => ({ id }));
      throw new Error(`unexpected ${sql}`);
    }) as never);
    return built;
  }

  it("yo'lda, tirik bandi qolmagan — 'completed' (parallel yakunlash poygasidan qolgan)", async () => {
    const { cron, dataSource, notifier } = sweepBuild({ finished: ['t1'] });
    await cron.sweepStuckTrips(NOW);

    const sql = (dataSource.query.mock.calls as unknown[][]).map((call) => String(call[0])).find((q) => q.includes(`'completed'`));
    expect(sql).toContain(`"status" = 'in_progress'`);
    expect(sql).toContain('NOT EXISTS');
    expect(notifier.tripUpdated).toHaveBeenCalledWith('t1');
  });

  it("yig'ishda, tirik bandi qolmagan — 'no_passengers' bilan bekor", async () => {
    const { cron, notifier } = sweepBuild({ emptied: ['t2'] });
    await cron.sweepStuckTrips(NOW);
    expect(notifier.tripCancelled).toHaveBeenCalledWith('t2', 'no_passengers', [], 'system');
  });

  it("yig'ishda jo'nashdan 3 soatdan ko'p — tashlab ketilgan: qatnov va tirik bandlar bekor, yo'lovchilarga xabar", async () => {
    const { cron, dataSource, manager, notifier } = sweepBuild({ abandoned: ['t3'], passengers: ['p1'] });
    await cron.sweepStuckTrips(NOW);

    const select = (dataSource.query.mock.calls as unknown[][]).find((call) => String(call[0]).includes('SELECT t."id"'));
    expect(select?.[1]).toEqual([new Date(NOW.getTime() - 3 * 60 * 60_000), expect.any(Number)]);
    const tripSql = (manager.query.mock.calls as unknown[][]).map((call) => String(call[0])).find((q) => q.includes('"intercity_trips"'));
    expect(tripSql).toContain(`"status" = 'boarding'`);
    const ordersSql = (manager.query.mock.calls as unknown[][]).map((call) => String(call[0])).find((q) => q.includes('UPDATE "orders"'));
    expect(ordersSql).toContain(`IN ('accepted', 'arrived')`);
    expect(notifier.tripCancelled).toHaveBeenCalledWith('t3', 'abandoned', ['p1'], 'system');
  });

  it("hech narsa qotmagan — xabar yo'q", async () => {
    const { cron, notifier } = sweepBuild({});
    await expect(cron.sweepStuckTrips(NOW)).resolves.toBe(0);
    expect(notifier.tripUpdated).not.toHaveBeenCalled();
    expect(notifier.tripCancelled).not.toHaveBeenCalled();
  });
});
