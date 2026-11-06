import { HealthService } from './health.service';

function makeService(opts: {
  dbQuery?: jest.Mock;
  redisPing?: jest.Mock;
  timeoutMs?: number;
}): HealthService {
  const dataSource = { query: opts.dbQuery ?? jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
  const redis = { ping: opts.redisPing ?? jest.fn().mockResolvedValue('PONG') };
  return new HealthService(dataSource as never, redis as never, opts.timeoutMs ?? 50);
}

describe('HealthService', () => {
  it('liveness never touches dependencies', () => {
    const dbQuery = jest.fn();
    const redisPing = jest.fn();
    const result = makeService({ dbQuery, redisPing }).liveness();

    expect(result.status).toBe('ok');
    expect(typeof result.uptimeSec).toBe('number');
    expect(dbQuery).not.toHaveBeenCalled();
    expect(redisPing).not.toHaveBeenCalled();
  });

  it('readiness is ok when database and redis answer', async () => {
    const result = await makeService({}).readiness();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('up');
    expect(result.checks.redis.status).toBe('up');
  });

  it('readiness is error when the database fails, without leaking the message', async () => {
    const dbQuery = jest.fn().mockRejectedValue(new Error('password authentication failed for user x'));
    const result = await makeService({ dbQuery }).readiness();

    expect(result.status).toBe('error');
    expect(result.checks.database.status).toBe('down');
    expect(result.checks.redis.status).toBe('up');
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('readiness is error when redis does not answer PONG', async () => {
    const redisPing = jest.fn().mockResolvedValue('nope');
    const result = await makeService({ redisPing }).readiness();

    expect(result.status).toBe('error');
    expect(result.checks.redis.status).toBe('down');
  });

  it('a hanging dependency is reported down after the timeout', async () => {
    const dbQuery = jest.fn(() => new Promise(() => undefined));
    const started = Date.now();
    const result = await makeService({ dbQuery, timeoutMs: 30 }).readiness();

    expect(result.checks.database.status).toBe('down');
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
