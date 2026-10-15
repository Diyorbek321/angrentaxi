import { BarChart3, ClipboardList, LayoutGrid, Settings, Tags, UtensilsCrossed } from 'lucide-react';
import type { NavGroup } from '@/components/shell';

export const ORDERS_HREF = '/dashboard/orders';

/**
 * Restoran navigatsiyasi domen bo'yicha: Operatsiyalar — kunlik ish,
 * Katalog — menyu, Boshqaruv — hisobot va sozlamalar. RBAC yo'q — vendor
 * hamma bo'limni ko'radi.
 */
export const RESTAURANT_NAV: readonly NavGroup[] = [
  {
    title: 'Operatsiyalar',
    items: [
      { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid, exact: true },
      { href: ORDERS_HREF, label: 'Buyurtmalar', icon: ClipboardList },
    ],
  },
  {
    title: 'Katalog',
    items: [
      { href: '/dashboard/menu', label: 'Menyu', icon: UtensilsCrossed },
      { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
    ],
  },
  {
    title: 'Boshqaruv',
    items: [
      { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
      { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
    ],
  },
];
