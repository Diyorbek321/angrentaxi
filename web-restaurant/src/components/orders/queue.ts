import type { FoodOrder, FoodOrderStatus } from '@/lib/api';

/**
 * Navbat OSHXONA HOLATI bo'yicha (Uber Eats naqshi): Yangi / Tayyorlanmoqda /
 * Tayyor — mavjud statuslarga 1:1. Yetkazilgan va bekor qilinganlar bitta
 * "Yakunlangan" jurnalida.
 */
export type QueueTab = 'new' | 'preparing' | 'ready' | 'done';

export const TAB_ORDER: ReadonlyArray<QueueTab> = ['new', 'preparing', 'ready', 'done'];

export const TAB_LABEL: Record<QueueTab, string> = {
  new: 'Yangi',
  preparing: 'Tayyorlanmoqda',
  ready: 'Tayyor',
  done: 'Yakunlangan',
};

export const REJECT_REASONS = [
  'Ingredientlar tugagan',
  'Oshxona band',
  'Ish vaqti tugadi',
  'Manzil yetkazib berish zonasidan tashqarida',
  'Boshqa sabab',
] as const;

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
