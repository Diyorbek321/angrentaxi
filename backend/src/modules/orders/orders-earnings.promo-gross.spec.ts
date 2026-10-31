import { DataSource, QueryRunner } from 'typeorm';
import { driverGrossFareSql } from './commission-policy';

/**
 * Haydovchining yalpi daromadi va 1% soliq bazasi — komissiya olingan baza.
 *
 * Taksi promo kodini platforma to'laydi (LEGAL-COMPLIANCE §26a): yangi
 * safarda baza chegirmagacha bo'lgan yo'l haqi. ESKI safarlarda esa komissiya
 * va soliq chegirmadan KEYINGI narxdan olingan. `final_price + discount` hamma
 * tarixga qo'llansa, o'tgan oylar hisobotda ushlangan soliqqa mos kelmaydi.
 * `driver_earning + komissiya` ikkala davrda ham aynan o'sha bazani beradi.
 */
describe('driverGrossFareSql', () => {
  it('bazani driver_earning + komissiya qatoridan oladi, eski qatorlar uchun final_price', () => {
    const sql = driverGrossFareSql('c');
    expect(sql).toContain('o.driver_earning + COALESCE(c.amount, 0)');
    expect(sql).toContain('o.final_price');
  });
});

const url = process.env.LEDGER_SQL_SPEC_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('driverGrossFareSql (Postgres)', () => {
  let ds: DataSource;
  let qr: QueryRunner;

  beforeAll(async () => {
    ds = new DataSource({ type: 'postgres', url, entities: [] });
    await ds.initialize();
    qr = ds.createQueryRunner();
    await qr.connect();
  });

  afterAll(async () => {
    await qr?.release();
    await ds?.destroy();
  });

  beforeEach(async () => {
    await qr.query(`DROP TABLE IF EXISTS pg_temp.orders, pg_temp.transactions`);
    await qr.query(`CREATE TEMP TABLE orders (
      id text PRIMARY KEY, final_price numeric, estimated_price numeric,
      discount_amount numeric, driver_earning numeric)`);
    await qr.query(`CREATE TEMP TABLE transactions (order_id text, external_id text, amount numeric)`);
  });

  const gross = async (orderId: string): Promise<number> => {
    const rows = (await qr.query(
      `SELECT ${driverGrossFareSql('c')} AS gross
         FROM orders o
         LEFT JOIN transactions c ON c.order_id = o.id AND c.external_id = 'commission'
        WHERE o.id = $1`,
      [orderId],
    )) as Array<{ gross: string }>;
    return Number(rows[0].gross);
  };

  it('YANGI promo safar: 20 000 − 5 000 chegirma, komissiya 2 000 → 20 000', async () => {
    await qr.query(`INSERT INTO orders VALUES ('new', 15000, 20000, 5000, 18000)`);
    await qr.query(`INSERT INTO transactions VALUES ('new', 'commission', 2000)`);
    await expect(gross('new')).resolves.toBe(20000);
  });

  it('ESKI promo safar: komissiya chegirmali 15 000 dan → 15 000 (20 000 emas)', async () => {
    await qr.query(`INSERT INTO orders VALUES ('old', 15000, 20000, 5000, 13500)`);
    await qr.query(`INSERT INTO transactions VALUES ('old', 'commission', 1500)`);
    await expect(gross('old')).resolves.toBe(15000);
  });

  it('komissiyasiz safar (smena / ishga tushirish aksiyasi) → driver_earning', async () => {
    await qr.query(`INSERT INTO orders VALUES ('free', 15000, 20000, 5000, 20000)`);
    await expect(gross('free')).resolves.toBe(20000);
  });

  it("driver_earning yo'q (juda eski qator) → final_price", async () => {
    await qr.query(`INSERT INTO orders VALUES ('legacy', 12000, 12000, NULL, NULL)`);
    await expect(gross('legacy')).resolves.toBe(12000);
  });
});
