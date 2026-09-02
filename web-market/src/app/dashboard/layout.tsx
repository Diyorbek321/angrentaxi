'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, WifiOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { marketApi, Store } from '@/lib/api';
import { formatTime } from '@/lib/utils';
import { Sidebar } from '@/components/layout/Sidebar';
import { PollingStatus } from '@/components/layout/PollingStatus';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const BASE_TITLE = 'Angren Market — Sotuvchi paneli';
const POLL_INTERVAL_MS = 30_000;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Poll halolligi: oxirgi muvaffaqiyatli yangilanish vaqti va uzilish holati.
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollFailed, setPollFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const refresh = useCallback(async () => {
    try {
      const [storeRes, ordersRes, dashRes] = await Promise.all([
        marketApi.getStore(),
        marketApi.getOrders('new'),
        marketApi.getDashboard(),
      ]);
      setStore(storeRes.data.data);
      setNewOrdersCount(ordersRes.data.data.length);
      setHasCritical(dashRes.data.data.outOfStockCount > 0);
      setLastUpdated(new Date());
      setPollFailed(false);
    } catch {
      // 401 ni interceptor hal qiladi; qolgan xatolar — aloqa uzilishi.
      // Oxirgi yaxshi ma'lumot EKRANDA QOLADI, banner esa eskirganini aytadi.
      setPollFailed(true);
    }
  }, []);

  const manualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, refresh]);

  // Fon tabida ham ko'rinsin: yangi buyurtma soni brauzer tab sarlavhasida.
  useEffect(() => {
    document.title =
      newOrdersCount > 0 ? `(${newOrdersCount}) Yangi buyurtma — Angren Market` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [newOrdersCount]);

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
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-[74px] w-full rounded-ds-md" />
          <Skeleton className="h-64 w-full rounded-ds-md" />
        </div>
      </div>
    );
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Sotuvchi';

  return (
    <div className="flex min-h-screen w-full bg-bg text-ink">
      <Sidebar
        store={store}
        userName={fullName}
        newOrdersCount={newOrdersCount}
        hasCritical={hasCritical}
        mobileOpen={navOpen}
        onMobileClose={() => setNavOpen(false)}
        onLogout={() => void logout()}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Menyuni ochish"
            aria-expanded={navOpen}
            className="h-10 w-10 rounded-ds-xs border border-line text-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <Menu size={16} className="mx-auto" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink lg:hidden">
            {store?.name ?? 'Angren Market'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {newOrdersCount > 0 && (
              <Link
                href="/dashboard/orders"
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <Badge variant="primary" dot className="font-bold">
                  {newOrdersCount} yangi buyurtma
                </Badge>
              </Link>
            )}
            <PollingStatus
              lastUpdated={lastUpdated}
              failed={pollFailed}
              refreshing={refreshing}
              onRefresh={manualRefresh}
            />
            <ThemeToggle />
          </div>
        </header>

        {/* Aloqa uzilgan banner: oxirgi yaxshi ma'lumot ekranda qoladi, lekin
            ESKIRGANI aniq yozib qo'yiladi — jim turib "jonli"ga o'xshatish
            paneldagi ishonchni bir marta va butunlay sindiradi. */}
        {pollFailed && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border-b border-override/40 bg-override-tint px-4 py-2.5 lg:px-6"
          >
            <WifiOff
              size={16}
              aria-hidden
              className="shrink-0 text-override-dark dark:text-override-light"
            />
            <p className="min-w-0 flex-1 text-caption font-bold text-override-dark dark:text-override-light">
              Server bilan aloqa yo&apos;q
              {lastUpdated
                ? ` — ma'lumotlar ${formatTime(lastUpdated.toISOString())} da yangilangan, eskirgan bo'lishi mumkin`
                : " — ma'lumotlarni yuklab bo'lmadi"}
            </p>
            <Button variant="secondary" size="sm" isLoading={refreshing} onClick={() => void manualRefresh()}>
              Qayta urinish
            </Button>
          </div>
        )}

        <div className="min-w-0 flex-1 p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
