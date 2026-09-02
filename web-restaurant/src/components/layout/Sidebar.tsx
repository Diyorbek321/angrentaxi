'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ClipboardList,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Tags,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
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

/**
 * Navigatsiya domen bo'yicha guruhlangan (manager-panel doktrinasi):
 * Operatsiyalar — kunlik ish, Katalog — menyu boshqaruvi, Boshqaruv —
 * hisobot va sozlamalar. Guruhsiz 6 ta tekis element ustunlik tartibini
 * yashirardi.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'ops',
    label: 'Operatsiyalar',
    items: [
      { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid, exact: true },
      { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
    ],
  },
  {
    key: 'catalog',
    label: 'Katalog',
    items: [
      { href: '/dashboard/menu', label: 'Menyu', icon: UtensilsCrossed },
      { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
    ],
  },
  {
    key: 'manage',
    label: 'Boshqaruv',
    items: [
      { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
      { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
    ],
  },
];

const COLLAPSED_KEY = 'angren-restaurant-sidebar-collapsed';

/**
 * Yig'ilgan holat sinxron o'qiladi — komponent faqat autentifikatsiya
 * hal bo'lgach, to'liq klientda mount bo'ladi, shuning uchun bu yerda
 * hidratsiya nomuvofiqligi ham, "chaqnash" ham bo'lmaydi (layout avval
 * skelet ko'rsatadi).
 */
function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export interface SidebarProps {
  restaurantName: string | null;
  userName: string | null;
  userPhone: string | null | undefined;
  /** Yon menyudagi "Buyurtmalar" badge'i — real kutilayotgan holatga bog'langan. */
  newOrders: number;
  onLogout: () => void;
  /** lg dan past: off-canvas holati. */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  restaurantName,
  userName,
  userPhone,
  newOrders,
  onLogout,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* private rejim — holat shu sessiya uchun baribir qo'llanadi */
      }
      return next;
    });
  };

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const renderItem = (item: NavItem) => {
    const active = isActive(item);
    const showBadge = item.href === '/dashboard/orders' && newOrders > 0;
    const Icon = item.icon;

    return (
      <li key={item.href} className="relative group">
        <Link
          href={item.href}
          onClick={onMobileClose}
          aria-current={active ? 'page' : undefined}
          aria-label={collapsed ? item.label : undefined}
          className={clsx(
            'relative flex items-center rounded-ds-sm text-label transition-colors duration-fast min-h-touch',
            collapsed ? 'lg:justify-center lg:px-0 gap-3 px-3' : 'gap-3 px-3',
            // Faol element IKKI indikator bilan: chap qirra chizig'i + tint
            // to'ldirish (+aria-current). Rang yolg'iz ma'no tashimaydi.
            active
              ? 'border-l-2 border-primary bg-mint-tint text-primary-text rounded-l-none font-bold'
              : 'border-l-2 border-transparent text-muted hover:bg-surface-2 hover:text-ink'
          )}
        >
          <span className="relative shrink-0 inline-flex">
            <Icon className="h-5 w-5" aria-hidden />
            {/* Yig'ilgan railda badge ikonka burchagida turadi. */}
            {showBadge && collapsed && (
              <span
                aria-hidden
                className="absolute -right-1.5 -top-1.5 hidden lg:inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-info-deep px-1 font-mono text-[10px] font-bold leading-none text-white"
              >
                {newOrders > 9 ? '9+' : newOrders}
              </span>
            )}
          </span>
          <span className={clsx('flex-1 truncate', collapsed && 'lg:hidden')}>{item.label}</span>
          {showBadge && (
            <span
              className={clsx(
                'min-w-[22px] rounded-full px-1.5 py-0.5 text-micro font-mono text-center',
                collapsed && 'lg:hidden',
                active ? 'bg-info-deep text-white' : 'bg-info-tint text-info-deep dark:text-info-light'
              )}
            >
              {newOrders}
              <span className="sr-only"> ta yangi buyurtma</span>
            </span>
          )}
        </Link>

        {/* Tooltip — faqat yig'ilgan railda, hover/fokusda. */}
        {collapsed && (
          <span
            role="presentation"
            className={clsx(
              'pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap',
              'rounded-ds-xs bg-ink px-2.5 py-1.5 text-caption font-bold text-bg shadow-pop',
              'hidden opacity-0 transition-opacity duration-fast',
              'lg:block lg:group-hover:opacity-100 lg:group-focus-within:opacity-100'
            )}
          >
            {item.label}
            {showBadge && ` · ${newOrders} ta yangi`}
          </span>
        )}
      </li>
    );
  };

  const nav = (
    <nav
      aria-label="Asosiy menyu"
      // Yig'ilgan railda overflow ochiq qoladi — aks holda tooltiplar
      // scroll-konteyner tomonidan kesilib qoladi (rail baribir qisqa).
      className={clsx(
        'flex flex-1 flex-col gap-1',
        collapsed ? 'overflow-y-auto no-scrollbar lg:overflow-visible' : 'overflow-y-auto no-scrollbar'
      )}
    >
      {NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.key} className="mb-1.5">
          <p
            className={clsx(
              'px-3 pb-1 pt-2 text-micro uppercase text-subtle select-none',
              collapsed && 'lg:hidden'
            )}
          >
            {group.label}
          </p>
          {/* Yig'ilgan railda guruh yozuvi o'rnini ingichka chiziq bosadi. */}
          {collapsed && groupIndex > 0 && (
            <span aria-hidden className="mx-3 mb-1.5 mt-1 hidden h-px bg-line lg:block" />
          )}
          <ul className="flex flex-col gap-0.5">{group.items.map(renderItem)}</ul>
        </div>
      ))}
    </nav>
  );

  const content = (
    <>
      <div className={clsx('flex items-center gap-3 px-1 pt-1', collapsed && 'lg:justify-center lg:px-0')}>
        <Avatar name={restaurantName ?? 'Restoran'} size={collapsed ? 'md' : 'lg'} />
        <div className={clsx('min-w-0', collapsed && 'lg:hidden')}>
          <p className="text-title text-ink truncate">{restaurantName ?? '—'}</p>
          <p className="text-micro text-subtle">ANGREN TAXI · RESTORAN</p>
        </div>
      </div>

      {nav}

      <div
        className={clsx(
          'flex items-center gap-3 rounded-ds-sm border border-line bg-surface-2 px-3 py-2.5',
          collapsed && 'lg:flex-col lg:gap-2 lg:px-1.5'
        )}
      >
        <Avatar name={userName ?? 'Menejer'} size="md" tone="muted" />
        <div className={clsx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
          <p className="text-label text-ink truncate">{userName ?? 'Menejer'}</p>
          <p className="text-micro text-subtle font-mono">{userPhone}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Chiqish"
          title="Chiqish"
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-ds-xs text-muted hover:bg-surface-3 hover:text-danger-deep dark:hover:text-danger-light transition-colors duration-fast"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Rail yig'ish/ochish — faqat desktopda ma'noga ega. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-pressed={collapsed}
        aria-label={collapsed ? 'Yon panelni ochish' : 'Yon panelni yig‘ish'}
        title={collapsed ? 'Yon panelni ochish' : 'Yon panelni yig‘ish'}
        className={clsx(
          'hidden lg:flex items-center gap-2 rounded-ds-sm px-3 py-2 text-caption font-bold text-subtle',
          'hover:bg-surface-2 hover:text-ink transition-colors duration-fast min-h-touch',
          collapsed && 'justify-center px-0'
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <>
            <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />
            <span>Yig&apos;ish</span>
          </>
        )}
      </button>
    </>
  );

  return (
    <>
      {/* Mobil backdrop — drawer ochiq bo'lsa. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#04140F]/50 backdrop-blur-[2px] lg:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      <aside
        aria-label="Yon panel"
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex h-full flex-col gap-4 border-r border-line bg-surface p-4',
          'transition-transform duration-base ease-emphasized lg:static lg:translate-x-0 lg:transition-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'w-64 shrink-0',
          collapsed && 'lg:w-[76px] lg:px-2.5'
        )}
      >
        {content}
      </aside>
    </>
  );
}
