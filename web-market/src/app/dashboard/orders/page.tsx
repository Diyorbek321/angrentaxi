'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { marketApi, type MarketOrder, type MarketOrderStatus } from '@/lib/api';
import { KANBAN_COLUMNS } from '@/lib/orderStatus';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderKanbanColumn } from '@/components/orders/OrderKanbanColumn';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';

const POLL_MS = 30000;

export default function OrdersPage() {
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setStatus((s) => (s === 'ready' ? s : 'loading'));
    setRefreshing(true);
    try {
      const res = await marketApi.getOrders();
      if (!mounted.current) return;
      setOrders(res.data.data);
      setStatus('ready');
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      // A failed background poll must not blank a board the vendor is using.
      setError(err instanceof Error ? err.message : null);
      setStatus((s) => (s === 'ready' ? s : 'error'));
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const interval = setInterval(() => load(true), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [load]);

  const grouped = useMemo(() => {
    const map = {} as Record<MarketOrderStatus, MarketOrder[]>;
    KANBAN_COLUMNS.forEach((s) => {
      map[s] = [];
    });
    orders.forEach((o) => map[o.status]?.push(o));
    // Newest first inside every column — the freshest work sits at the top.
    KANBAN_COLUMNS.forEach((s) =>
      map[s].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
    return map;
  }, [orders]);

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;

  const applyUpdate = (updated: MarketOrder) =>
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  if (status === 'loading') {
    return (
      <div className="flex gap-3 h-full min-h-0">
        {KANBAN_COLUMNS.map((s) => (
          <Skeleton key={s} className="w-72 shrink-0 h-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return <ErrorState message={error} onRetry={() => load()} />;
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={24} />}
        title="Hozircha buyurtma yo'q"
        description="Yangi buyurtma kelganda shu yerda, «Yangi» ustunida paydo bo'ladi."
        tone="positive"
      />
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col animate-fade-in">
      <div className="shrink-0 flex items-center justify-end pb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => load(true)}
          isLoading={refreshing}
          leftIcon={<RefreshCw size={13} />}
        >
          Yangilash
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-1">
        {KANBAN_COLUMNS.map((columnStatus) => {
          const columnOrders = grouped[columnStatus];
          return (
            <OrderKanbanColumn
              key={columnStatus}
              status={columnStatus}
              count={columnOrders.length}
            >
              {columnOrders.length === 0 ? (
                <p className="text-xs text-subtle text-center py-6">Bo&apos;sh</p>
              ) : (
                columnOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onClick={() => setOpenOrderId(order.id)}
                  />
                ))
              )}
            </OrderKanbanColumn>
          );
        })}
      </div>

      {openOrder && (
        <OrderDetailModal
          order={openOrder}
          onClose={() => setOpenOrderId(null)}
          onUpdated={applyUpdate}
        />
      )}
    </div>
  );
}
