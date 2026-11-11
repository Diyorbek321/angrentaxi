/**
 * Bosh sahifadagi "Trenddagi mahsulotlar" — qaysi mahsulotlar va qaysi
 * tartibda. Sof SQL, `MarketService.listTrendingProducts` chaqiradi.
 *
 * Tartib:
 *  1. oxirgi [TRENDING_WINDOW_DAYS] kunda YETKAZILGAN buyurtmalardagi dona
 *     soni (bekor qilinganlar sanalmaydi — ular talab emas);
 *  2. B reja — sotuv yo'q yoki kam bo'lsa, qolgani yangi mahsulotlar bilan
 *     to'ladi: ishga tushgan kunlarda ham bo'lim bo'sh turmaydi;
 *  3. `id` — teng qiymatlarda barqaror tartib, aks holda sahifalar orasida
 *     mahsulot takrorlanardi yoki tushib qolardi.
 *
 * Faqat ochiq do'konlarning faol mahsulotlari (vitrinadagi bilan bir xil).
 * `productId` matn sifatida solishtiriladi: buzuq JSON qatori uuid'ga
 * o'girishda butun so'rovni yiqitmasin.
 */
export const TRENDING_WINDOW_DAYS = 7;

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

const TRENDING_SQL = `
  WITH sold AS (
    SELECT item->>'productId' AS product_id, SUM(COALESCE((item->>'qty')::int, 0)) AS sold
      FROM market_orders mo
     CROSS JOIN LATERAL jsonb_array_elements(mo.items) AS item
     WHERE mo.status = 'delivered'
       AND mo.created_at >= now() - make_interval(days => $3)
       AND item ? 'productId'
     GROUP BY 1
  )
  SELECT p.id
    FROM products p
    JOIN stores st ON st.id = p.store_id AND st.status = 'active'
    LEFT JOIN sold s ON s.product_id = p.id::text
   WHERE p.status = 'active'
   ORDER BY COALESCE(s.sold, 0) DESC, p.created_at DESC, p.id
   LIMIT $1 OFFSET $2`;

export async function trendingProductIds(query: QueryFn, limit: number, offset: number): Promise<string[]> {
  const rows = (await query(TRENDING_SQL, [limit, offset, TRENDING_WINDOW_DAYS])) as Array<{ id: string }>;
  return rows.map((row) => String(row.id));
}
