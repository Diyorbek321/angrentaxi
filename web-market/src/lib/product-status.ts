import { CheckCircle2, CircleOff, EyeOff, type LucideIcon } from 'lucide-react';
import type { ProductStatus } from './api';
import type { BadgeVariant } from '@/components/ui/Badge';
import { t } from '@/locales';

/**
 * Mahsulot holati (katalog) — buyurtma holatidan alohida lug'at, lekin xuddi
 * shu tamoyil: yozuv + ikonka + token rang, hech qanday yangi hex yo'q.
 */
export interface ProductStatusMeta {
  label: string;
  /** Katalog segmenti sarlavhasi ("Sotuvda", "Tugagan", ...). */
  segmentLabel: string;
  variant: BadgeVariant;
  Icon: LucideIcon;
}

/** Rang va ikonka — tilga bog'liq emas. Yozuvlar `productStatusMeta` da, joriy tilda. */
const PRODUCT_STATUS_STYLE: Record<ProductStatus, Pick<ProductStatusMeta, 'variant' | 'Icon'>> = {
  active: { variant: 'success', Icon: CheckCircle2 },
  out: { variant: 'danger', Icon: CircleOff },
  hidden: { variant: 'neutral', Icon: EyeOff },
};

export function productStatusMeta(status: string): ProductStatusMeta {
  const key: ProductStatus = status in PRODUCT_STATUS_STYLE ? (status as ProductStatus) : 'hidden';
  const m = t().productStatus;
  return { label: m.label[key], segmentLabel: m.segment[key], ...PRODUCT_STATUS_STYLE[key] };
}

/**
 * Zaxira soni uchun rang va yozuv birga: rang yolg'iz ma'no tashimaydi.
 * Chegara (`threshold`) — do'konning `lowStockThreshold` sozlamasi.
 */
export function stockTone(
  stock: number,
  threshold: number
): { text: string; label: string; level: 'out' | 'low' | 'ok' } {
  const m = t().productStatus;
  if (stock === 0)
    return { text: 'text-danger-deep dark:text-danger-light', label: m.stockOut, level: 'out' };
  if (stock <= threshold)
    // Amber EMAS: u faqat qo'lda aralashuv uchun (PANEL-UI-KIT §5).
    // Kam qolgan — qalin ink + yozuv; qizil faqat haqiqatan tugaganda.
    return { text: 'text-ink font-semibold', label: m.stockLow, level: 'low' };
  return { text: 'text-ink', label: m.stockOk, level: 'ok' };
}
