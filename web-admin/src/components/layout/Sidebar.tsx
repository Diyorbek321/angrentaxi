'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardList,
  Tag,
  BarChart2,
  LogOut,
  Zap,
  Megaphone,
  Ticket,
  Gift,
  Settings,
  Store,
  Wallet,
  ShieldCheck,
  ChevronDown,
  Bell,
  ShieldAlert,
  FileCheck2,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/components/layout/SidebarContext';
import { Avatar } from '@/components/ui/Avatar';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

// Bitta yuqori darajali element + 6 ta yig'iladigan guruh. Guruhlar tartibi =
// ustuvorlik tartibi: kunlik ish (Taxi, Market) tepada, kam ochiladigan
// "Tizim" oxirida — ekran torayganda aynan past-ustuvorlar scroll ostiga
// tushadi, kunlik ish emas.
const overviewItem: NavItem = {
  href: '/dashboard',
  label: 'Bosh sahifa',
  icon: LayoutDashboard,
  exact: true,
};

const navGroups: NavGroup[] = [
  {
    key: 'taxi',
    label: 'Taxi va Yuk tashish',
    items: [
      { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
      { href: '/dashboard/drivers', label: 'Haydovchilar', icon: Car },
      { href: '/dashboard/driver-documents', label: 'Haydovchi hujjatlari', icon: FileCheck2 },
      { href: '/dashboard/tariffs', label: 'Tariflar', icon: Tag },
    ],
  },
  {
    key: 'marketplace',
    label: 'Market va Eats',
    items: [
      { href: '/dashboard/vendors', label: 'Sotuvchilar', icon: Store },
      { href: '/dashboard/moderation', label: 'Mahsulot/Menyu moderatsiyasi', icon: ShieldAlert },
    ],
  },
  {
    key: 'users',
    label: 'Foydalanuvchilar',
    items: [{ href: '/dashboard/users', label: 'Barcha foydalanuvchilar', icon: Users }],
  },
  {
    key: 'finance',
    label: 'Moliya',
    items: [{ href: '/dashboard/withdrawals', label: "Pul yechish so'rovlari", icon: Wallet }],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    items: [
      { href: '/dashboard/ads', label: 'Reklama', icon: Megaphone },
      { href: '/dashboard/promo-codes', label: 'Promo kodlar', icon: Ticket },
      { href: '/dashboard/bonuses', label: 'Bonuslar', icon: Gift },
      { href: '/dashboard/push-notifications', label: 'Push xabarnomalar', icon: Bell },
    ],
  },
  {
    key: 'system',
    label: 'Tizim',
    items: [
      { href: '/dashboard/staff', label: 'Xodimlar va ruxsatlar', icon: ShieldCheck },
      { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart2 },
      { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
      { href: '/dashboard/global-settings', label: 'Umumiy sozlamalar', icon: SlidersHorizontal },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebar();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Mobil overlay har doim to'liq kenglikda ochiladi; ikon-rail faqat
  // desktopda ma'noga ega.
  const rail = isCollapsed && !isOpen;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href, item.exact);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={close}
          // Faol sahifa `aria-current` bilan ham belgilanadi — ma'no faqat
          // rang va chegara orqali berilmaydi (fill + chap chiziq = 2 indikator).
          aria-current={active ? 'page' : undefined}
          aria-label={rail ? item.label : undefined}
          title={rail ? item.label : undefined}
          className={cn(
            'flex items-center rounded-ds-sm text-body font-medium transition-colors duration-fast',
            rail ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            active
              ? 'rounded-l-none border-l-2 border-primary bg-mint-tint font-semibold text-primary-text'
              : 'border-l-2 border-transparent text-muted hover:bg-surface-2 hover:text-ink'
          )}
        >
          <item.icon
            className={cn('h-4 w-4 shrink-0', active ? 'text-primary-text' : 'text-subtle')}
            aria-hidden="true"
          />
          {!rail && item.label}
        </Link>
      </li>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#04140F]/50 backdrop-blur-[2px] lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Asosiy navigatsiya"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-line bg-surface shadow-card',
          'transition-[width,transform] duration-base ease-emphasized',
          rail ? 'w-16' : 'w-64',
          'lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo — interaktiv emas, shuning uchun AKSENT qatlam (mint gradient
            + ink ikonka). Oq ikonka mint ustida 1.85:1 bo'lardi. */}
        <div className={cn('flex items-center py-6', rail ? 'justify-center px-0' : 'gap-3 px-5')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm bg-gradient-mint shadow-glow-mint-sm">
            <Zap className="h-5 w-5 text-mint-on" aria-hidden="true" />
          </div>
          {!rail && (
            <div>
              <p className="text-title text-ink">Angren Taxi</p>
              <p className="text-caption text-muted">Super Admin</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn('flex-1 overflow-y-auto py-2', rail ? 'px-2' : 'px-3')}>
          <ul className="mb-3 space-y-0.5">{renderItem(overviewItem)}</ul>

          {navGroups.map((group) => {
            const isGroupCollapsed = !rail && !!collapsedGroups[group.key];
            const panelId = `nav-group-${group.key}`;
            return (
              <div key={group.key} className="mb-1">
                {rail ? (
                  // Rail rejimida guruh sarlavhasi o'rniga ingichka ajratkich —
                  // guruhlanish saqlanadi, matn esa tooltip'larda.
                  <div className="mx-2 my-2 border-t border-divider" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    aria-expanded={!isGroupCollapsed}
                    aria-controls={panelId}
                    onClick={() =>
                      setCollapsedGroups((c) => ({ ...c, [group.key]: !c[group.key] }))
                    }
                    className={cn(
                      'flex w-full items-center justify-between rounded-ds-xs px-2 py-1.5 text-micro uppercase text-subtle',
                      'transition-colors duration-fast hover:text-ink',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
                    )}
                  >
                    {group.label}
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform duration-fast',
                        isGroupCollapsed && '-rotate-90'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                )}
                {!isGroupCollapsed && (
                  <ul id={panelId} className="space-y-0.5">
                    {group.items.map(renderItem)}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Rail toggle (faqat desktop) + user + logout */}
        <div className={cn('space-y-2 border-t border-line', rail ? 'p-2' : 'p-4')}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? 'Menyuni kengaytirish' : 'Menyuni yig‘ish'}
            title={isCollapsed ? 'Menyuni kengaytirish' : 'Menyuni yig‘ish'}
            className={cn(
              'hidden w-full items-center rounded-ds-sm py-2 text-body font-medium text-muted lg:flex',
              rail ? 'justify-center px-0' : 'gap-3 px-3',
              'transition-colors duration-fast hover:bg-surface-2 hover:text-ink',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {!rail && 'Menyuni yig‘ish'}
          </button>

          {user &&
            (rail ? (
              <div
                className="flex justify-center py-1"
                title={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Admin'}
              >
                <Avatar name={`${user.firstName ?? ''} ${user.lastName ?? ''}`} size="sm" />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-ds-sm bg-surface-2 px-3 py-2.5">
                <Avatar name={`${user.firstName ?? ''} ${user.lastName ?? ''}`} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-ink">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-caption text-muted">Admin</p>
                </div>
              </div>
            ))}

          <button
            type="button"
            onClick={logout}
            aria-label={rail ? 'Chiqish' : undefined}
            title={rail ? 'Chiqish' : undefined}
            className={cn(
              'flex w-full items-center rounded-ds-sm py-2 text-body font-medium text-muted',
              rail ? 'justify-center px-0' : 'gap-3 px-3',
              'transition-colors duration-fast hover:bg-danger-tint hover:text-danger-deep dark:hover:text-danger-light',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!rail && 'Chiqish'}
          </button>
        </div>
      </aside>
    </>
  );
}
