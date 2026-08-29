// class-transformer reads design-time type metadata; in the app this is loaded
// by main.ts / the Nest test harness, so a plain unit test must import it too.
import 'reflect-metadata';
import { validateEnv } from './env.validation';

const baseEnv = {
  // MAJBURIY: standart qiymati ataylab olib tashlangan
  // (`env.validation.ts` dagi izohga qarang).
  NODE_ENV: 'development',
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USER: 'postgres',
  DB_PASS: 'postgres',
  DB_NAME: 'angren_taxi',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  APP_SECRET: 'a'.repeat(32),
};

describe('validateEnv NODE_ENV', () => {
  it("ko'rsatilmagan bo'lsa ilova KO'TARILMAYDI", () => {
    // ⚠️ Ilgari bu holat jimgina `development` ga tushardi va deploy
    // qilingan server bir vaqtning o'zida OTP kodini javobda qaytarishni,
    // `synchronize` ni, yumshoq CORS'ni va stack trace'larni ochib
    // qo'yardi. Sozlamaning yo'qligi eng ochiq holatni bermasligi kerak.
    const { NODE_ENV: _omitted, ...withoutEnv } = baseEnv;

    expect(() => validateEnv(withoutEnv)).toThrow(/NODE_ENV/);
  });

  it("noto'g'ri qiymatni rad etadi", () => {
    // "prod" yoki "PRODUCTION" kabi yaqin, lekin noto'g'ri qiymat
    // productionni ochib yuborardi — shuning uchun ro'yxat qat'iy.
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'prod' })).toThrow(/NODE_ENV/);
  });

  it("uchta yaroqli qiymatni qabul qiladi", () => {
    for (const value of ['development', 'production', 'test']) {
      expect(validateEnv({ ...baseEnv, NODE_ENV: value }).NODE_ENV).toBe(value);
    }
  });
});

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
