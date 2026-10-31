import { BadgePercent, BarChart3, Boxes, ClipboardList, LayoutGrid, Package, Settings, Tags } from 'lucide-react';
import type { NavGroup } from '@/components/shell';
import { t } from '@/locales';

export const ORDERS_HREF = '/dashboard/orders';
export const STOCK_HREF = '/dashboard/stock';

/**
 * Sotuvchi navigatsiyasi. RBAC yo'q — sotuvchi o'z do'konining hamma
 * bo'limini ko'radi. Tempo bo'yicha guruhlangan: "Savdo" (soniyalar —
 * buyurtma navbati), "Katalog" (soatlar), "Do'kon" (kamdan-kam).
 */
export function marketNav(): NavGroup[] {
  const m = t().nav;
  return [
    {
      title: m.sales,
      items: [
        { href: '/dashboard', label: m.home, icon: LayoutGrid, exact: true },
        { href: ORDERS_HREF, label: m.orders, icon: ClipboardList },
      ],
    },
    {
      title: m.catalog,
      items: [
        { href: '/dashboard/products', label: m.products, icon: Package },
        { href: '/dashboard/categories', label: m.categories, icon: Tags },
        { href: '/dashboard/promotions', label: m.promotions, icon: BadgePercent },
        { href: STOCK_HREF, label: m.stock, icon: Boxes },
      ],
    },
    {
      title: m.store,
      items: [
        { href: '/dashboard/reports', label: m.reports, icon: BarChart3 },
        { href: '/dashboard/settings', label: m.settings, icon: Settings },
      ],
    },
  ];
}
