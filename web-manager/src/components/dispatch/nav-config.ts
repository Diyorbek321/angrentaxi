import {
  AlertTriangle,
  ClipboardList,
  DollarSign,
  Gift,
  LayoutDashboard,
  MessageCircle,
  PackageSearch,
  PlusCircle,
  Radar,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Ticket,
  Timer,
  Users,
} from 'lucide-react';
import type { NavGroup } from '@/components/shell';

export const EXCEPTIONS_HREF = '/dispatch/exceptions';

/**
 * Dispatcher navigation. `permission` is the RBAC permission required to see
 * the item (backend Permission enum); `null` = always visible (Overview and
 * Shift Report are basic visibility every manager has). ADMIN bypasses the
 * filter (see DispatchShell); MANAGER accounts only see what web-admin's
 * Staff & Roles screen granted. Labels are kept short enough for one line.
 */
export const DISPATCH_NAV: readonly NavGroup[] = [
  {
    title: 'Operatsiya',
    items: [
      { href: '/dispatch/overview', label: 'Umumiy koʻrinish', icon: LayoutDashboard, permission: null },
      { href: '/dispatch', label: 'Jonli dispetcher', icon: Radar, permission: 'dispatch', exact: true },
      { href: EXCEPTIONS_HREF, label: 'Istisnolar', icon: AlertTriangle, permission: 'dispatch' },
      { href: '/orders', label: 'Buyurtmalar', icon: ClipboardList, permission: 'dispatch' },
      { href: '/create-order', label: 'Buyurtma yaratish', icon: PlusCircle, permission: 'dispatch' },
    ],
  },
  {
    title: 'Jamoa',
    items: [
      { href: '/dispatch/drivers', label: 'Haydovchilar', icon: Users, permission: 'drivers_view' },
      { href: '/dispatch/verification', label: 'Koʻrik va selfi', icon: ShieldCheck, permission: 'drivers_view' },
      { href: '/dispatch/fraud', label: 'Shubhali safarlar', icon: ShieldAlert, permission: 'drivers_view' },
      { href: '/dispatch/audit-log', label: 'Amallar tarixi', icon: ScrollText, permission: 'dispatch' },
      { href: '/dispatch/shift-report', label: 'Smena hisoboti', icon: Timer, permission: null },
    ],
  },
  {
    title: 'Moliya',
    items: [
      { href: '/dispatch/finance', label: 'Moliya', icon: DollarSign, permission: 'withdrawals_view' },
      { href: '/dispatch/tariffs', label: 'Tariflar', icon: Tag, permission: 'tariffs_manage' },
      { href: '/dispatch/promo-codes', label: 'Promo kodlar', icon: Ticket, permission: 'promo_manage' },
      { href: '/dispatch/bonuses', label: 'Bonuslar', icon: Gift, permission: 'bonuses_view' },
    ],
  },
  {
    title: 'Mijozlar',
    items: [
      { href: '/dispatch/support', label: 'Qoʻllab-quvvatlash', icon: MessageCircle, permission: 'support_manage' },
      { href: '/dispatch/lost-items', label: 'Yoʻqolgan buyumlar', icon: PackageSearch, permission: 'support_manage' },
    ],
  },
];
