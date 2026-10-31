import { BadgePercent, BarChart3, ClipboardList, LayoutGrid, Settings, Tags, UtensilsCrossed } from 'lucide-react';
import type { NavGroup } from '@/components/shell';
import { t } from '@/locales';

export const ORDERS_HREF = '/dashboard/orders';

/**
 * Restoran navigatsiyasi domen bo'yicha: Operatsiyalar — kunlik ish,
 * Katalog — menyu, Boshqaruv — hisobot va sozlamalar. RBAC yo'q — vendor
 * hamma bo'limni ko'radi. Yozuvlar faol tilda — render paytida chaqiring.
 */
export function restaurantNav(): NavGroup[] {
  const m = t().shell.nav;
  return [
    {
      title: m.operations,
      items: [
        { href: '/dashboard', label: m.home, icon: LayoutGrid, exact: true },
        { href: ORDERS_HREF, label: m.orders, icon: ClipboardList },
      ],
    },
    {
      title: m.catalog,
      items: [
        { href: '/dashboard/menu', label: m.menu, icon: UtensilsCrossed },
        { href: '/dashboard/categories', label: m.categories, icon: Tags },
        { href: '/dashboard/promotions', label: m.promotions, icon: BadgePercent },
      ],
    },
    {
      title: m.management,
      items: [
        { href: '/dashboard/reports', label: m.reports, icon: BarChart3 },
        { href: '/dashboard/settings', label: m.settings, icon: Settings },
      ],
    },
  ];
}
