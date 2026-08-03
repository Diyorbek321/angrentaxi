'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  ClipboardList,
  Package,
  Tags,
  Boxes,
  BarChart3,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Store as StoreIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { STORE_STATUS_LABEL } from '@/lib/orderStatus';
import type { Store } from '@/lib/api';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid },
  { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
  { href: '/dashboard/products', label: 'Mahsulotlar', icon: Package },
  { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
  { href: '/dashboard/stock', label: 'Zaxira', icon: Boxes },
  { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
] as const;

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  store: Store | null;
  newOrdersCount: number;
  /** Something is out of stock — the badge that must survive collapsing. */
  hasCritical: boolean;
  onLogout: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  store,
  newOrdersCount,
  hasCritical,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const isOpen = store?.status !== 'closed';

  return (
    <aside
      className={cn(
        'shrink-0 h-full flex flex-col bg-surface border-r border-line transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[248px]'
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-2.5 h-[68px] shrink-0 border-b border-line',
          collapsed ? 'justify-center px-2' : 'px-4'
        )}
      >
        <div className="h-9 w-9 shrink-0 rounded-xl bg-primary flex items-center justify-center shadow-glow-mint-sm">
          <Package className="h-[18px] w-[18px] text-[#04231A]" strokeWidth={2.4} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight text-ink truncate">
              Angren Market
            </div>
            <div className="text-[11px] text-muted font-medium">Sotuvchi paneli</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 overflow-y-auto no-scrollbar py-3', collapsed ? 'px-2' : 'px-3')}>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            const badge = item.href === '/dashboard/orders' ? newOrdersCount : 0;
            const alert = item.href === '/dashboard/stock' && hasCritical;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center rounded-lg text-sm font-medium transition-colors',
                    collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2.5',
                    active
                      ? 'bg-primary/12 text-primary-700 dark:text-primary-300'
                      : 'text-muted hover:bg-surface-2 hover:text-ink'
                  )}
                >
                  {active && !collapsed && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
                  )}
                  <span className="relative shrink-0">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    {/* Collapsed rail keeps the signal, just smaller. */}
                    {collapsed && badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
                    )}
                    {collapsed && alert && (
                      <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
                    )}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && badge > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-[#04231A] text-[11px] font-bold font-mono flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                  {!collapsed && alert && (
                    <span
                      className="ml-auto h-2 w-2 rounded-full bg-danger"
                      title="Zaxirasi tugagan mahsulot bor"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Store + session */}
      <div className={cn('shrink-0 border-t border-line py-3', collapsed ? 'px-2' : 'px-3')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              title={`${store?.name ?? "Do'kon"} — ${STORE_STATUS_LABEL[store?.status ?? 'active']}`}
              className="h-9 w-9 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-[11px] font-bold text-ink"
            >
              {initials(store?.name)}
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Chiqish"
              aria-label="Chiqish"
              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-xl bg-surface-2 border border-line p-2.5">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-surface border border-line flex items-center justify-center">
                <StoreIcon size={16} className="text-muted" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-ink truncate">
                  {store?.name ?? '—'}
                </div>
                <div
                  className={cn(
                    'text-[11px] font-medium flex items-center gap-1.5 mt-0.5',
                    isOpen ? 'text-primary-700 dark:text-primary-300' : 'text-muted'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      isOpen ? 'bg-primary' : 'bg-line-strong'
                    )}
                  />
                  {STORE_STATUS_LABEL[store?.status ?? 'active']}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut size={16} />
              Chiqish
            </button>
          </>
        )}
      </div>

      {/* Collapse handle */}
      <div className={cn('shrink-0 border-t border-line p-2', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? "Menyuni yozish" : "Menyuni yig'ish"}
          aria-label={collapsed ? "Menyuni yozish" : "Menyuni yig'ish"}
          className={cn(
            'flex items-center gap-2.5 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-surface-2 transition-colors',
            collapsed ? 'h-9 w-9 justify-center' : 'w-full px-3 py-2'
          )}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && "Yig'ish"}
        </button>
      </div>
    </aside>
  );
}
