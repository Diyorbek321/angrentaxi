import {
  BellRing,
  CheckCircle2,
  PackageCheck,
  PackageOpen,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { DeliveryMode, MarketOrder, MarketOrderStatus } from './api';
import type { BadgeVariant } from '@/components/ui/Badge';

/**
 * Buyurtma holati YANGI rang kiritmaydi — mavjud semantik tokenlarga
 * bog'lanadi (DESIGN-TOKENS 3.3). Har bir holat rangdan tashqari IKONKA va
 * YOZUV bilan ham beriladi: ma'no yolg'iz rangga tayanmasligi kerak
 * (WCAG 1.4.1). Amber bu ro'yxatda YO'Q — u faqat ogohlantirish uchun.
 */
export interface OrderStatusMeta {
  label: string;
  /** Qisqa izoh — sotuvchi uchun "keyin nima bo'ladi". */
  hint: string;
  variant: BadgeVariant;
  Icon: LucideIcon;
}

export const ORDER_STATUS: Record<MarketOrderStatus, OrderStatusMeta> = {
  new: {
    label: 'Yangi',
    hint: "Yig'ish kutilmoqda",
    variant: 'info',
    Icon: BellRing,
  },
  packing: {
    label: "Yig'ilmoqda",
    hint: 'Mahsulotlar yig‘ilyapti',
    variant: 'violet',
    Icon: PackageOpen,
  },
  shipped: {
    label: 'Yuborildi',
    hint: "Yo'lda",
    variant: 'primary',
    Icon: Truck,
  },
  delivered: {
    label: 'Yetkazildi',
    hint: 'Yakunlangan',
    variant: 'success',
    Icon: PackageCheck,
  },
  cancelled: {
    label: 'Bekor qilindi',
    hint: 'Rad etilgan',
    variant: 'danger',
    Icon: XCircle,
  },
};

export function orderStatusMeta(status: string): OrderStatusMeta {
  return ORDER_STATUS[status as MarketOrderStatus] ?? ORDER_STATUS.new;
}

/**
 * Holat zinapoyasi — faqat ketma-ket oldinga (`advanceOrder`), sakrash yo'q.
 * `undefined` — yakuniy bosqich.
 */
export const NEXT_STATUS: Partial<Record<MarketOrderStatus, MarketOrderStatus>> = {
  new: 'packing',
  packing: 'shipped',
  shipped: 'delivered',
};

/** Keyingi bosqichga o'tkazadigan YAGONA tugmaning yozuvi. */
export const ADVANCE_LABEL: Partial<Record<MarketOrderStatus, string>> = {
  new: "Yig'ishni boshlash",
  packing: 'Yuborildi deb belgilash',
  shipped: 'Yetkazildi deb belgilash',
};

/** Yakuniy holatlar uchun passiv yozuv (tugma chiqmaydi). */
export const TERMINAL_LABEL: Partial<Record<MarketOrderStatus, string>> = {
  delivered: 'Buyurtma yakunlangan',
  cancelled: 'Buyurtma bekor qilingan',
};

/**
 * Navbatning standart tartibi: eng shoshilinch tepada. Yangi buyurtmalar
 * birinchi, ular ichida ENG ESKISI eng tepada — javobsiz qolgan eng eski
 * buyurtma navbatdagi favqulodda holat. Yakunlanganlar esa yangisidan
 * eskisiga qarab.
 */
const STATUS_PRIORITY: Record<MarketOrderStatus, number> = {
  new: 0,
  packing: 1,
  shipped: 2,
  delivered: 3,
  cancelled: 4,
};

export function compareOrders(a: MarketOrder, b: MarketOrder): number {
  const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
  if (byStatus !== 0) return byStatus;
  const at = new Date(a.createdAt).getTime();
  const bt = new Date(b.createdAt).getTime();
  // Faol holatlar: eskisi tepada. Yakuniylar: yangisi tepada.
  return STATUS_PRIORITY[a.status] <= 2 ? at - bt : bt - at;
}

/**
 * Yetkazish rejimi — do'konning haqiqiy sozlamasi (`deliveryMode`).
 * Buyurtma kartasida aniq yozuv bo'lib turadi: "kim yetkazadi" savoli
 * har bir buyurtmada hal qiluvchi.
 */
export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  self: "Do'kon yetkazadi",
  platform: 'Platforma kuryeri',
};

/** Mijoz nomi — ism bo'lmasa telefon, u ham bo'lmasa neytral yozuv. */
export function orderCustomerName(o: MarketOrder): string {
  const name = [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ').trim();
  return name || o.customer?.phone || o.customerPhone || 'Mijoz';
}

export function orderCustomerPhone(o: MarketOrder): string | null {
  return o.customerPhone || o.customer?.phone || null;
}

/**
 * Sotuvchi buyurtmani keyingi bosqichga o'tkaza oladimi — va qaysi yozuv
 * bilan. Platforma kuryeri chaqirilgan buyurtmani "yetkazildi" qilishni
 * faqat kuryer (yoki dispetcher) qiladi: backend buni rad etadi, shuning
 * uchun tugma umuman ko'rsatilmaydi — kuryer topilmagan bo'lsa ham.
 */
export function advanceLabelFor(order: {
  status: MarketOrderStatus;
  deliveryOrderId?: string | null;
}): string | undefined {
  if (NEXT_STATUS[order.status] === 'delivered' && order.deliveryOrderId) return undefined;
  return ADVANCE_LABEL[order.status];
}
