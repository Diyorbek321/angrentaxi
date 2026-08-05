'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrderChime } from '@/hooks/useOrderChime';
import { marketApi, Store } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/ui/Toast';

const SIDEBAR_STORAGE_KEY = 'angren-market-sidebar-collapsed';

const TITLES: Record<string, [string, string]> = {
  '/dashboard': ['Bosh sahifa', 'Bugungi savdo va zaxira holati'],
  '/dashboard/orders': ['Buyurtmalar', 'Yangi va faol buyurtmalarni boshqaring'],
  '/dashboard/products': ['Mahsulotlar', 'Katalog va zaxirani boshqaring'],
  '/dashboard/categories': ['Kategoriyalar', 'Mahsulot guruhlari va tartibi'],
  '/dashboard/stock': ['Zaxira', 'Kam va tugagan mahsulotlar'],
  '/dashboard/reports': ['Hisobotlar', 'Savdo tahlili va statistika'],
  '/dashboard/settings': ['Sozlamalar', "Do'kon profili va yetkazib berish"],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const chime = useOrderChime();

  const [store, setStore] = useState<Store | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Previous poll's count. `null` until the first response, so the vendor is
  // not greeted by a toast for orders that were already waiting.
  const prevNewCount = useRef<number | null>(null);

  // Sidebar preference is read after mount, never during render — reading
  // localStorage in the render body would desync server and client HTML.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1');
    } catch {
      /* private mode — defaults to expanded */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const [storeRes, ordersRes, dashRes] = await Promise.all([
          marketApi.getStore(),
          marketApi.getOrders('new'),
          marketApi.getDashboard(),
        ]);
        if (cancelled) return;

        const count = ordersRes.data.data.length;
        setStore(storeRes.data.data);
        setNewOrdersCount(count);
        setHasCritical(dashRes.data.data.outOfStockCount > 0);

        if (prevNewCount.current !== null && count > prevNewCount.current) {
          const delta = count - prevNewCount.current;
          toast({
            title: `${delta} ta yangi buyurtma`,
            description: 'Buyurtmalar sahifasida ko‘rishingiz mumkin.',
            variant: 'success',
          });
          chime.play();
        }
        prevNewCount.current = count;
      } catch {
        // 401 is handled globally by the api interceptor; a transient failure
        // just means this tick has no fresh numbers — the next one retries.
      }
    };

    refresh();
    // Polling, every 30s. Deliberately not a WebSocket — see the task spec.
    const interval = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // `chime.play` changes identity when the toggle flips; re-subscribing the
    // poll for that would reset the timer, so only auth drives this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const [pageTitle, pageSub] = TITLES[pathname] ?? ['Sotuvchi paneli', ''];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-ink">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        store={store}
        newOrdersCount={newOrdersCount}
        hasCritical={hasCritical}
        onLogout={logout}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={pageTitle}
          subtitle={pageSub}
          store={store}
          user={user}
          newOrdersCount={newOrdersCount}
          chimeEnabled={chime.enabled}
          onToggleChime={chime.toggle}
          onLogout={logout}
        />
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </main>
    </div>
  );
}
