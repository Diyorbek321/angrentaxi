'use client';

import { useCallback, useState } from 'react';
import { List, Loader2, Map as MapIcon, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { useSocket } from '@/hooks/useSocket';
import { useDispatchData } from '@/components/dispatch/DispatchDataContext';
import { ActiveOrdersList } from '@/components/dispatch/ActiveOrdersList';
import { OnlineDriversList } from '@/components/dispatch/OnlineDriversList';
import { DriverMap } from '@/components/dispatch/DriverMap';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { Order } from '@/lib/api';

/** Small "the socket is feeding this panel" indicator. */
function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={clsx(
        'flex items-center gap-1.5 text-[11px]',
        connected ? 'text-primary-700 dark:text-primary-300' : 'text-subtle'
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          connected ? 'bg-primary animate-pulse' : 'bg-line-strong'
        )}
      />
      Jonli
    </span>
  );
}

function PanelHeader({
  title,
  count,
  connected,
  children,
}: {
  title: string;
  count: number;
  connected: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5 border-b border-line bg-surface flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-surface-2 text-muted">
          {count}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {children}
        <LiveDot connected={connected} />
      </div>
    </div>
  );
}

export default function DispatchPage() {
  // Orders and drivers come from the shell-level provider, so the header
  // counters and this screen share one set of requests and socket listeners.
  const {
    orders,
    ordersLoading,
    ordersError,
    refetchOrders,
    drivers,
    driversLoading,
    driversError,
    refetchDrivers,
  } = useDispatchData();

  const { status: socketStatus } = useSocket();
  const [driversView, setDriversView] = useState<'map' | 'list'>('map');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const connected = socketStatus === 'connected';

  // Derived stats
  const searchingCount = orders.filter(
    (o) => o.status === 'searching' || o.status === 'created'
  ).length;
  const assignedCount = orders.filter(
    (o) => o.status === 'accepted' || o.status === 'arrived'
  ).length;
  const inProgressCount = orders.filter((o) => o.status === 'in_progress').length;
  const availableDriversCount = drivers.filter((d) => !d.currentOrderId).length;

  const handleOrderUpdated = useCallback((_order: Order) => {
    // No-op: WS updates handle this reactively via useActiveOrders
  }, []);

  const handleOrderCancelled = useCallback((_orderId: string) => {
    // No-op: WS updates handle this reactively
  }, []);

  const handleRefreshAll = async () => {
    await Promise.all([refetchOrders(), refetchDrivers()]);
  };

  const isRefreshing = ordersLoading || driversLoading;

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Stats bar */}
      <div className="border-b border-line bg-surface px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-ink">Jonli dispetcher</h1>
            {isRefreshing && <Loader2 size={14} className="text-muted animate-spin" />}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefreshAll}
            leftIcon={<RefreshCw size={13} />}
          >
            Yangilash
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
          <StatTile label="Qidirilmoqda" value={searchingCount} tone="override" live={searchingCount > 0} />
          <StatTile label="Tayinlangan" value={assignedCount} tone="info" />
          <StatTile label="Yoʻlda" value={inProgressCount} tone="mint" />
          <StatTile label="Onlayn haydovchilar" value={drivers.length} tone="neutral" />
          <StatTile label="Boʻsh haydovchilar" value={availableDriversCount} tone="mint" />
        </div>
      </div>

      {/* Two-panel layout — stacks vertically below xl, side-by-side above */}
      <div className="flex flex-col xl:flex-row flex-1 min-h-0">
        {/* Left: order flow */}
        <section className="flex-1 xl:flex-none xl:w-[40%] min-h-0 border-b xl:border-b-0 xl:border-r border-line flex flex-col overflow-hidden">
          <PanelHeader title="Aktiv buyurtmalar" count={orders.length} connected={connected} />
          <div className="flex-1 overflow-y-auto p-3">
            <ActiveOrdersList
              orders={orders}
              isLoading={ordersLoading}
              error={ordersError}
              onRefetch={refetchOrders}
              onOrderUpdated={handleOrderUpdated}
              onOrderCancelled={handleOrderCancelled}
              drivers={drivers}
              selectedOrderId={selectedOrder?.id ?? null}
              onSelectOrder={setSelectedOrder}
            />
          </div>
        </section>

        {/* Right: live map */}
        <section className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <PanelHeader title="Onlayn haydovchilar" count={drivers.length} connected={connected}>
            <div className="flex items-center rounded-lg border border-line p-0.5">
              <button
                type="button"
                onClick={() => setDriversView('map')}
                className={clsx(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                  driversView === 'map'
                    ? 'bg-surface-2 text-ink font-medium'
                    : 'text-muted hover:text-ink'
                )}
              >
                <MapIcon size={12} />
                Xarita
              </button>
              <button
                type="button"
                onClick={() => setDriversView('list')}
                className={clsx(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                  driversView === 'list'
                    ? 'bg-surface-2 text-ink font-medium'
                    : 'text-muted hover:text-ink'
                )}
              >
                <List size={12} />
                Roʻyxat
              </button>
            </div>
          </PanelHeader>

          <div
            className={
              driversView === 'list' ? 'flex-1 overflow-y-auto p-3' : 'flex-1 overflow-hidden'
            }
          >
            {driversView === 'list' ? (
              <OnlineDriversList
                drivers={drivers}
                isLoading={driversLoading}
                error={driversError}
                onRefetch={refetchDrivers}
              />
            ) : driversError ? (
              <div className="h-full flex items-center justify-center p-6">
                <p className="text-sm text-danger">{driversError}</p>
              </div>
            ) : (
              <DriverMap
                drivers={drivers}
                isLoading={driversLoading}
                selectedOrder={selectedOrder}
                onClearSelection={() => setSelectedOrder(null)}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
