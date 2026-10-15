'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, CircleOff, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { marketApi, type Store } from '@/lib/api';
import { fullName } from '@/lib/format';
import { getSocket } from '@/lib/realtime';
import { SIDEBAR_COOKIE } from '@/lib/ui-prefs';
import {
  AppShell,
  LiveDivider,
  LiveMetric,
  LiveStatus,
  type LiveState,
  type NavGroup,
  type ShellUser,
  useRefreshAll,
} from '@/components/shell';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { MARKET_NAV, ORDERS_HREF, STOCK_HREF } from './nav-config';
import { useNewOrderChime } from './useNewOrderChime';

const BASE_TITLE = 'Angren Market — Sotuvchi paneli';
const POLL_INTERVAL_MS = 30_000;

/** Socket ulanganmi — "Jonli" faqat push kanali tirik bo'lganda yoziladi. */
function useSocketConnected(enabled: boolean): boolean {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const sock = getSocket();
    const sync = () => setConnected(sock.connected);
    sync();
    sock.on('connect', sync);
    sock.on('disconnect', sync);
    return () => {
      sock.off('connect', sync);
      sock.off('disconnect', sync);
    };
  }, [enabled]);
  return connected;
}

/**
 * Sotuvchi paneli ramkasi: auth yo'naltirish, do'kon holati, yangi buyurtma
 * soni (30 s poll + socket turtkisi), tab sarlavhasi, ovozli signal. Chrome
 * — umumiy AppShell'dan. "Yangilandi" holati FAQAT topbar'dagi LiveStatus'da.
 */
export function MarketShell({
  children,
  initialCollapsed = false,
}: {
  children: ReactNode;
  initialCollapsed?: boolean;
}) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState<number | null>(null);
  const [outOfStockCount, setOutOfStockCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollFailed, setPollFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hadData = useRef(false);
  const refreshPages = useRefreshAll();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
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
      setOutOfStockCount(dashRes.data.data.outOfStockCount);
      setLastUpdated(new Date());
      setPollFailed(false);
      hadData.current = true;
    } catch {
      // 401 ni interceptor hal qiladi; qolgani — aloqa uzilishi. Oxirgi
      // yaxshi ma'lumot ekranda qoladi, LiveStatus esa "Eskirgan" deydi.
      setPollFailed(true);
    }
  }, []);

  /** Topbar "Yangilash": ramka + joriy sahifa ma'lumoti birga. */
  const manualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([refresh(), refreshPages()]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshPages]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated, refresh]);

  // Yangi buyurtma socket orqali darhol — 30 s poll zaxira bo'lib qoladi.
  useRealtimeRefresh(refresh, isAuthenticated);
  const socketConnected = useSocketConnected(isAuthenticated);

  // Fon tabida ham ko'rinsin: yangi buyurtma soni brauzer tab sarlavhasida.
  useEffect(() => {
    document.title =
      newOrdersCount && newOrdersCount > 0
        ? `(${newOrdersCount}) Yangi buyurtma — Angren Market`
        : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [newOrdersCount]);

  const chime = useNewOrderChime(newOrdersCount);

  const liveState: LiveState = pollFailed
    ? hadData.current
      ? 'stale'
      : 'offline'
    : !lastUpdated
      ? 'connecting'
      : socketConnected
        ? 'live'
        : 'reconnecting';

  const nav: NavGroup[] = useMemo(
    () =>
      MARKET_NAV.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          if (item.href === ORDERS_HREF) return { ...item, badge: newOrdersCount ?? 0 };
          if (item.href === STOCK_HREF) {
            return { ...item, badge: outOfStockCount ?? 0, badgeTone: 'danger' as const };
          }
          return item;
        }),
      })),
    [newOrdersCount, outOfStockCount]
  );

  // Sidebar foydalanuvchi kartasi = do'kon: avatar va nom do'konniki,
  // ikkinchi qatorda egasi.
  const shellUser: ShellUser | null = useMemo(() => {
    if (!user) return null;
    const owner = fullName(user.firstName, user.lastName, 'Sotuvchi');
    return {
      name: store?.name ?? null,
      firstName: store ? null : user.firstName,
      lastName: store ? null : user.lastName,
      phone: user.phone,
      role: store ? owner : 'Sotuvchi',
    };
  }, [user, store]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-bg" aria-busy="true" aria-live="polite">
        <span className="sr-only">Yuklanmoqda</span>
        <div className="hidden w-sidebar shrink-0 border-r border-line bg-surface p-3 lg:block">
          <Skeleton className="h-8 w-full" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="h-14 border-b border-line bg-surface" />
          <div className="space-y-4 px-6 py-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full rounded-ds-md" />
            <Skeleton className="h-64 w-full rounded-ds-md" />
          </div>
        </div>
      </div>
    );
  }

  const storeOpen = store ? store.status !== 'closed' : null;

  return (
    <AppShell
      brand={{ name: 'Angren Market', subtitle: 'Sotuvchi paneli', href: '/dashboard' }}
      nav={nav}
      user={shellUser}
      onLogout={logout}
      initialCollapsed={initialCollapsed}
      collapseCookie={SIDEBAR_COOKIE}
      padded
      live={
        <>
          {storeOpen !== null && (
            <Badge variant={storeOpen ? 'success' : 'neutral'} dot className="mr-1 shrink-0">
              {storeOpen ? 'Ochiq' : 'Yopiq'}
            </Badge>
          )}
          <LiveMetric
            icon={<BellRing aria-hidden />}
            value={newOrdersCount}
            label="Yangi buyurtmalar"
            loading={newOrdersCount === null}
            href={ORDERS_HREF}
            tone={newOrdersCount && newOrdersCount > 0 ? 'attention' : 'neutral'}
          />
          <LiveMetric
            icon={<CircleOff aria-hidden />}
            value={outOfStockCount}
            label="Tugagan mahsulotlar"
            loading={outOfStockCount === null}
            href={STOCK_HREF}
            tone={outOfStockCount && outOfStockCount > 0 ? 'danger' : 'neutral'}
          />
          <LiveDivider />
          <LiveStatus
            state={liveState}
            updatedAt={lastUpdated}
            onRefresh={manualRefresh}
            isRefreshing={refreshing}
          />
        </>
      }
      actions={
        <>
          <IconButton
            aria-label={chime.enabled ? 'Ovozli signalni oʻchirish' : 'Ovozli signalni yoqish'}
            aria-pressed={chime.enabled}
            onClick={chime.toggle}
          >
            {chime.enabled ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
          </IconButton>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
