/**
 * Recharts SVG'ga rang MATN sifatida (`stroke`/`fill` proplari) beriladi —
 * u yerda Tailwind klassi ham, `rgb(var(--token))` ham ishlamaydi. Shuning
 * uchun diagramma ranglari shu yagona faylda qattiq kodlanadi va qiymatlari
 * docs/DESIGN-TOKENS.md dan 1:1 ko'chirilgan. Boshqa hech qayerda `#hex`
 * yozilmaydi.
 *
 * Tanlangan qiymatlar ikkala temada ham ishlaydi:
 *  - `mint-deep` (#10A064) yorug' fonda 3.37:1 — non-text uchun ✓,
 *    qorong'i yuzada ham aniq ko'rinadi.
 *  - Diagramma to'ri va o'q yozuvlari globals.css dagi `.recharts-*`
 *    qoidalari orqali temaga bog'langan (`--line` / `--ink-muted`).
 */
export const CHART_COLORS = {
  /** Asosiy seriya — brend minti, yorug' fonda ko'rinadigan varianti. */
  primary: '#10A064',
  /** Ikkinchi seriya. */
  info: '#3B82F6',
  /** Uchinchi seriya / kategoriya. */
  violet: '#8B5CF6',
  /** Qo'lda aralashuv / ogohlantirish seriyasi. */
  override: '#F59E0B',
  /** Xato / bekor qilingan seriya. */
  danger: '#E5484D',
} as const;
