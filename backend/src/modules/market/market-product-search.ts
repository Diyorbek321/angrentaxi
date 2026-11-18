/**
 * Market sahifasidagi qidiruv — BARCHA ochiq do'konlarning faol mahsulotlari
 * bo'yicha (ilgari ilova faqat ochiq turgan bitta do'kon ichidan qidirardi).
 *
 * Tartib: nomi so'rov bilan BOSHLANADIGANLAR birinchi ("sut" → "Sut 1 L"
 * "Shokoladli sut" dan oldin), keyin nom, so'ng `id` — sahifalar barqaror.
 *
 * O'zbekcha apostrof turlari (ʻ ʼ ‘ ’ ` ´) bitta `'` ga keltiriladi: do'kon
 * "Oʻrik" deb yozgan, xaridor "o'rik" deb qidiradi. `%` va `_` — oddiy
 * belgi (LIKE jokeri emas).
 *
 * Katalog kichik (yuzlab mahsulot) — oddiy LIKE yetadi. Minglab bo'lsa,
 * B reja: `pg_trgm` GIN indeksi (so'rov o'zgarmaydi).
 */
export const PRODUCT_QUERY_MIN_LENGTH = 2;
export const PRODUCT_QUERY_MAX_LENGTH = 60;

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

const APOSTROPHES = "ʻʼ‘’`´";
const APOSTROPHE_RE = /[ʻʼ‘’`´]/g;

/** Bo'sh joylarni qisqartiradi; juda qisqa yoki bo'sh — `null` (qidirilmaydi). */
export function normalizeProductQuery(raw: string | undefined | null): string | null {
  const q = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, PRODUCT_QUERY_MAX_LENGTH);
  return q.length >= PRODUCT_QUERY_MIN_LENGTH ? q : null;
}

const fold = (sqlExpr: string): string =>
  `translate(lower(${sqlExpr}), '${APOSTROPHES}', '${"''".repeat(APOSTROPHES.length)}')`;

const SEARCH_SQL = `
  SELECT p.id
    FROM products p
    JOIN stores st ON st.id = p.store_id AND st.status = 'active'
   WHERE p.status = 'active'
     AND ${fold('p.name')} LIKE '%' || $1 || '%' ESCAPE '\\'
   ORDER BY (${fold('p.name')} LIKE $1 || '%' ESCAPE '\\') DESC, p.name, p.id
   LIMIT $2 OFFSET $3`;

export async function searchProductIds(
  query: QueryFn,
  q: string,
  limit: number,
  offset: number,
): Promise<string[]> {
  const pattern = q
    .toLowerCase()
    .replace(APOSTROPHE_RE, "'")
    .replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const rows = (await query(SEARCH_SQL, [pattern, limit, offset])) as Array<{ id: string }>;
  return rows.map((row) => String(row.id));
}
