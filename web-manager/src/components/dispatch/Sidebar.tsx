'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Car,
  ChevronLeft,
  ClipboardList,
  DollarSign,
  Gift,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  PlusCircle,
  Radar,
  ScrollText,
  Tag,
  Timer,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** RBAC permission required to see this item; `null` = always visible. */
  perm: string | null;
}

export interface NavGroup {
  /** Section caption; hidden entirely when every item is filtered out. */
  title: string;
  links: readonly NavLink[];
}

// `perm` is the RBAC permission required to see this item — see the backend
// Permission enum. `null` means always visible (no gate) — used for Overview
// and Shift Report, which are basic business visibility every manager should
// have regardless of finer permissions. ADMIN bypasses this filter entirely
// (see DispatchShell); MANAGER accounts only see gated items they've been
// granted from web-admin's Staff & Roles screen.
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: 'Operatsiya',
    links: [
      { href: '/dispatch/overview', label: 'Umumiy koʻrinish', icon: LayoutDashboard, perm: null },
      { href: '/dispatch', label: 'Jonli dispetcher', icon: Radar, perm: 'dispatch' },
      { href: '/dispatch/exceptions', label: 'Istisnolar', icon: AlertTriangle, perm: 'dispatch' },
      { href: '/orders', label: 'Buyurtmalar', icon: ClipboardList, perm: 'dispatch' },
      { href: '/create-order', label: 'Buyurtma yaratish', icon: PlusCircle, perm: 'dispatch' },
    ],
  },
  {
    title: 'Jamoa',
    links: [
      { href: '/dispatch/drivers', label: 'Haydovchilar', icon: Users, perm: 'drivers_view' },
      { href: '/dispatch/audit-log', label: 'Amallar tarixi', icon: ScrollText, perm: 'dispatch' },
      { href: '/dispatch/shift-report', label: 'Smena hisoboti', icon: Timer, perm: null },
    ],
  },
  {
    title: 'Moliya',
    links: [
      { href: '/dispatch/finance', label: 'Moliya', icon: DollarSign, perm: 'withdrawals_view' },
      { href: '/dispatch/tariffs', label: 'Tariflar', icon: Tag, perm: 'tariffs_manage' },
      { href: '/dispatch/promo-codes', label: 'Promo kodlar', icon: Tag, perm: 'promo_manage' },
      { href: '/dispatch/bonuses', label: 'Bonuslar', icon: Gift, perm: 'bonuses_view' },
    ],
  },
  {
    title: 'Mijozlar',
    links: [
      {
        href: '/dispatch/support',
        label: 'Qoʻllab-quvvatlash',
        icon: MessageCircle,
        perm: 'support_manage',
      },
    ],
  },
] as const;

/** `/dispatch` is a prefix of every dispatch route, so it only matches exactly. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dispatch') return pathname === '/dispatch';
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Live count rendered next to Exceptions; red + pulsing when above zero. */
  exceptionsCount: number;
  /** Mobile/tablet drawer state — the sidebar overlays instead of pushing. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  groups,
  pathname,
  collapsed,
  onToggleCollapsed,
  exceptionsCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#04140F]/50 lg:hidden animate-fade-in"
          onClick={onCloseMobile}
          role="presentation"
        />
      )}

      <aside
        className={clsx(
          'z-40 shrink-0 bg-surface border-r border-line flex flex-col transition-[width] duration-200',
          'fixed inset-y-0 left-0 lg:static lg:translate-x-0',
          collapsed ? 'w-[4.5rem]' : 'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div
          className={clsx(
            'h-14 flex items-center gap-2.5 border-b border-line shrink-0',
            collapsed ? 'justify-center px-2' : 'px-4'
          )}
        >
          <Link href="/dispatch" className="flex items-center gap-2.5 min-w-0" onClick={onCloseMobile}>
            <span className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-glow-mint-sm">
              <Car size={16} className="text-[#04231A]" />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink leading-tight truncate">
                  Angren Taxi
                </span>
                <span className="block text-[11px] text-subtle leading-tight">Dispetcher</span>
              </span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {group.links.map(({ href, label, icon: Icon }) => {
                  const active = isActivePath(pathname, href);
                  const isExceptions = href === '/dispatch/exceptions';
                  const showCount = isExceptions && exceptionsCount > 0;

                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      onClick={onCloseMobile}
                      className={clsx(
                        'relative flex items-center gap-2.5 rounded-lg text-sm transition-colors',
                        collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2',
                        active
                          ? 'bg-primary/12 text-primary-700 dark:text-primary-300 font-semibold'
                          : 'text-muted hover:bg-surface-2 hover:text-ink'
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                      )}
                      <span className="relative shrink-0">
                        <Icon size={17} />
                        {showCount && collapsed && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-danger animate-pulse-ring" />
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{label}</span>}
                      {!collapsed && showCount && (
                        <span className="ml-auto shrink-0 min-w-[1.25rem] px-1.5 py-px rounded-full bg-danger text-white text-[11px] font-mono font-semibold text-center animate-pulse-ring">
                          {exceptionsCount > 99 ? '99+' : exceptionsCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle — desktop only; on smaller screens the sidebar is a drawer */}
        <div className="border-t border-line p-2 shrink-0 hidden lg:block">
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Panelni yoyish' : 'Panelni yigʻish'}
            className={clsx(
              'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted',
              'hover:bg-surface-2 hover:text-ink transition-colors',
              collapsed && 'justify-center px-2'
            )}
          >
            <ChevronLeft
              size={16}
              className={clsx('transition-transform', collapsed && 'rotate-180')}
            />
            {!collapsed && <span>Yigʻish</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
