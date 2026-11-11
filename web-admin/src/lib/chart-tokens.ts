import { t } from '@/locales';

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

/**
 * Chart geometry (PANEL-UI-KIT §6): bars never wider than 32px, and a series
 * with fewer than 3 points is not a trend — show an empty state instead of
 * one giant bar.
 */
export const CHART_BAR_MAX_PX = 32;
export const CHART_MIN_POINTS = 3;
export const CHART_HEIGHT_PX = 240;
export function chartNotEnoughData(): string {
  return t().dashboard.chart.notEnoughData;
}
