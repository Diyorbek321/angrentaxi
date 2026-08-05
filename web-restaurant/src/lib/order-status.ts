import { BellRing, CheckCircle2, ChefHat, PackageCheck, XCircle, type LucideIcon } from 'lucide-react';
import type { FoodOrderStatus } from './api';
import type { BadgeVariant } from '@/components/ui/Badge';

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

export const ORDER_STATUS: Record<FoodOrderStatus, OrderStatusMeta> = {
  new: {
    label: 'Yangi',
    hint: 'Qabul qilish kutilmoqda',
    variant: 'info',
    Icon: BellRing,
  },
  preparing: {
    label: 'Tayyorlanmoqda',
    hint: 'Oshxonada',
    variant: 'warning',
    Icon: ChefHat,
  },
  ready: {
    label: 'Tayyor',
    hint: 'Kuryer kutilmoqda',
    variant: 'success',
    Icon: CheckCircle2,
  },
  delivered: {
    label: 'Yetkazildi',
    hint: 'Yakunlangan',
    variant: 'default',
    Icon: PackageCheck,
  },
  cancelled: {
    label: 'Bekor qilindi',
    hint: 'Rad etilgan',
    variant: 'danger',
    Icon: XCircle,
  },
};

export function statusMeta(status: string): OrderStatusMeta {
  return ORDER_STATUS[status as FoodOrderStatus] ?? ORDER_STATUS.new;
}

/** Oshxona oqimidagi keyingi bosqich. `undefined` — oxirgi bosqich. */
export const NEXT_STATUS: Partial<Record<FoodOrderStatus, FoodOrderStatus>> = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};

export const ADVANCE_LABEL: Partial<Record<FoodOrderStatus, string>> = {
  new: 'Qabul qilish',
  preparing: 'Tayyor deb belgilash',
  ready: 'Yetkazildi deb belgilash',
};
