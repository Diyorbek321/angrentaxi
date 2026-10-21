'use client';

import { useCallback } from 'react';
import { ClipboardList, Clock, Inbox, UtensilsCrossed, Wallet } from 'lucide-react';
import { foodApi, DashboardData } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { formatMoney, formatNumber, formatTime, shortId } from '@/lib/format';
import { usePageRefresh } from '@/components/shell';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { StaleDataBanner } from '@/components/ui/PollStatus';
import { SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { t, type Messages } from '@/locales';

type RecentOrder = DashboardData['recentOrders'][number];

// Funksiya: ustun sarlavhalari faol tilda (modul darajasida qotib qolmasin).
const columns = (m: Messages['dashboard'], common: Messages['common']): DataTableColumn<RecentOrder>[] => [
  {
    key: 'customer',
    header: m.colCustomer,
    cell: (o) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{o.customer?.trim() || m.customerFallback}</p>
        <p className="font-mono text-xs text-subtle">{shortId(o.id)}</p>
      </div>
    ),
  },
  { key: 'items', header: m.colItems, numeric: true, cell: (o) => common.count(formatNumber(o.itemsCount)), hideBelow: 'sm' },
  { key: 'total', header: m.colTotal, numeric: true, cell: (o) => <MoneyText value={o.totalPrice} /> },
  { key: 'status', header: m.colStatus, cell: (o) => <OrderStatusBadge status={o.status} size="sm" /> },
  { key: 'time', header: m.colTime, numeric: true, cell: (o) => formatTime(o.createdAt), hideBelow: 'md' },
];

export default function DashboardPage() {
  const { dashboard: m, common } = t();
  const load = useCallback(async (): Promise<DashboardData> => {
    const res = await foodApi.getDashboard();
    return res.data.data;
  }, []);

  const { data, status, error, isRefreshing, lastUpdatedAt, reload } = useAsyncData<DashboardData>(load, {
    pollMs: 30000,
  });
  useRealtimeRefresh(reload);
  usePageRefresh(reload);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title={m.title} description={m.description} />

      {status === 'loading' && (
        <div className="flex flex-col gap-5">
          <SkeletonStats count={4} />
          <SkeletonTable rows={5} cols={5} />
        </div>
      )}

      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && data && (
        <div className="flex flex-col gap-5">
          {/* Fon yangilanishi uzilsa — oxirgi yaxshi ma'lumot qoladi va belgilanadi. */}
          <StaleDataBanner error={error} lastUpdatedAt={lastUpdatedAt} onRetry={reload} isRetrying={isRefreshing} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={m.todayOrders}
              value={formatNumber(data.todayOrdersCount)}
              icon={<ClipboardList aria-hidden />}
              live
            />
            <StatCard
              label={m.todayRevenue}
              value={formatMoney(data.todayRevenue, { currency: false })}
              unit={common.som}
              icon={<Wallet aria-hidden />}
            />
            <StatCard
              label={m.avgPrep}
              value={formatNumber(data.avgPrepMinutes)}
              unit={m.minutesUnit}
              icon={<Clock aria-hidden />}
              hint={m.last30Days}
            />
            <StatCard
              label={m.activeDishes}
              value={formatNumber(data.activeDishesCount)}
              icon={<UtensilsCrossed aria-hidden />}
            />
          </div>

          <DataTable
            title={m.recentOrders}
            actions={
              <Button variant="ghost" size="sm" href="/dashboard/orders">
                {m.all}
              </Button>
            }
            ariaLabel={m.recentOrders}
            columns={columns(m, common)}
            rows={data.recentOrders}
            rowKey={(o) => o.id}
            empty={{
              variant: 'first-use',
              icon: <Inbox size={20} />,
              title: m.emptyTitle,
              description: m.emptyDescription,
              action: (
                <Button variant="secondary" href="/dashboard/orders">
                  {m.queueButton}
                </Button>
              ),
            }}
          />
        </div>
      )}
    </div>
  );
}
