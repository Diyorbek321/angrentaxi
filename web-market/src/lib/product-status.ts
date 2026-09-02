import { CheckCircle2, CircleOff, EyeOff, type LucideIcon } from 'lucide-react';
import type { ProductStatus } from './api';
import type { BadgeVariant } from '@/components/ui/Badge';

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

export const PRODUCT_STATUS: Record<ProductStatus, ProductStatusMeta> = {
  active: {
    label: 'Faol',
    segmentLabel: 'Sotuvda',
    variant: 'success',
    Icon: CheckCircle2,
  },
  out: {
    label: 'Tugagan',
    segmentLabel: 'Tugagan',
    variant: 'danger',
    Icon: CircleOff,
  },
  hidden: {
    label: 'Yashirilgan',
    segmentLabel: 'Yashirilgan',
    variant: 'default',
    Icon: EyeOff,
  },
};

export function productStatusMeta(status: string): ProductStatusMeta {
  return PRODUCT_STATUS[status as ProductStatus] ?? PRODUCT_STATUS.hidden;
}

/**
 * Zaxira soni uchun rang va yozuv birga: rang yolg'iz ma'no tashimaydi.
 * Chegara (`threshold`) — do'konning `lowStockThreshold` sozlamasi.
 */
export function stockTone(
  stock: number,
  threshold: number
): { text: string; label: string; level: 'out' | 'low' | 'ok' } {
  if (stock === 0)
    return { text: 'text-danger-deep dark:text-danger-light', label: 'Tugagan', level: 'out' };
  if (stock <= threshold)
    return {
      text: 'text-override-dark dark:text-override-light',
      label: 'Kam qolgan',
      level: 'low',
    };
  return { text: 'text-ink', label: 'Yetarli', level: 'ok' };
}
