import { DataSource, QueryRunner } from 'typeorm';
import { TRENDING_WINDOW_DAYS, trendingProductIds } from './market-trending';

/**
 * Bosh sahifadagi "Trenddagi mahsulotlar" tartibi — haqiqiy Postgres'da.
 *
 * Asosiy reja: oxirgi 7 kunda YETKAZILGAN buyurtmalardagi dona soni.
 * B reja: sotuv yo'q/kam bo'lsa ro'yxat yangi mahsulotlar bilan to'ladi —
 * bo'lim hech qachon bo'sh qolmaydi (docs/CONTINGENCY-PLAN.md qoidasi).
 *
 * TEMP jadvallar haqiqiy jadvallarni soyalaydi — bazadagi ma'lumotga
 * tegilmaydi. Faqat `LEDGER_SQL_SPEC_DATABASE_URL` bilan ishlaydi.
 */
const url = process.env.LEDGER_SQL_SPEC_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('trendingProductIds (Postgres)', () => {
  let ds: DataSource;
  let qr: QueryRunner;
  const query = (sql: string, params?: unknown[]) => qr.query(sql, params);

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

  const product = (id: string, store: string, status: string, createdDaysAgo: number) =>
    query(`INSERT INTO products VALUES ($1, $2, $3, now() - ($4 || ' days')::interval)`, [
      id,
      store,
      status,
      createdDaysAgo,
    ]);
  const order = (status: string, daysAgo: number, items: Array<{ productId: string; qty: number }>) =>
    query(`INSERT INTO market_orders VALUES ($1, $2::jsonb, now() - ($3 || ' days')::interval)`, [
      status,
      JSON.stringify(items),
      daysAgo,
    ]);

  beforeEach(async () => {
    await query(`DROP TABLE IF EXISTS pg_temp.products, pg_temp.stores, pg_temp.market_orders`);
    await query(`CREATE TEMP TABLE stores (id text PRIMARY KEY, status text)`);
    await query(`CREATE TEMP TABLE products (id text PRIMARY KEY, store_id text, status text, created_at timestamptz)`);
    await query(`CREATE TEMP TABLE market_orders (status text, items jsonb, created_at timestamptz)`);
    await query(`INSERT INTO stores VALUES ('s1', 'active'), ('s2', 'active'), ('closed', 'closed')`);
  });

  it('eng ko‘p sotilgan birinchi; sotuvsizlar yangidan eskiga', async () => {
    await product('bread', 's1', 'active', 30);
    await product('milk', 's2', 'active', 30);
    await product('new', 's1', 'active', 1);
    await product('old', 's1', 'active', 60);
    await order('delivered', 1, [{ productId: 'milk', qty: 5 }, { productId: 'bread', qty: 2 }]);
    await order('delivered', 2, [{ productId: 'bread', qty: 1 }]);

    await expect(trendingProductIds(query, 10, 0)).resolves.toEqual(['milk', 'bread', 'new', 'old']);
  });

  it(`faqat yetkazilgan va oxirgi ${TRENDING_WINDOW_DAYS} kun`, async () => {
    await product('a', 's1', 'active', 30);
    await product('b', 's1', 'active', 20);
    await order('cancelled', 1, [{ productId: 'a', qty: 100 }]);
    await order('delivered', TRENDING_WINDOW_DAYS + 1, [{ productId: 'a', qty: 100 }]);
    await order('delivered', 1, [{ productId: 'b', qty: 1 }]);

    await expect(trendingProductIds(query, 10, 0)).resolves.toEqual(['b', 'a']);
  });

  it('yashirin/tugagan mahsulot va yopiq do‘kon chiqmaydi', async () => {
    await product('ok', 's1', 'active', 5);
    await product('hidden', 's1', 'hidden', 5);
    await product('out', 's1', 'out', 5);
    await product('in-closed', 'closed', 'active', 5);

    await expect(trendingProductIds(query, 10, 0)).resolves.toEqual(['ok']);
  });

  it('sahifalash barqaror: takror ham, tushib qolgan ham yo‘q', async () => {
    for (let i = 0; i < 5; i += 1) await product(`p${i}`, 's1', 'active', 3);
    const first = await trendingProductIds(query, 2, 0);
    const second = await trendingProductIds(query, 2, 2);
    const third = await trendingProductIds(query, 2, 4);
    const all = [...first, ...second, ...third];
    expect(new Set(all).size).toBe(5);
  });

  it('buzuq JSON qatori (productId yo‘q) so‘rovni yiqitmaydi', async () => {
    await product('a', 's1', 'active', 3);
    await query(`INSERT INTO market_orders VALUES ('delivered', '[{"qty": 2}]'::jsonb, now())`);
    await expect(trendingProductIds(query, 10, 0)).resolves.toEqual(['a']);
  });
});
