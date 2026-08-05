'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  ClipboardList,
  Package,
  Tags,
  Boxes,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { marketApi, Store } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NAV = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid },
  { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
  { href: '/dashboard/products', label: 'Mahsulotlar', icon: Package },
  { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
  { href: '/dashboard/stock', label: 'Zaxira', icon: Boxes },
  { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = async () => {
      try {
        const [storeRes, ordersRes, dashRes] = await Promise.all([
          marketApi.getStore(),
          marketApi.getOrders('new'),
          marketApi.getDashboard(),
        ]);
        setStore(storeRes.data.data);
        setNewOrdersCount(ordersRes.data.data.length);
        setHasCritical(dashRes.data.data.outOfStockCount > 0);
      } catch {
        // handled globally by the 401 interceptor
      }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Any navigation closes the mobile drawer; leaving it open over the new page
  // is the classic off-canvas bug.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-bg" aria-busy="true" aria-live="polite">
        <span className="sr-only">Yuklanmoqda</span>
        <div className="hidden w-[248px] shrink-0 border-r border-line p-4 lg:block">
          <Skeleton className="h-11 w-full rounded-ds-sm" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-ds-sm" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-[74px] w-full rounded-ds-md" />
          <Skeleton className="h-64 w-full rounded-ds-md" />
        </div>
      </div>
    );
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Sotuvchi';
  const storeOpen = store?.status !== 'closed';

  const navList = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Asosiy navigatsiya">
      {NAV.map((item) => {
        const active =
          item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'relative flex items-center gap-3 rounded-ds-sm px-3 py-2.5 text-sm font-semibold',
              'transition-colors duration-fast',
              active
                ? 'bg-mint-tint text-primary-text'
                : 'text-muted hover:bg-surface-2 hover:text-ink'
            )}
          >
            {/* The rail repeats what `aria-current` says — position, not colour,
                is what makes the active item findable at a glance. */}
            {active && (
              <span
                aria-hidden
                className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-primary"
              />
            )}
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
            <span className="truncate">{item.label}</span>
            {item.href === '/dashboard/orders' && newOrdersCount > 0 && (
              <Badge variant="primary" size="sm" className="ml-auto font-mono">
                {newOrdersCount}
              </Badge>
            )}
            {item.href === '/dashboard/stock' && hasCritical && (
              <Badge variant="danger" size="sm" className="ml-auto">
                Kritik
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const storeCard = (
    <div className="mt-4 flex items-center gap-3 rounded-ds-sm border border-line bg-surface-2/60 p-3">
      <Avatar name={fullName} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{store?.name ?? '—'}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted">
          <span
            aria-hidden
            className={clsx(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              // mint-deep, not mint: on a light surface plain mint is 2.12:1
              // and a status dot has to be visible to mean anything.
              storeOpen ? 'bg-mint-deep' : 'bg-line-strong'
            )}
          />
          {storeOpen ? 'Ochiq' : 'Yopiq'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-bg text-ink">
      {/* Desktop rail */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-surface p-3.5 lg:flex">
        <BrandMark />
        {navList}
        {storeCard}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 justify-start"
          onClick={() => void logout()}
          leftIcon={<LogOut size={14} aria-hidden />}
        >
          Chiqish
        </Button>
      </aside>

      {/* Mobile off-canvas rail */}
      {navOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNavOpen(false);
          }}
        >
          <div aria-hidden className="absolute inset-0 bg-[#04140F]/50 backdrop-blur-[2px]" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigatsiya"
            className="relative flex h-full w-[264px] flex-col border-r border-line bg-surface p-3.5 shadow-pop animate-slide-in-right"
          >
            <div className="flex items-start justify-between">
              <BrandMark />
              <button
                type="button"
                aria-label="Yopish"
                onClick={() => setNavOpen(false)}
                className="h-8 w-8 shrink-0 rounded-ds-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X size={16} className="mx-auto" aria-hidden />
              </button>
            </div>
            {navList}
            {storeCard}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 justify-start"
              onClick={() => void logout()}
              leftIcon={<LogOut size={14} aria-hidden />}
            >
              Chiqish
            </Button>
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Menyuni ochish"
            aria-expanded={navOpen}
            className="h-9 w-9 rounded-ds-xs border border-line text-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <Menu size={16} className="mx-auto" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink lg:hidden">
            {store?.name ?? 'Angren Market'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {newOrdersCount > 0 && (
              <Badge variant="primary" size="sm" dot>
                {newOrdersCount} yangi buyurtma
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="min-w-0 flex-1 p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3 px-2 pb-5 pt-1.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-sm bg-gradient-cta">
        <Package className="h-[18px] w-[18px] text-white" strokeWidth={2.4} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate text-title leading-tight text-ink">Angren Market</p>
        <p className="mt-0.5 text-caption text-muted">Sotuvchi paneli</p>
      </div>
    </div>
  );
}
