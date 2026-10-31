import { DataSource, QueryRunner } from 'typeorm';
import { normalizeProductQuery, searchProductIds } from './market-product-search';

describe('normalizeProductQuery', () => {
  it("bo'sh joylar qisqaradi; 2 belgidan qisqa — null", () => {
    expect(normalizeProductQuery('  sut   1l ')).toBe('sut 1l');
    expect(normalizeProductQuery('a')).toBeNull();
    expect(normalizeProductQuery(undefined)).toBeNull();
  });

  it('uzun so‘rov 60 belgiga qisqartiriladi', () => {
    expect(normalizeProductQuery('x'.repeat(200))).toHaveLength(60);
  });
});

/**
 * Barcha do'konlar bo'yicha mahsulot qidiruvi — haqiqiy Postgres'da (TEMP
 * jadvallar haqiqiylarini soyalaydi). `LEDGER_SQL_SPEC_DATABASE_URL` bilan.
 */
const url = process.env.LEDGER_SQL_SPEC_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('searchProductIds (Postgres)', () => {
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

  beforeEach(async () => {
    await query(`DROP TABLE IF EXISTS pg_temp.products, pg_temp.stores`);
    await query(`CREATE TEMP TABLE stores (id text PRIMARY KEY, status text)`);
    await query(`CREATE TEMP TABLE products (id text PRIMARY KEY, store_id text, status text, name text)`);
    await query(`INSERT INTO stores VALUES ('s1', 'active'), ('s2', 'active'), ('closed', 'closed')`);
  });

  const product = (id: string, store: string, name: string, status = 'active') =>
    query(`INSERT INTO products VALUES ($1, $2, $3, $4)`, [id, store, status, name]);

  it("barcha ochiq do'konlardan; nom bilan BOSHLANADIGANLAR birinchi", async () => {
    await product('choc-milk', 's1', 'Shokoladli sut');
    await product('milk-s1', 's1', 'Sut 1 L');
    await product('milk-s2', 's2', 'Sut 2.5%');
    await product('bread', 's2', 'Non');

    await expect(searchProductIds(query, 'sut', 10, 0)).resolves.toEqual(['milk-s1', 'milk-s2', 'choc-milk']);
  });

  it("katta-kichik harf va o'zbekcha apostrof turlari farq qilmaydi", async () => {
    await product('a', 's1', 'Oʻrik quritilgan');
    await product('b', 's1', 'O’rik sharbati');
    await expect(searchProductIds(query, "O'RIK", 10, 0)).resolves.toEqual(['a', 'b']);
  });

  it("yopiq do'kon va faol bo'lmagan mahsulot chiqmaydi", async () => {
    await product('ok', 's1', 'Sut');
    await product('hidden', 's1', 'Sut', 'hidden');
    await product('in-closed', 'closed', 'Sut');
    await expect(searchProductIds(query, 'sut', 10, 0)).resolves.toEqual(['ok']);
  });

  it('% va _ — oddiy belgi, hammasini qaytaruvchi joker emas', async () => {
    await product('pct', 's1', 'Sut 2.5%');
    await product('plain', 's1', 'Sut');
    await expect(searchProductIds(query, '%', 10, 0)).resolves.toEqual(['pct']);
    await expect(searchProductIds(query, '_', 10, 0)).resolves.toEqual([]);
  });

  it('sahifalash barqaror', async () => {
    for (let i = 0; i < 5; i += 1) await product(`p${i}`, 's1', 'Sut');
    const pages = [
      ...(await searchProductIds(query, 'sut', 2, 0)),
      ...(await searchProductIds(query, 'sut', 2, 2)),
      ...(await searchProductIds(query, 'sut', 2, 4)),
    ];
    expect(new Set(pages).size).toBe(5);
  });
});
