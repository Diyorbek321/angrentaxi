import {
  BadgePercent,
  BarChart2,
  Bell,
  Filter,
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
import { t } from '@/locales';

export const DRIVERS_HREF = '/dashboard/drivers';
export const PENDING_DRIVERS_HREF = '/dashboard/drivers?status=pending';
export const WITHDRAWALS_HREF = '/dashboard/withdrawals';

/**
 * Super-admin navigation, grouped by domain. Priority order: daily work
 * (Taxi, Market) on top, rarely opened "Tizim" last. A function, not a
 * constant: labels must resolve in the active locale at render time. Labels are short enough
 * to never wrap at 240px. The admin role sees everything, so no item is
 * permission-gated here (the backend still authorises every request).
 */
export function adminNav(): readonly NavGroup[] {
  const n = t().shell.nav;
  return [
    {
      items: [{ href: '/dashboard', label: n.home, icon: LayoutDashboard, exact: true }],
    },
    {
      title: n.groupTaxi,
      items: [
        { href: '/dashboard/orders', label: n.orders, icon: ClipboardList },
        { href: DRIVERS_HREF, label: n.drivers, icon: Car },
        { href: '/dashboard/driver-documents', label: n.documents, icon: FileCheck2 },
        { href: '/dashboard/tariffs', label: n.tariffs, icon: Tag },
        { href: '/dashboard/intercity', label: n.intercity, icon: Route },
      ],
    },
    {
      title: n.groupMarket,
      items: [
        { href: '/dashboard/vendors', label: n.vendors, icon: Store },
        { href: '/dashboard/moderation', label: n.moderation, icon: ShieldAlert },
      ],
    },
    {
      title: n.groupCustomers,
      items: [{ href: '/dashboard/users', label: n.users, icon: Users }],
    },
    {
      title: n.groupFinance,
      items: [
        { href: WITHDRAWALS_HREF, label: n.withdrawals, icon: Wallet },
        { href: '/dashboard/shift-passes', label: n.shiftPasses, icon: Timer },
        { href: '/dashboard/tax-report', label: n.taxReport, icon: Landmark },
        { href: '/dashboard/fiscal-receipts', label: n.fiscalReceipts, icon: Receipt },
        { href: '/dashboard/finance-settings', label: n.financeSettings, icon: BadgePercent },
      ],
    },
    {
      title: n.groupMarketing,
      items: [
        { href: '/dashboard/ads', label: n.ads, icon: Megaphone },
        { href: '/dashboard/promo-codes', label: n.promoCodes, icon: Ticket },
        { href: '/dashboard/bonuses', label: n.bonuses, icon: Gift },
        { href: '/dashboard/push-notifications', label: n.push, icon: Bell },
      ],
    },
    {
      title: n.groupSystem,
      items: [
        { href: '/dashboard/staff', label: n.staff, icon: ShieldCheck },
        { href: '/dashboard/reports', label: n.reports, icon: BarChart2 },
        { href: '/dashboard/funnel', label: n.funnel, icon: Filter },
        { href: '/dashboard/settings', label: n.settings, icon: Settings },
        { href: '/dashboard/global-settings', label: n.globalSettings, icon: SlidersHorizontal },
        { href: '/dashboard/legal-compliance', label: n.legal, icon: Scale },
        { href: '/dashboard/audit-log', label: n.auditLog, icon: History },
      ],
    },
  ];
}
