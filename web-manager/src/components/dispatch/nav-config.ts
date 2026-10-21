import {
  AlertTriangle,
  ClipboardList,
  DollarSign,
  Gift,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  PackageSearch,
  PlusCircle,
  Radar,
  Route,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Ticket,
  Timer,
  Users,
} from 'lucide-react';
import type { NavGroup } from '@/components/shell';
import { t } from '@/locales';

export const EXCEPTIONS_HREF = '/dispatch/exceptions';

/**
 * Dispatcher navigation. `permission` is the RBAC permission required to see
 * the item (backend Permission enum); `null` = always visible (Overview and
 * Shift Report are basic visibility every manager has). ADMIN bypasses the
 * filter (see DispatchShell); MANAGER accounts only see what web-admin's
 * Staff & Roles screen granted. Labels are kept short enough for one line.
 */
export function dispatchNav(): readonly NavGroup[] {
  const m = t().dispatch.nav;
  return [
  {
    title: m.operations,
    items: [
      { href: '/dispatch/overview', label: m.overview, icon: LayoutDashboard, permission: null },
      { href: '/dispatch', label: m.live, icon: Radar, permission: 'dispatch', exact: true },
      { href: EXCEPTIONS_HREF, label: m.exceptions, icon: AlertTriangle, permission: 'dispatch' },
      { href: '/orders', label: m.orders, icon: ClipboardList, permission: 'dispatch' },
      { href: '/create-order', label: m.createOrder, icon: PlusCircle, permission: 'dispatch' },
      // `exact`: aks holda so'rovlar sahifasida ikkala band ham yonib turardi.
      { href: '/dispatch/intercity', label: m.intercity, icon: Route, permission: 'dispatch', exact: true },
      { href: '/dispatch/intercity/requests', label: m.intercityRequests, icon: Megaphone, permission: 'dispatch' },
    ],
  },
  {
    title: m.team,
    items: [
      { href: '/dispatch/drivers', label: m.drivers, icon: Users, permission: 'drivers_view' },
      { href: '/dispatch/verification', label: m.verification, icon: ShieldCheck, permission: 'drivers_view' },
      { href: '/dispatch/fraud', label: m.fraud, icon: ShieldAlert, permission: 'drivers_view' },
      { href: '/dispatch/audit-log', label: m.auditLog, icon: ScrollText, permission: 'dispatch' },
      { href: '/dispatch/shift-report', label: m.shiftReport, icon: Timer, permission: null },
    ],
  },
  {
    title: m.financeGroup,
    items: [
      { href: '/dispatch/finance', label: m.finance, icon: DollarSign, permission: 'withdrawals_view' },
      { href: '/dispatch/tariffs', label: m.tariffs, icon: Tag, permission: 'tariffs_manage' },
      { href: '/dispatch/promo-codes', label: m.promoCodes, icon: Ticket, permission: 'promo_manage' },
      { href: '/dispatch/bonuses', label: m.bonuses, icon: Gift, permission: 'bonuses_view' },
    ],
  },
  {
    title: m.customers,
    items: [
      { href: '/dispatch/support', label: m.support, icon: MessageCircle, permission: 'support_manage' },
      { href: '/dispatch/lost-items', label: m.lostItems, icon: PackageSearch, permission: 'support_manage' },
    ],
  },
  ];
}
