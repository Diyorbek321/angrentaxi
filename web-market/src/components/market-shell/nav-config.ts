import { BadgePercent, BarChart3, Boxes, ClipboardList, LayoutGrid, Package, Settings, Tags } from 'lucide-react';
import type { NavGroup } from '@/components/shell';

export const ORDERS_HREF = '/dashboard/orders';
export const STOCK_HREF = '/dashboard/stock';

/**
 * Sotuvchi navigatsiyasi. RBAC yo'q — sotuvchi o'z do'konining hamma
 * bo'limini ko'radi. Tempo bo'yicha guruhlangan: "Savdo" (soniyalar —
 * buyurtma navbati), "Katalog" (soatlar), "Do'kon" (kamdan-kam).
 */
export const MARKET_NAV: readonly NavGroup[] = [
  {
    title: 'Savdo',
    items: [
      { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid, exact: true },
      { href: ORDERS_HREF, label: 'Buyurtmalar', icon: ClipboardList },
    ],
  },
  {
    title: 'Katalog',
    items: [
      { href: '/dashboard/products', label: 'Mahsulotlar', icon: Package },
      { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
      { href: '/dashboard/promotions', label: 'Chegirmalar', icon: BadgePercent },
      { href: STOCK_HREF, label: 'Zaxira', icon: Boxes },
    ],
  },
  {
    title: "Do'kon",
    items: [
      { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
      { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
    ],
  },
];
