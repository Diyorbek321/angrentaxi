'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, CircleOff, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWalletSettlementToasts } from '@/hooks/useVendorSettlement';
import { marketApi, type Store } from '@/lib/api';
import { fullName, shortId } from '@/lib/format';
import { disappearedIds, isCustomerCancelled } from '@/lib/order-extras';
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
import { useToast } from '@/components/ui/Toast';
import { marketNav, ORDERS_HREF, STOCK_HREF } from './nav-config';
import { t } from '@/locales';
import { useNewOrderChime } from './useNewOrderChime';

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
 * "Yangi" ro'yxatidan chiqqan buyurtmalarni tekshiradi: mijoz bekor qilgan
 * bo'lsa — ovozsiz toast. Sotuvchi o'zi qabul qilgani ham shu yerdan o'tadi,
 * lekin `cancelledBy` bo'lmagani uchun jim qoladi. Xato — jim (poll davom etadi).
 */
async function notifyCustomerCancels(
  ids: readonly string[],
  toast: ReturnType<typeof useToast>['toast']
): Promise<void> {
  const results = await Promise.allSettled(ids.slice(0, 10).map((id) => marketApi.getOrder(id)));
  results.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    const order = r.value.data.data;
    if (!isCustomerCancelled(order)) return;
    const reason = order.cancelReason?.trim();
    const m = t().shell;
    toast({
      title: m.customerCancelled(shortId(order.id)),
      description: reason ? m.reason(reason) : m.noReason,
      variant: 'info',
    });
  });
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
  const m = t();
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
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  /** Oldingi poll'dagi "yangi" buyurtmalar — ro'yxatdan chiqqani bekor qilingan bo'lishi mumkin. */
  const prevNewIds = useRef<string[] | null>(null);

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
      const newIds = ordersRes.data.data.map((o) => o.id);
      const gone = disappearedIds(prevNewIds.current, newIds);
      prevNewIds.current = newIds;
      if (gone.length > 0) void notifyCustomerCancels(gone, toastRef.current);
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
  // Hamyon o'tkazmasi (va teskarisi) — qaysi sahifada bo'lmasin toast.
  useWalletSettlementToasts(isAuthenticated);
  const socketConnected = useSocketConnected(isAuthenticated);

  // Fon tabida ham ko'rinsin: yangi buyurtma soni brauzer tab sarlavhasida.
  useEffect(() => {
    const baseTitle = t().meta.title;
    document.title =
      newOrdersCount && newOrdersCount > 0 ? t().shell.newOrdersTitle(newOrdersCount) : baseTitle;
    return () => {
      document.title = baseTitle;
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
      marketNav().map((group) => ({
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
    const seller = t().shell.seller;
    const owner = fullName(user.firstName, user.lastName, seller);
    return {
      name: store?.name ?? null,
      firstName: store ? null : user.firstName,
      lastName: store ? null : user.lastName,
      phone: user.phone,
      role: store ? owner : seller,
    };
  }, [user, store]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-bg" aria-busy="true" aria-live="polite">
        <span className="sr-only">{m.common.loading}</span>
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
      brand={{ name: m.brand.name, subtitle: m.brand.subtitle, href: '/dashboard' }}
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
              {storeOpen ? m.shell.open : m.shell.closed}
            </Badge>
          )}
          <LiveMetric
            icon={<BellRing aria-hidden />}
            value={newOrdersCount}
            label={m.shell.newOrders}
            loading={newOrdersCount === null}
            href={ORDERS_HREF}
            tone={newOrdersCount && newOrdersCount > 0 ? 'attention' : 'neutral'}
          />
          <LiveMetric
            icon={<CircleOff aria-hidden />}
            value={outOfStockCount}
            label={m.shell.outOfStock}
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
            aria-label={chime.enabled ? m.shell.chimeOff : m.shell.chimeOn}
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
