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

type RecentOrder = DashboardData['recentOrders'][number];

const COLUMNS: DataTableColumn<RecentOrder>[] = [
  {
    key: 'customer',
    header: 'Mijoz',
    cell: (o) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{o.customer?.trim() || 'Mijoz'}</p>
        <p className="font-mono text-xs text-subtle">{shortId(o.id)}</p>
      </div>
    ),
  },
  { key: 'items', header: 'Taomlar', numeric: true, cell: (o) => `${formatNumber(o.itemsCount)} ta`, hideBelow: 'sm' },
  { key: 'total', header: 'Summa', numeric: true, cell: (o) => <MoneyText value={o.totalPrice} /> },
  { key: 'status', header: 'Holat', cell: (o) => <OrderStatusBadge status={o.status} size="sm" /> },
  { key: 'time', header: 'Vaqt', numeric: true, cell: (o) => formatTime(o.createdAt), hideBelow: 'md' },
];

export default function DashboardPage() {
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
      <PageHeader title="Bosh sahifa" description="Bugungi faoliyat koʻrsatkichlari" />

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
              label="Bugungi buyurtmalar"
              value={formatNumber(data.todayOrdersCount)}
              icon={<ClipboardList aria-hidden />}
              live
            />
            <StatCard
              label="Bugungi tushum"
              value={formatMoney(data.todayRevenue, { currency: false })}
              unit="soʻm"
              icon={<Wallet aria-hidden />}
            />
            <StatCard
              label="Oʻrtacha tayyorlash"
              value={formatNumber(data.avgPrepMinutes)}
              unit="daq"
              icon={<Clock aria-hidden />}
              hint="Oxirgi 30 kun boʻyicha"
            />
            <StatCard
              label="Faol taomlar"
              value={formatNumber(data.activeDishesCount)}
              icon={<UtensilsCrossed aria-hidden />}
            />
          </div>

          <DataTable
            title="Soʻnggi buyurtmalar"
            actions={
              <Button variant="ghost" size="sm" href="/dashboard/orders">
                Barchasi
              </Button>
            }
            ariaLabel="Soʻnggi buyurtmalar"
            columns={COLUMNS}
            rows={data.recentOrders}
            rowKey={(o) => o.id}
            empty={{
              variant: 'first-use',
              icon: <Inbox size={20} />,
              title: 'Bugun hali buyurtma yoʻq',
              description: 'Yangi buyurtma kelganda u shu yerda va Buyurtmalar sahifasida koʻrinadi.',
              action: (
                <Button variant="secondary" href="/dashboard/orders">
                  Buyurtmalar navbati
                </Button>
              ),
            }}
          />
        </div>
      )}
    </div>
  );
}
