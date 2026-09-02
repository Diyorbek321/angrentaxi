'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, UtensilsCrossed, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { useAsyncData } from '@/hooks/useAsyncData';
import { foodApi, FoodOrder, Restaurant } from '@/lib/api';
import { useKiosk } from '@/lib/kiosk-context';
import { trackNewOrders, resetOrderAlerts } from '@/lib/order-alerts';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { PollStatus } from '@/components/ui/PollStatus';
import { Skeleton } from '@/components/ui/Skeleton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const BASE_TITLE = 'Angren Taxi — Restoran paneli';

interface Chrome {
  restaurant: Restaurant | null;
  newOrders: number;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { kiosk, setKiosk } = useKiosk();
  const [clock, setClock] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  const loadChrome = useCallback(async (): Promise<Chrome> => {
    const [restaurantRes, ordersRes] = await Promise.all([foodApi.getRestaurant(), foodApi.getOrders()]);
    const restaurant = restaurantRes.data.data;
    const orders: FoodOrder[] = ordersRes.data.data;
    // Ovozli signal POLL natijasidan otiladi — operator ekranga qaramasa ham
    // eshitadi. Buyurtmalar sahifasining 15 s poll'i bilan dedup modul ichida.
    trackNewOrders(orders, restaurant?.notifications.sound ?? false);
    return {
      restaurant,
      newOrders: orders.filter((o) => o.status === 'new').length,
    };
  }, []);

  const chrome = useAsyncData<Chrome>(loadChrome, { pollMs: 30000, enabled: isAuthenticated });

  const restaurant = chrome.data?.restaurant ?? null;
  const newOrders = chrome.data?.newOrders ?? 0;
  const isOpen = restaurant?.status === 'active';

  // Fon vkladkasi ham yangi buyurtmani ko'rsatadi: brauzer tab sarlavhasida son.
  useEffect(() => {
    document.title = newOrders > 0 ? `(${newOrders}) Yangi buyurtma — ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [newOrders]);

  useEffect(() => {
    if (!kiosk) return;
    const tick = () => setClock(new Date().toLocaleTimeString('uz-UZ', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kiosk]);

  const toggleOpen = async () => {
    setTogglingOpen(true);
    try {
      const res = await foodApi.toggleOpen();
      const next = res.data.data;
      chrome.setData((prev) => ({ restaurant: next, newOrders: prev?.newOrders ?? 0 }));
    } catch {
      await chrome.reload();
    } finally {
      setTogglingOpen(false);
    }
  };

  const handleLogout = () => {
    resetOrderAlerts();
    void logout();
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
      disabled={togglingOpen}
      aria-pressed={isOpen}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-label transition-colors duration-fast min-h-touch',
        'disabled:opacity-60',
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

  /** Aloqa holati: poll ishlayaptimi — doim ko'rinadi (realtime ishonch). */
  const connectionChip = (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro',
        chrome.error
          ? 'border-danger/45 bg-danger-tint text-danger-deep dark:text-danger-light'
          : 'border-line bg-surface-2 text-muted'
      )}
    >
      {chrome.error ? <WifiOff size={12} aria-hidden /> : <Wifi size={12} aria-hidden />}
      {chrome.error ? 'Aloqa uzildi' : 'Jonli'}
    </span>
  );

  /**
   * Pauza holati JIM turmaydi: restoran yopiq ekan, yangi buyurtma kelmaydi —
   * banner buni har sahifada baland aytadi (vendor-panels: "quietly paused
   * store looks like a store with no customers").
   */
  const pausedBanner = !isOpen && restaurant != null && (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-danger/40 bg-danger-tint px-4 py-2.5 sm:px-6"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-60 animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
      </span>
      <p className="min-w-0 flex-1 text-label text-danger-deep dark:text-danger-light">
        Qabul YOPIQ — mijozlar hozir buyurtma bera olmaydi.
      </p>
      <Button variant="secondary" size="sm" isLoading={togglingOpen} onClick={toggleOpen}>
        Qabulni ochish
      </Button>
    </div>
  );

  if (kiosk) {
    return (
      <div className="flex h-screen w-full flex-col bg-bg text-ink overflow-hidden">
        <header className="flex items-center gap-3 px-4 sm:px-6 h-16 shrink-0 border-b border-line bg-surface">
          <UtensilsCrossed className="h-5 w-5 text-primary-text shrink-0" aria-hidden />
          <span className="text-h3 text-ink truncate">{restaurant?.name ?? '—'}</span>
          {connectionChip}
          <div className="flex-1" />
          <span className="font-mono text-h2 text-ink tabular-nums" aria-hidden>
            {clock}
          </span>
          {openToggle}
          <Button variant="secondary" onClick={() => setKiosk(false)}>
            Kioskdan chiqish
          </Button>
        </header>
        {pausedBanner}
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

      <Sidebar
        restaurantName={restaurant?.name ?? null}
        userName={user?.firstName ?? null}
        userPhone={user?.phone}
        newOrders={newOrders}
        onLogout={handleLogout}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Menyuni ochish"
            className="lg:hidden h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-ds-sm border border-line text-muted hover:bg-surface-2 hover:text-ink transition-colors duration-fast"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <span className="text-title text-ink truncate lg:hidden">{restaurant?.name ?? '—'}</span>
          <span className="hidden lg:inline-flex">{connectionChip}</span>
          <div className="flex-1" />
          {openToggle}
          <PollStatus
            lastUpdatedAt={chrome.lastUpdatedAt}
            isRefreshing={chrome.isRefreshing}
            onRefresh={chrome.reload}
          />
          <ThemeToggle />
        </header>

        {pausedBanner}

        <main id="main" className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
