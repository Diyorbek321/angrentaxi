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
import { fullName } from './format';
import { t } from '@/locales';

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

/** Rang va ikonka — tilga bog'liq emas. Yozuvlar `orderStatusMeta` da, joriy tilda. */
const ORDER_STATUS_STYLE: Record<MarketOrderStatus, Pick<OrderStatusMeta, 'variant' | 'Icon'>> = {
  new: { variant: 'info', Icon: BellRing },
  packing: { variant: 'violet', Icon: PackageOpen },
  shipped: { variant: 'neutral', Icon: Truck },
  delivered: { variant: 'success', Icon: PackageCheck },
  cancelled: { variant: 'muted-danger', Icon: XCircle },
};

export function orderStatusMeta(status: string): OrderStatusMeta {
  const key: MarketOrderStatus = status in ORDER_STATUS_STYLE ? (status as MarketOrderStatus) : 'new';
  const m = t().orderStatus;
  return { label: m.label[key], hint: m.hint[key], ...ORDER_STATUS_STYLE[key] };
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
export function advanceLabel(status: MarketOrderStatus): string | undefined {
  return t().orderStatus.advance[status];
}

/** Yakuniy holatlar uchun passiv yozuv (tugma chiqmaydi). */
export function terminalLabel(status: MarketOrderStatus): string | undefined {
  return t().orderStatus.terminal[status];
}

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
export function deliveryModeLabel(mode: DeliveryMode): string {
  return t().orderStatus.deliveryMode[mode];
}

/** Mijoz nomi — ism bo'lmasa telefon, u ham bo'lmasa neytral yozuv. */
export function orderCustomerName(o: MarketOrder): string {
  const name = fullName(o.customer?.firstName, o.customer?.lastName, '');
  return name || o.customer?.phone || o.customerPhone || t().orderStatus.customerFallback;
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
  return advanceLabel(order.status);
}
