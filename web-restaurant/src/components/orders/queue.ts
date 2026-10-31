import type { FoodOrder, FoodOrderStatus } from '@/lib/api';
import { t } from '@/locales';
import { uz } from '@/locales/uz';

/**
 * Navbat OSHXONA HOLATI bo'yicha (Uber Eats naqshi): Yangi / Tayyorlanmoqda /
 * Tayyor — mavjud statuslarga 1:1. Yetkazilgan va bekor qilinganlar bitta
 * "Yakunlangan" jurnalida.
 */
export type QueueTab = 'new' | 'preparing' | 'ready' | 'done';

export const TAB_ORDER: ReadonlyArray<QueueTab> = ['new', 'preparing', 'ready', 'done'];

/** Tab yozuvi faol tilda — render paytida chaqiriladi. */
export function tabLabel(tab: QueueTab): string {
  return t().orders.tabs[tab];
}

export type RejectReasonKey = keyof typeof uz.orders.rejectReasons;

export const REJECT_REASON_KEYS: ReadonlyArray<RejectReasonKey> = [
  'ingredients',
  'kitchenBusy',
  'closingTime',
  'outOfZone',
  'other',
];

/**
 * API'ga (va mijozga) yuboriladigan matn — panel tilidan qat'i nazar DOIM
 * o'zbekcha: mijoz ilovasi o'zbekcha va backend matnni o'zgartirmaydi.
 */
export function rejectReasonValue(key: RejectReasonKey): string {
  return uz.orders.rejectReasons[key];
}

/** Ekranda ko'rsatiladigan yozuv (faol til). */
export function rejectReasonLabel(key: RejectReasonKey): string {
  return t().orders.rejectReasons[key];
}

/** Yuborilgan o'zbekcha matn → faol tildagi yozuv (toast uchun); tanilmasa — o'zi. */
export function rejectReasonDisplay(value: string): string {
  const key = REJECT_REASON_KEYS.find((k) => rejectReasonValue(k) === value);
  return key ? rejectReasonLabel(key) : value;
}

export function tabOf(status: FoodOrderStatus): QueueTab {
  if (status === 'new' || status === 'preparing' || status === 'ready') return status;
  return 'done';
}

const byOldestFirst = (a: FoodOrder, b: FoodOrder) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/**
 * Oshxona tablarida ENG ESKISI birinchi — e'tiborsiz qolgan eng qadimgi
 * buyurtma favqulodda holat. Jurnal (Yakunlangan) esa yangisi birinchi.
 */
export function groupOrders(orders: readonly FoodOrder[]): Record<QueueTab, FoodOrder[]> {
  const map: Record<QueueTab, FoodOrder[]> = { new: [], preparing: [], ready: [], done: [] };
  orders.forEach((o) => map[tabOf(o.status)].push(o));
  map.new.sort(byOldestFirst);
  map.preparing.sort(byOldestFirst);
  map.ready.sort(byOldestFirst);
  map.done.sort((a, b) => byOldestFirst(b, a));
  return map;
}
