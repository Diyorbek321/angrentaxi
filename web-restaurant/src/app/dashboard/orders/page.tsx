'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shortId } from '@/lib/format';
import { Inbox, Maximize2 } from 'lucide-react';
import { foodApi, FoodOrder, Restaurant } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { NEXT_STATUS, statusMeta } from '@/lib/order-status';
import { trackNewOrders } from '@/lib/order-alerts';
import { useKiosk } from '@/lib/kiosk-context';
import { usePageRefresh } from '@/components/shell';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderDrawer } from '@/components/orders/OrderDrawer';
import { QueueTabEmpty } from '@/components/orders/QueueTabEmpty';
import { RejectModal } from '@/components/orders/RejectModal';
import { groupOrders, TAB_LABEL, TAB_ORDER, type QueueTab } from '@/components/orders/queue';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StaleDataBanner } from '@/components/ui/PollStatus';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton, SkeletonCards } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

const ORDERS_POLL_MS = 15_000;

export default function OrdersPage() {
  const { toast } = useToast();
  const { kiosk, setKiosk } = useKiosk();
  const [tab, setTab] = useState<QueueTab>('new');
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Ovoz sozlamasi restoran profilidan — bir marta yuklanadi, poll shart emas.
  const loadRestaurant = useCallback(async (): Promise<Restaurant> => {
    const res = await foodApi.getRestaurant();
    return res.data.data;
  }, []);
  const restaurantData = useAsyncData<Restaurant>(loadRestaurant);
  const soundOnRef = useRef(false);
  soundOnRef.current = restaurantData.data?.notifications.sound ?? false;

  const load = useCallback(async (): Promise<FoodOrder[]> => {
    const res = await foodApi.getOrders();
    const orders = res.data.data;
    // Signal POLL natijasidan otiladi (ramkaning 30 s poll'i bilan dedup
    // modul ichida) — operator ekranga qaramasa ham eshitadi.
    trackNewOrders(orders, soundOnRef.current);
    return orders;
  }, []);

  const { data, status, error, isRefreshing, lastUpdatedAt, reload } = useAsyncData<FoodOrder[]>(load, {
    pollMs: ORDERS_POLL_MS,
  });
  useRealtimeRefresh(reload);
  usePageRefresh(reload);
  const orders = useMemo(() => data ?? [], [data]);

  // Taymer sekundlik — faqat ko'rsatkichni qayta chizadi, so'rov yubormaydi.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const grouped = useMemo(() => groupOrders(orders), [orders]);
  const tabItems = useMemo(
    () => TAB_ORDER.map((t) => ({ value: t, label: TAB_LABEL[t], count: grouped[t].length })),
    [grouped]
  );

  const runAction = async (order: FoodOrder, action: () => Promise<unknown>, ok: string, fail: string) => {
    setBusyId(order.id);
    try {
      await action();
      await reload();
      toast({ title: ok, variant: 'success' });
    } catch {
      toast({ title: fail, description: 'Qayta urinib koʻring', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const advance = (order: FoodOrder) => {
    const next = NEXT_STATUS[order.status];
    return runAction(
      order,
      () => (order.status === 'new' ? foodApi.acceptOrder(order.id) : foodApi.advanceOrder(order.id)),
      `${shortId(order.id)} — ${next ? statusMeta(next).label : 'yangilandi'}`,
      'Holatni oʻzgartirib boʻlmadi'
    );
  };

  const redispatch = (order: FoodOrder) =>
    runAction(
      order,
      () => foodApi.redispatchOrder(order.id),
      `${shortId(order.id)} — kuryer qayta izlanmoqda`,
      'Kuryerni chaqirib boʻlmadi'
    );

  const decideCash = async (order: FoodOrder, received: boolean) => {
    setBusyId(order.id);
    try {
      await foodApi.cashReceived(order.id, received);
      await reload();
      toast({
        title: received ? 'Naqd pul olindi' : 'Dispetcherga xabar berildi',
        variant: received ? 'success' : 'info',
      });
    } catch {
      toast({ title: 'Saqlab boʻlmadi', description: 'Qayta urinib koʻring', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async (reason: string) => {
    if (!rejectId) return;
    try {
      await foodApi.rejectOrder(rejectId, reason);
      toast({ title: 'Buyurtma rad etildi', description: reason, variant: 'info' });
    } catch {
      toast({ title: 'Rad etib boʻlmadi', variant: 'error' });
    } finally {
      setRejectId(null);
      await reload();
    }
  };

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;
  const visible = grouped[tab];

  return (
    <div className="flex flex-col">
      {!kiosk && (
        <PageHeader
          title="Buyurtmalar"
          description="Oshxona navbati — har tabda eng eski buyurtma birinchi"
          actions={
            <Button variant="secondary" leftIcon={<Maximize2 size={14} />} onClick={() => setKiosk(true)}>
              Oshxona ekrani
            </Button>
          }
        />
      )}

      {status === 'loading' && (
        <div className="flex flex-col gap-4" role="status" aria-label="Buyurtmalar yuklanmoqda">
          <Skeleton className="h-9 w-full max-w-md rounded-ds-sm" />
          <SkeletonCards count={6} height="h-64" columns />
        </div>
      )}

      {status === 'error' && <ErrorState title="Buyurtmalarni yuklab boʻlmadi" message={error} onRetry={reload} />}

      {status === 'ready' && (
        <div className="flex flex-col gap-4">
          {/* Fon yangilanishi uzilsa — oxirgi yaxshi ma'lumot qoladi, banner belgilaydi. */}
          <StaleDataBanner error={error} lastUpdatedAt={lastUpdatedAt} onRetry={reload} isRetrying={isRefreshing} />

          <SegmentedControl
            items={tabItems}
            value={tab}
            onChange={setTab}
            label="Oshxona holati boʻyicha navbat"
            // Planshet: barmoq uchun 40px segmentlar; kioskda butun qator.
            size="lg"
            fullWidth={kiosk}
            className={kiosk ? undefined : 'self-start'}
          />

          {orders.length === 0 ? (
            <EmptyState
              variant="first-use"
              tone="positive"
              icon={<Inbox size={20} />}
              title="Hozircha buyurtma yoʻq"
              description="Yangi buyurtma kelganda ovozli signal chalinadi, karta shu yerda paydo boʻladi va yon menyuda hisoblanadi."
            />
          ) : visible.length === 0 ? (
            <QueueTabEmpty tab={tab} newCount={grouped.new.length} onGoToNew={() => setTab('new')} />
          ) : (
            <div
              className={cn(
                'grid content-start',
                kiosk ? 'gap-5 md:grid-cols-2 2xl:grid-cols-3' : 'gap-4 md:grid-cols-2 2xl:grid-cols-3'
              )}
            >
              {visible.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  kiosk={kiosk}
                  now={now}
                  busy={busyId === order.id}
                  onOpen={() => setOpenOrderId(order.id)}
                  onAdvance={() => advance(order)}
                  onReject={() => setRejectId(order.id)}
                  onRedispatch={() => redispatch(order)}
                  onCashDecision={(received) => decideCash(order, received)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <OrderDrawer
        order={openOrder}
        busy={busyId != null}
        onClose={() => setOpenOrderId(null)}
        onAdvance={() => openOrder && advance(openOrder)}
        onReject={() => {
          if (!openOrder) return;
          setRejectId(openOrder.id);
          setOpenOrderId(null);
        }}
      />

      <RejectModal isOpen={rejectId != null} onClose={() => setRejectId(null)} onConfirm={confirmReject} />
    </div>
  );
}
