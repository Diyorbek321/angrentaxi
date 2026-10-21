'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWalletSettlementToasts } from '@/hooks/useVendorSettlement';
import { foodApi, type FoodOrder, type Restaurant } from '@/lib/api';
import { useKiosk } from '@/lib/kiosk-context';
import { trackNewOrders, resetOrderAlerts } from '@/lib/order-alerts';
import { createCancellationTracker } from '@/lib/order-extras';
import { shortId } from '@/lib/format';
import { SIDEBAR_COOKIE } from '@/lib/ui-prefs';
import { AppShell, LiveDivider, LiveMetric, type NavGroup, type ShellUser } from '@/components/shell';
import { Button } from '@/components/ui/Button';
import { PollStatus } from '@/components/ui/PollStatus';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { KioskFrame } from './KioskFrame';
import { OpenToggle } from './OpenToggle';
import { ORDERS_HREF, restaurantNav } from './nav-config';
import { t } from '@/locales';
import { useRefreshAll } from '@/components/shell';

const CHROME_POLL_MS = 30_000;

interface Chrome {
  restaurant: Restaurant | null;
  newOrders: number;
}

/**
 * Restoran paneli ramkasi: auth yo'naltirish, restoran holati poll'i,
 * ovozli signal, Ochiq/Yopiq boshqaruvi va yagona "Jonli/Yangilandi"
 * ko'rsatkichi (topbar). Oshxona ekrani (kiosk) — shu sahifaning to'liq
 * ekran rejimi, sidebar/topbar'siz.
 */
export function RestaurantShell({
  children,
  initialCollapsed = false,
}: {
  children: ReactNode;
  initialCollapsed?: boolean;
}) {
  const m = t().shell;
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { kiosk, setKiosk } = useKiosk();
  const refreshPages = useRefreshAll();
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(false);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  // Mijoz bekor qilgan buyurtmalar — ramka poll'idan (va socket turtkisidan) aniqlanadi.
  const cancelTrackerRef = useRef(createCancellationTracker());

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
    // Ovozsiz: faqat toast — bekor qilish ish emas, oshxonani chalg'itmaydi.
    // Matnlar shu yerda olinadi (callback barqaror, til almashsa daraxt qayta o'rnatiladi).
    const sm = t().shell;
    cancelTrackerRef.current(orders).forEach((o) =>
      toastRef.current({
        title: sm.customerCancelled(shortId(o.id)),
        description: o.cancelReason?.trim() ? sm.cancelReason(o.cancelReason.trim()) : sm.noCancelReason,
        variant: 'info',
      })
    );
    return { restaurant, newOrders: orders.filter((o) => o.status === 'new').length };
  }, []);

  const chrome = useAsyncData<Chrome>(loadChrome, { pollMs: CHROME_POLL_MS, enabled: isAuthenticated });
  // Yangi buyurtma socket orqali darhol: ovozli signal ham shu yuklashdan chiqadi.
  useRealtimeRefresh(chrome.reload, isAuthenticated);
  // Hamyon o'tkazmasi (va teskarisi) — qaysi sahifada bo'lmasin toast.
  useWalletSettlementToasts(isAuthenticated);

  const restaurant = chrome.data?.restaurant ?? null;
  const newOrders = chrome.data?.newOrders ?? 0;
  const isOpen = restaurant?.status === 'active';

  // Fon vkladkasi ham yangi buyurtmani ko'rsatadi: brauzer tab sarlavhasida son.
  useEffect(() => {
    const base = t().shell.baseTitle;
    document.title = newOrders > 0 ? t().shell.titleWithNew(newOrders, base) : base;
    return () => {
      document.title = base;
    };
  }, [newOrders]);

  const toggleOpen = useCallback(async () => {
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
  }, [chrome]);

  /** Topbar "Yangilash": ramka + joriy sahifa ma'lumoti birga. */
  const refresh = useCallback(async () => {
    setManualRefresh(true);
    try {
      await Promise.allSettled([chrome.reload(), refreshPages()]);
    } finally {
      setManualRefresh(false);
    }
  }, [chrome, refreshPages]);

  const handleLogout = useCallback(async () => {
    resetOrderAlerts();
    cancelTrackerRef.current = createCancellationTracker();
    await logout();
  }, [logout]);

  const nav: NavGroup[] = useMemo(
    () =>
      restaurantNav().map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.href === ORDERS_HREF ? { ...item, badge: newOrders } : item
        ),
      })),
    [newOrders]
  );

  const shellUser: ShellUser | null = user
    ? { firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: m.role }
    : null;

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div role="status" aria-live="polite" className="w-full max-w-sm flex flex-col items-center gap-3">
          <span className="sr-only">{m.checkingSession}</span>
          <Skeleton className="h-10 w-10 rounded-ds-sm" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
    );
  }

  const openToggle = (large: boolean) => (
    <OpenToggle
      isOpen={isOpen}
      unknown={restaurant == null}
      busy={togglingOpen}
      onToggle={toggleOpen}
      large={large}
    />
  );

  const pollStatus = (
    <PollStatus
      lastUpdatedAt={chrome.lastUpdatedAt}
      isRefreshing={chrome.isRefreshing || manualRefresh}
      onRefresh={refresh}
      error={chrome.error}
    />
  );

  /**
   * Pauza holati JIM turmaydi: restoran yopiq ekan, yangi buyurtma kelmaydi —
   * banner buni har sahifada baland aytadi.
   */
  const pausedBanner = !isOpen && restaurant != null && (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-danger/30 bg-danger-tint px-4 py-2 sm:px-6"
    >
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-danger" />
      <p className="min-w-0 flex-1 text-[13px] font-medium text-danger-dark dark:text-danger-light">
        {m.pausedBanner}
      </p>
      <Button variant="secondary" size="sm" isLoading={togglingOpen} onClick={toggleOpen}>
        {m.openIntake}
      </Button>
    </div>
  );

  if (kiosk) {
    return (
      <KioskFrame
        title={restaurant?.name ?? '—'}
        status={pollStatus}
        openToggle={openToggle(true)}
        banner={pausedBanner || undefined}
        onExit={() => setKiosk(false)}
      >
        {children}
      </KioskFrame>
    );
  }

  return (
    <AppShell
      brand={{ name: 'Angren Taxi', subtitle: restaurant?.name ?? m.restaurantFallback, href: '/dashboard' }}
      nav={nav}
      user={shellUser}
      onLogout={handleLogout}
      initialCollapsed={initialCollapsed}
      collapseCookie={SIDEBAR_COOKIE}
      banner={pausedBanner || undefined}
      padded
      live={
        <>
          {openToggle(false)}
          <LiveDivider />
          <LiveMetric
            icon={<BellRing aria-hidden />}
            value={newOrders}
            label={m.newOrders}
            href={ORDERS_HREF}
            tone={newOrders > 0 ? 'attention' : 'neutral'}
            loading={chrome.status === 'loading'}
          />
          <LiveDivider />
          {pollStatus}
        </>
      }
    >
      {children}
    </AppShell>
  );
}
