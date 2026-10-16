import {
  BadgePercent,
  BarChart2,
  Bell,
  Car,
  ClipboardList,
  FileCheck2,
  Gift,
  History,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Receipt,
  Route,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tag,
  Ticket,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';
import type { NavGroup } from '@/components/shell';

export const DRIVERS_HREF = '/dashboard/drivers';
export const PENDING_DRIVERS_HREF = '/dashboard/drivers?status=pending';
export const WITHDRAWALS_HREF = '/dashboard/withdrawals';

/**
 * Super-admin navigation, grouped by domain. Priority order: daily work
 * (Taxi, Market) on top, rarely opened "Tizim" last. Labels are short enough
 * to never wrap at 240px. The admin role sees everything, so no item is
 * permission-gated here (the backend still authorises every request).
 */
export const ADMIN_NAV: readonly NavGroup[] = [
  {
    items: [{ href: '/dashboard', label: 'Bosh sahifa', icon: LayoutDashboard, exact: true }],
  },
  {
    title: 'Taxi va yuk',
    items: [
      { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
      { href: DRIVERS_HREF, label: 'Haydovchilar', icon: Car },
      { href: '/dashboard/driver-documents', label: 'Hujjatlar', icon: FileCheck2 },
      { href: '/dashboard/tariffs', label: 'Tariflar', icon: Tag },
      { href: '/dashboard/intercity', label: 'Shaharlararo', icon: Route },
    ],
  },
  {
    title: 'Market va Eats',
    items: [
      { href: '/dashboard/vendors', label: 'Sotuvchilar', icon: Store },
      { href: '/dashboard/moderation', label: 'Moderatsiya', icon: ShieldAlert },
    ],
  },
  {
    title: 'Mijozlar',
    items: [{ href: '/dashboard/users', label: 'Foydalanuvchilar', icon: Users }],
  },
  {
    title: 'Moliya',
    items: [
      { href: WITHDRAWALS_HREF, label: 'Pul yechish', icon: Wallet },
      { href: '/dashboard/shift-passes', label: 'Smenalar', icon: Timer },
      { href: '/dashboard/tax-report', label: 'Soliq (1%) hisoboti', icon: Landmark },
      { href: '/dashboard/fiscal-receipts', label: 'Fiskal cheklar', icon: Receipt },
      { href: '/dashboard/finance-settings', label: 'Moliya sozlamalari', icon: BadgePercent },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { href: '/dashboard/ads', label: 'Reklama', icon: Megaphone },
      { href: '/dashboard/promo-codes', label: 'Promo kodlar', icon: Ticket },
      { href: '/dashboard/bonuses', label: 'Bonuslar', icon: Gift },
      { href: '/dashboard/push-notifications', label: 'Push xabarlar', icon: Bell },
    ],
  },
  {
    title: 'Tizim',
    items: [
      { href: '/dashboard/staff', label: 'Xodimlar', icon: ShieldCheck },
      { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart2 },
      { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
      { href: '/dashboard/global-settings', label: 'Umumiy sozlamalar', icon: SlidersHorizontal },
      { href: '/dashboard/legal-compliance', label: 'Huquqiy talablar', icon: Scale },
      { href: '/dashboard/audit-log', label: 'Amallar jurnali', icon: History },
    ],
  },
];
