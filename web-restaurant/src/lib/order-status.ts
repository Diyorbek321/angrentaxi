import { BellRing, CheckCircle2, ChefHat, PackageCheck, XCircle, type LucideIcon } from 'lucide-react';
import type { FoodOrderStatus } from './api';
import type { BadgeVariant } from '@/components/ui/Badge';
import { t } from '@/locales';

/**
 * Buyurtma holati YANGI rang kiritmaydi — mavjud semantik tokenlarga
 * bog'lanadi (DESIGN-TOKENS 3.3). Har bir holat rangdan tashqari IKONKA va
 * YOZUV bilan ham beriladi: ma'no yolg'iz rangga tayanmasligi kerak
 * (WCAG 1.4.1).
 */
export interface OrderStatusMeta {
  label: string;
  /** Qisqa izoh — oshxona xodimi uchun "keyin nima bo'ladi". */
  hint: string;
  variant: BadgeVariant;
  Icon: LucideIcon;
}

const STATUS_STYLE: Record<FoodOrderStatus, Pick<OrderStatusMeta, 'variant' | 'Icon'>> = {
  new: { variant: 'info', Icon: BellRing },
  // `warning` faqat qo'lda aralashuv uchun (PANEL-UI-KIT §5) — bu yerda emas.
  preparing: { variant: 'violet', Icon: ChefHat },
  ready: { variant: 'success', Icon: CheckCircle2 },
  delivered: { variant: 'neutral', Icon: PackageCheck },
  cancelled: { variant: 'muted-danger', Icon: XCircle },
};

/** Yozuv va izoh faol tilda — render paytida chaqiriladi. */
export function statusMeta(status: string): OrderStatusMeta {
  const key: FoodOrderStatus = Object.prototype.hasOwnProperty.call(STATUS_STYLE, status) ? (status as FoodOrderStatus) : 'new';
  return { ...t().orderStatus[key], ...STATUS_STYLE[key] };
}

/** Oshxona oqimidagi keyingi bosqich. `undefined` — oxirgi bosqich. */
export const NEXT_STATUS: Partial<Record<FoodOrderStatus, FoodOrderStatus>> = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};

function advanceLabel(status: FoodOrderStatus): string | undefined {
  const labels = t().advance;
  return status === 'new' || status === 'preparing' || status === 'ready' ? labels[status] : undefined;
}

/**
 * Sotuvchi buyurtmani keyingi bosqichga o'tkaza oladimi — va qaysi yozuv
 * bilan. Platforma kuryeri chaqirilgan buyurtmani "yetkazildi" qilishni
 * faqat kuryer (yoki dispetcher) qiladi: backend buni rad etadi, shuning
 * uchun tugma umuman ko'rsatilmaydi — kuryer topilmagan bo'lsa ham.
 */
export function advanceLabelFor(order: {
  status: FoodOrderStatus;
  deliveryOrderId?: string | null;
}): string | undefined {
  if (NEXT_STATUS[order.status] === 'delivered' && order.deliveryOrderId) return undefined;
  return advanceLabel(order.status);
}
