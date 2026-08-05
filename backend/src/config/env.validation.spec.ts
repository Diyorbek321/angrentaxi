// class-transformer reads design-time type metadata; in the app this is loaded
// by main.ts / the Nest test harness, so a plain unit test must import it too.
import 'reflect-metadata';
import { validateEnv } from './env.validation';

const baseEnv = {
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USER: 'postgres',
  DB_PASS: 'postgres',
  DB_NAME: 'angren_taxi',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  APP_SECRET: 'a'.repeat(32),
};

describe('validateEnv APP_SECRET', () => {
  it('accepts a 32-character secret', () => {
    expect(validateEnv({ ...baseEnv }).APP_SECRET).toHaveLength(32);
  });

  it('rejects a short secret rather than signing JWTs with weak entropy', () => {
    expect(() => validateEnv({ ...baseEnv, APP_SECRET: 'short-secret' })).toThrow(
      /APP_SECRET must be at least 32 characters/,
    );
  });

  it('rejects a missing secret', () => {
    const { APP_SECRET: _omitted, ...withoutSecret } = baseEnv;
    expect(() => validateEnv(withoutSecret)).toThrow(/APP_SECRET/);
  });
});

describe('validateEnv token TTLs', () => {
  it('defaults to the long lifetimes the current clients depend on', () => {
    const config = validateEnv({ ...baseEnv });

    expect(config.JWT_ACCESS_TTL).toBe('7d');
    expect(config.JWT_REFRESH_TTL).toBe('30d');
  });

  it('accepts shortened lifetimes', () => {
    const config = validateEnv({
      ...baseEnv,
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '2d',
    });

    expect(config.JWT_ACCESS_TTL).toBe('15m');
    expect(config.JWT_REFRESH_TTL).toBe('2d');
  });

  it('rejects an unparseable lifetime', () => {
    expect(() => validateEnv({ ...baseEnv, JWT_ACCESS_TTL: 'forever' })).toThrow(
      /JWT_ACCESS_TTL/,
    );
  });
});
