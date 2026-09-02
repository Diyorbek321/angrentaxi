'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Package,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Tags,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Store } from '@/lib/api';
import { getSidebarCollapsed, setSidebarCollapsed } from '@/lib/sidebar-state';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

const NAV = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid },
  { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
  { href: '/dashboard/products', label: 'Mahsulotlar', icon: Package },
  { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
  { href: '/dashboard/stock', label: 'Zaxira', icon: Boxes },
  { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
] as const;

export interface SidebarProps {
  store: Store | null;
  userName: string;
  /** Poll natijasidan keladi — badge faqat haqiqiy son bilan yonadi. */
  newOrdersCount: number;
  hasCritical: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onLogout: () => void;
}

/**
 * Yon panel: lg dan yuqorida yig'iladigan rail (~64px), lg dan pastda
 * off-canvas drawer. Yig'ilgan holat pre-paint skript orqali <html> ga
 * yozilgan `data-sidebar` atributi bilan boshqariladi (lib/sidebar-state.ts) —
 * kenglikni CSS hal qiladi, shuning uchun yuklashda "sakrash" bo'lmaydi.
 */
export function Sidebar({
  store,
  userName,
  newOrdersCount,
  hasCritical,
  mobileOpen,
  onMobileClose,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  // null — hali mount bo'lmagan: server va klient birinchi renderi bir xil
  // qoladi (hydration), haqiqiy holat esa DOM atributida allaqachon turibdi.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    setCollapsed(getSidebarCollapsed());
  }, []);

  // Har qanday navigatsiya mobil drawer'ni yopadi; yangi sahifa ustida ochiq
  // qolishi — off-canvas'ning klassik xatosi.
  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  const toggleCollapsed = () => {
    const next = !getSidebarCollapsed();
    setSidebarCollapsed(next);
    setCollapsed(next);
  };

  const navList = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Asosiy navigatsiya">
      {NAV.map((item) => {
        const active =
          item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        const orderBadge = item.href === '/dashboard/orders' && newOrdersCount > 0;
        const stockBadge = item.href === '/dashboard/stock' && hasCritical;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'ds-rail-item relative flex h-10 items-center gap-3 rounded-ds-sm px-3 text-sm font-semibold',
              'transition-colors duration-fast',
              // Faol element IKKI vizual belgi bilan: to'ldirish + chekka
              // chizig'i — rang yolg'iz belgilamaydi.
              active
                ? 'bg-mint-tint text-primary-text'
                : 'text-muted hover:bg-surface-2 hover:text-ink'
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-r-full bg-primary"
              />
            )}
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
            <span className="ds-rail-hide min-w-0 truncate">{item.label}</span>
            {orderBadge && (
              <Badge variant="primary" size="sm" className="ds-rail-inline ml-auto font-mono">
                {newOrdersCount}
              </Badge>
            )}
            {stockBadge && (
              <Badge variant="danger" size="sm" className="ds-rail-inline ml-auto">
                Kritik
              </Badge>
            )}
            {/* Yig'ilgan rail: son ikonka burchagidagi mini-pill bo'lib qoladi —
                badge yo'qolib qolmaydi. */}
            {orderBadge && (
              <span
                aria-hidden
                className="ds-rail-dot absolute right-0.5 top-0.5 h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold leading-none text-white"
              >
                {newOrdersCount > 99 ? '99+' : newOrdersCount}
              </span>
            )}
            {stockBadge && (
              <span
                aria-hidden
                className="ds-rail-dot absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-danger"
              />
            )}
            <span
              aria-hidden
              className="ds-rail-tip absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-ds-xs border border-line bg-surface px-2 py-1 text-caption font-semibold text-ink shadow-pop"
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  const storeOpen = store?.status !== 'closed';

  const storeCard = (
    <div
      title={`${store?.name ?? "Do'kon"} — ${storeOpen ? 'Ochiq' : 'Yopiq'}`}
      className="ds-rail-card mt-4 flex items-center gap-3 rounded-ds-sm border border-line bg-surface-2/60 p-3"
    >
      <Avatar name={userName} size="md" />
      <div className="ds-rail-hide min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{store?.name ?? '—'}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted">
          <span
            aria-hidden
            className={clsx(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              // mint-deep, mint emas: yorug' yuzada mint 2.12:1 — status
              // nuqtasi ko'rinishi shart.
              storeOpen ? 'bg-mint-deep' : 'bg-line-strong'
            )}
          />
          {storeOpen ? 'Ochiq' : 'Yopiq'}
        </p>
      </div>
    </div>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={onLogout}
      className="ds-rail-item relative mt-2 flex h-10 items-center gap-3 rounded-ds-sm px-3 text-sm font-semibold text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden />
      <span className="ds-rail-hide">Chiqish</span>
      <span
        aria-hidden
        className="ds-rail-tip absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-ds-xs border border-line bg-surface px-2 py-1 text-caption font-semibold text-ink shadow-pop"
      >
        Chiqish
      </span>
    </button>
  );

  const CollapseIcon = collapsed === null ? PanelLeft : collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
      {/* Desktop rail */}
      <aside className="ds-rail hidden shrink-0 flex-col border-r border-line bg-surface p-3.5 lg:flex">
        <BrandMark />
        {navList}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={collapsed === null ? undefined : !collapsed}
          aria-label={collapsed ? 'Yon panelni kengaytirish' : "Yon panelni yig'ish"}
          className="ds-rail-item relative mt-2 flex h-10 items-center gap-3 rounded-ds-sm px-3 text-sm font-semibold text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
        >
          <CollapseIcon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="ds-rail-hide">Yig&apos;ish</span>
          <span
            aria-hidden
            className="ds-rail-tip absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-ds-xs border border-line bg-surface px-2 py-1 text-caption font-semibold text-ink shadow-pop"
          >
            Kengaytirish
          </span>
        </button>
        {storeCard}
        {logoutButton}
      </aside>

      {/* Mobile off-canvas drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) onMobileClose();
          }}
        >
          <div aria-hidden className="absolute inset-0 bg-[#04140F]/50 backdrop-blur-[2px]" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigatsiya"
            className="relative flex h-full w-[264px] flex-col border-r border-line bg-surface p-3.5 shadow-pop motion-safe:animate-slide-in-right"
          >
            <div className="flex items-start justify-between">
              <BrandMark />
              <button
                type="button"
                aria-label="Yopish"
                onClick={onMobileClose}
                className="h-8 w-8 shrink-0 rounded-ds-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X size={16} className="mx-auto" aria-hidden />
              </button>
            </div>
            {navList}
            {storeCard}
            {logoutButton}
          </aside>
        </div>
      )}
    </>
  );
}

function BrandMark() {
  return (
    <div className="ds-rail-item relative flex items-center gap-3 px-2 pb-5 pt-1.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-sm bg-gradient-cta">
        <Package className="h-[18px] w-[18px] text-white" strokeWidth={2.4} aria-hidden />
      </div>
      <div className="ds-rail-hide min-w-0">
        <p className="truncate text-title leading-tight text-ink">Angren Market</p>
        <p className="mt-0.5 text-caption text-muted">Sotuvchi paneli</p>
      </div>
    </div>
  );
}
