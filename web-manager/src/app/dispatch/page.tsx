'use client';

import { useCallback, useState } from 'react';
import { List, Map as MapIcon, RefreshCw } from 'lucide-react';
import { useDispatchData } from '@/components/dispatch/DispatchDataContext';
import { ActiveOrdersList } from '@/components/dispatch/ActiveOrdersList';
import { OnlineDriversList } from '@/components/dispatch/OnlineDriversList';
import { DriverMap } from '@/components/dispatch/DriverMap';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Order } from '@/lib/api';
import { formatNumber } from '@/lib/format';

type DriversView = 'map' | 'list';

const DRIVERS_VIEWS = [
  { value: 'map', label: 'Xarita', icon: <MapIcon size={13} aria-hidden /> },
  { value: 'list', label: 'Roʻyxat', icon: <List size={13} aria-hidden /> },
] as const;

/** Section header for the two live panels: title + count + optional controls. */
function PanelHeader({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="h-11 px-4 border-b border-line bg-surface flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-[13px] font-semibold text-ink truncate">{title}</h2>
        <span className="num text-[11px] h-[18px] min-w-[18px] px-1 inline-flex items-center justify-center rounded-ds-xs bg-surface-2 text-muted">
          {count}
        </span>
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

export default function DispatchPage() {
  // Orders and drivers come from the shell-level provider, so the topbar
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

  const [driversView, setDriversView] = useState<DriversView>('map');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // The topbar already shows active orders / online drivers / exceptions and
  // the connection state. This line adds only what it does not: how many
  // orders the algorithm is still matching and how many drivers are free.
  const searchingCount = orders.filter(
    (o) => o.status === 'searching' || o.status === 'created'
  ).length;
  const freeDriversCount = drivers.filter((d) => !d.currentOrderId).length;

  const handleOrderUpdated = useCallback((_order: Order) => {
    // No-op: WS updates handle this reactively via the dispatch provider
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
      <div className="px-4 sm:px-6 py-3 border-b border-line bg-surface flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-h1 text-ink">Jonli dispetcher</h1>
          <p className="text-[13px] text-muted">
            <span className="num">{formatNumber(searchingCount)}</span> ta buyurtma qidiruvda ·{' '}
            <span className="num">{formatNumber(freeDriversCount)}</span> ta boʻsh haydovchi
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefreshAll}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw size={13} aria-hidden />}
        >
          Yangilash
        </Button>
      </div>

      {/* Two-panel layout — stacks vertically below xl, side-by-side above.
          The feed never drops under 540px: the five status
          filters + counts need ~500px on one row (narrower → they wrap, never ellipsize). */}
      <div className="flex flex-col xl:flex-row flex-1 min-h-0">
        {/* Left: order feed */}
        <section
          aria-label="Aktiv buyurtmalar"
          className="flex-1 xl:flex-none xl:w-[40%] xl:min-w-[540px] xl:max-w-[560px] min-h-0 border-b xl:border-b-0 xl:border-r border-line flex flex-col overflow-hidden"
        >
          <PanelHeader title="Aktiv buyurtmalar" count={orders.length} />
          <div className="flex-1 overflow-y-auto p-3" aria-live="polite">
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

        {/* Right: live map / driver list */}
        <section aria-label="Onlayn haydovchilar" className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <PanelHeader title="Onlayn haydovchilar" count={drivers.length}>
            <SegmentedControl
              items={DRIVERS_VIEWS}
              value={driversView}
              onChange={setDriversView}
              size="sm"
              ariaLabel="Haydovchilar koʻrinishi"
            />
          </PanelHeader>

          <div className={driversView === 'list' ? 'flex-1 overflow-y-auto p-3' : 'flex-1 overflow-hidden'}>
            {driversView === 'list' ? (
              <OnlineDriversList
                drivers={drivers}
                isLoading={driversLoading}
                error={driversError}
                onRefetch={refetchDrivers}
              />
            ) : driversError ? (
              <ErrorState
                title="Haydovchilarni yuklab boʻlmadi"
                message={driversError}
                onRetry={refetchDrivers}
                className="h-full"
              />
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
