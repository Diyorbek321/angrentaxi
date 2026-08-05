'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  ClipboardList,
  LayoutGrid,
  LogOut,
  RotateCw,
  Settings,
  Tags,
  UtensilsCrossed,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { useAsyncData } from '@/hooks/useAsyncData';
import { foodApi, FoodOrder, Restaurant } from '@/lib/api';
import { useKiosk } from '@/lib/kiosk-context';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NAV = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: LayoutGrid },
  { href: '/dashboard/orders', label: 'Buyurtmalar', icon: ClipboardList },
  { href: '/dashboard/menu', label: 'Menyu', icon: UtensilsCrossed },
  { href: '/dashboard/categories', label: 'Kategoriyalar', icon: Tags },
  { href: '/dashboard/reports', label: 'Hisobotlar', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Sozlamalar', icon: Settings },
] as const;

interface Chrome {
  restaurant: Restaurant | null;
  newOrders: number;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { kiosk, setKiosk } = useKiosk();
  const [clock, setClock] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  const loadChrome = useCallback(async (): Promise<Chrome> => {
    const [restaurantRes, ordersRes] = await Promise.all([foodApi.getRestaurant(), foodApi.getOrders()]);
    const orders: FoodOrder[] = ordersRes.data.data;
    return {
      restaurant: restaurantRes.data.data,
      newOrders: orders.filter((o) => o.status === 'new').length,
    };
  }, []);

  const chrome = useAsyncData<Chrome>(loadChrome, { pollMs: 30000, enabled: isAuthenticated });

  useEffect(() => {
    if (!kiosk) return;
    const tick = () => setClock(new Date().toLocaleTimeString('uz-UZ', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kiosk]);

  const restaurant = chrome.data?.restaurant ?? null;
  const newOrders = chrome.data?.newOrders ?? 0;
  const isOpen = restaurant?.status === 'active';

  const toggleOpen = async () => {
    try {
      const res = await foodApi.toggleOpen();
      const next = res.data.data;
      chrome.setData((prev) => ({ restaurant: next, newOrders: prev?.newOrders ?? 0 }));
    } catch {
      await chrome.reload();
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div role="status" aria-live="polite" className="w-full max-w-sm flex flex-col items-center gap-3">
          <span className="sr-only">Sessiya tekshirilmoqda</span>
          <Skeleton className="h-14 w-14 rounded-ds-md" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  /** Ochiq/yopiq holat: rang + nuqta + YOZUV. Rang yolg'iz ma'no tashimaydi. */
  const openToggle = (
    <button
      type="button"
      onClick={toggleOpen}
      aria-pressed={isOpen}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-label transition-colors duration-fast min-h-touch',
        isOpen
          ? 'border-mint/45 bg-mint-tint text-primary-text'
          : 'border-danger/45 bg-danger-tint text-danger-deep dark:text-danger-light'
      )}
    >
      <span className={clsx('h-2.5 w-2.5 rounded-full', isOpen ? 'bg-mint-deep' : 'bg-danger')} aria-hidden />
      {isOpen ? 'Ochiq' : 'Yopiq'}
      <span className="sr-only">{isOpen ? '— yopish uchun bosing' : '— ochish uchun bosing'}</span>
    </button>
  );

  if (kiosk) {
    return (
      <div className="flex h-screen w-full flex-col bg-bg text-ink overflow-hidden">
        <header className="flex items-center gap-3 px-4 sm:px-6 h-16 shrink-0 border-b border-line bg-surface">
          <UtensilsCrossed className="h-5 w-5 text-primary-text shrink-0" aria-hidden />
          <span className="text-h3 text-ink truncate">
            Oshxona ekrani · {restaurant?.name ?? '—'}
          </span>
          <span className="font-mono text-title text-muted tabular-nums hidden sm:inline">{clock}</span>
          <div className="flex-1" />
          {openToggle}
          <Button variant="secondary" onClick={() => setKiosk(false)}>
            Kioskdan chiqish
          </Button>
        </header>
        <main id="main" className="flex-1 overflow-y-auto p-4 sm:p-5">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-bg text-ink overflow-hidden">
      <a href="#main" className="skip-link">
        Asosiy kontentga o&apos;tish
      </a>

      <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-4 border-r border-line bg-surface p-4">
        <div className="flex items-center gap-3 px-1 pt-1">
          <Avatar name={restaurant?.name ?? 'Restoran'} size="lg" />
          <div className="min-w-0">
            <p className="text-title text-ink truncate">{restaurant?.name ?? '—'}</p>
            <p className="text-micro text-subtle">ANGREN TAXI · RESTORAN</p>
          </div>
        </div>

        <nav aria-label="Asosiy menyu" className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 rounded-ds-sm px-3.5 py-3 text-label transition-colors duration-fast min-h-touch',
                  // Faol element — INTERAKTIV qatlam: to'q yashil fon + oq matn.
                  active
                    ? 'bg-primary text-white dark:bg-primary-on-dark'
                    : 'text-muted hover:bg-surface-2 hover:text-ink'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.href === '/dashboard/orders' && newOrders > 0 && (
                  <span
                    className={clsx(
                      'min-w-[22px] rounded-full px-1.5 py-0.5 text-micro font-mono text-center',
                      active ? 'bg-white/20 text-white' : 'bg-info-tint text-info-deep dark:text-info-light'
                    )}
                  >
                    {newOrders}
                    <span className="sr-only"> ta yangi buyurtma</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 rounded-ds-sm border border-line bg-surface-2 px-3 py-2.5">
          <Avatar name={user?.firstName ?? 'Menejer'} size="md" tone="muted" />
          <div className="min-w-0 flex-1">
            <p className="text-label text-ink truncate">{user?.firstName ?? 'Menejer'}</p>
            <p className="text-micro text-subtle font-mono">{user?.phone}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Chiqish"
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-ds-xs text-muted hover:bg-surface-3 hover:text-danger-deep dark:hover:text-danger-light transition-colors duration-fast"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <UtensilsCrossed className="h-5 w-5 text-primary-text lg:hidden shrink-0" aria-hidden />
          <span className="text-title text-ink truncate lg:hidden">{restaurant?.name ?? '—'}</span>
          <div className="flex-1" />
          {openToggle}
          <button
            type="button"
            onClick={chrome.reload}
            aria-label="Ma'lumotni yangilash"
            className="h-10 w-10 inline-flex items-center justify-center rounded-ds-sm border border-line text-muted hover:bg-surface-2 hover:text-ink transition-colors duration-fast"
          >
            <RotateCw className={clsx('h-4 w-4', chrome.isRefreshing && 'animate-spin')} aria-hidden />
          </button>
          <ThemeToggle />
        </header>

        {/* Mobil navigatsiya — yon panel yashiringanda. */}
        <nav
          aria-label="Asosiy menyu (mobil)"
          className="lg:hidden flex gap-1 overflow-x-auto no-scrollbar border-b border-line bg-surface px-3 py-2"
        >
          {NAV.map((item) => {
            const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'whitespace-nowrap rounded-ds-xs px-3.5 py-2 text-label transition-colors duration-fast',
                  active ? 'bg-primary text-white dark:bg-primary-on-dark' : 'text-muted hover:bg-surface-2'
                )}
              >
                {item.label}
                {item.href === '/dashboard/orders' && newOrders > 0 && (
                  <span className="ml-1.5 font-mono text-micro">({newOrders})</span>
                )}
              </Link>
            );
          })}
        </nav>

        <main id="main" className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
