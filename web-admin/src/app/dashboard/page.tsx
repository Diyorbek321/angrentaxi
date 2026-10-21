'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  DataTable,
  ErrorState,
  MoneyText,
  PageHeader,
  PlateNumber,
  SkeletonStats,
  StatCard,
  type DataTableColumn,
} from '@/components/ui';
import { OrdersChart, RevenueChart } from '@/components/charts/lazy';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { DriverStatusBadge } from '@/components/drivers/DriverStatusBadge';
import {
  dashboardApi,
  driversApi,
  ordersApi,
  reportsApi,
  type DashboardStats,
  type Driver,
  type Order,
  type RevenueDataPoint,
} from '@/lib/api';
import { formatMoney, formatNumber, formatRating, formatTime, fullName } from '@/lib/format';
import { t } from '@/locales';

const DATE_FMT = 'yyyy-MM-dd';
const TREND_DAYS = 7;

function ViewAll({ href }: { href: string }) {
  return (
    <Button href={href} variant="ghost" size="sm" rightIcon={<ArrowRight size={13} aria-hidden />}>
      {t().common.allAlt}
    </Button>
  );
}

function orderColumns(): DataTableColumn<Order>[] {
  const m = t().dashboard.columns;
  return [
    {
      key: 'passenger',
      header: m.passenger,
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{fullName(o.passenger?.firstName, o.passenger?.lastName)}</p>
          <p className="truncate text-xs text-muted">{o.pickupAddress ?? '—'}</p>
        </div>
      ),
      className: 'max-w-[220px]',
    },
    { key: 'time', header: m.time, cell: (o) => formatTime(o.createdAt), numeric: true, hideBelow: 'md' },
    { key: 'status', header: m.status, cell: (o) => <OrderStatusBadge status={o.status} /> },
    {
      key: 'price',
      header: m.price,
      numeric: true,
      cell: (o) => <MoneyText value={o.finalPrice ?? o.estimatedPrice} />,
    },
  ];
}

function driverColumns(): DataTableColumn<Driver>[] {
  const m = t().dashboard.columns;
  return [
    {
      key: 'name',
      header: m.driver,
      cell: (d) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar firstName={d.firstName} lastName={d.lastName} size="xs" tone="mint" />
          <span className="truncate font-medium">{fullName(d.firstName, d.lastName)}</span>
        </div>
      ),
      className: 'max-w-[200px]',
    },
    { key: 'plate', header: m.plate, cell: (d) => <PlateNumber plate={d.carNumber} /> },
    { key: 'rating', header: m.rating, numeric: true, cell: (d) => formatRating(d.rating), hideBelow: 'md' },
    { key: 'status', header: m.status, cell: (d) => <DriverStatusBadge status={d.status} isOnline={d.isOnline} /> },
  ];
}

/**
 * Inverted pyramid: "are we OK?" KPIs on top (most important top-left),
 * 7-day trends in the middle, recent detail at the bottom.
 *
 * No deltas and no sparklines on purpose: /orders/stats has no previous
 * period to compare against, and a delta is only drawn from real data.
 */
export default function DashboardPage() {
  const m = t().dashboard;
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<RevenueDataPoint[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, ordersRes, driversRes] = await Promise.all([
        dashboardApi.getStats(),
        ordersApi.getAll({ page: 1, limit: 5 }),
        driversApi.getAll({ page: 1, limit: 5, isOnline: true }),
      ]);
      setStats(statsRes.data.data);
      setRecentOrders(ordersRes.data.data?.orders ?? []);
      setOnlineDrivers(driversRes.data.data?.drivers ?? []);
      setError(null);
    } catch {
      setError(m.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trends load separately: KPIs first, charts after — a failed trend request
  // never blanks the numbers above it.
  const fetchTrends = useCallback(async () => {
    setTrendsLoading(true);
    try {
      const res = await reportsApi.getData({
        from: format(subDays(new Date(), TREND_DAYS), DATE_FMT),
        to: format(new Date(), DATE_FMT),
      });
      setTrendData(res.data.data?.revenueChart ?? []);
      setTrendsError(null);
    } catch {
      setTrendsError(m.trendsFailed);
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    void fetchTrends();
  }, [fetchData, fetchTrends]);

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader title={m.title} description={m.description} />

      {error && !stats ? (
        <Card padding="none">
          <ErrorState message={error} onRetry={fetchData} retrying={isLoading} />
        </Card>
      ) : (
        <div className="space-y-5">
          {isLoading && !stats ? (
            <SkeletonStats count={5} className="sm:grid-cols-3 xl:grid-cols-5" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <StatCard label={m.ordersToday} value={formatNumber(stats?.ordersToday)} />
              <StatCard
                label={m.revenueToday}
                value={formatMoney(stats?.revenueToday, { currency: false })}
                unit={m.som}
              />
              <StatCard
                label={m.onlineDrivers}
                value={formatNumber(stats?.onlineDrivers)}
                hint={stats ? m.ofActiveDrivers(formatNumber(stats.activeDrivers)) : undefined}
              />
              <StatCard
                label={m.pendingApprovals}
                value={formatNumber(stats?.pendingDriverApprovals)}
                hint={m.driverApplications}
                onClick={() => router.push('/dashboard/drivers?status=pending')}
              />
              <StatCard label={m.totalUsers} value={formatNumber(stats?.totalUsers)} />
            </div>
          )}

          {trendsError && !trendsLoading ? (
            <Card padding="none">
              <CardHeader title={m.trends} />
              <ErrorState compact message={trendsError} onRetry={fetchTrends} />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <OrdersChart data={trendData} isLoading={trendsLoading} description={m.last7Days} />
              <RevenueChart data={trendData} isLoading={trendsLoading} description={m.last7Days} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <section aria-label={m.recentOrders} className="min-w-0">
              <DataTable
                title={m.recentOrders}
                actions={<ViewAll href="/dashboard/orders" />}
                ariaLabel={m.recentOrders}
                columns={orderColumns()}
                rows={recentOrders}
                rowKey={(o) => o.id}
                loading={isLoading}
                error={error}
                onRetry={fetchData}
                onRowClick={(o) => router.push(`/dashboard/orders/${o.id}`)}
                empty={{
                  title: m.noOrders,
                  description: m.noOrdersDesc,
                }}
              />
            </section>

            <section aria-label={m.onlineDrivers} className="min-w-0">
              <DataTable
                title={m.onlineDrivers}
                actions={<ViewAll href="/dashboard/drivers?status=online" />}
                ariaLabel={m.onlineDrivers}
                columns={driverColumns()}
                rows={onlineDrivers}
                rowKey={(d) => d.id}
                loading={isLoading}
                error={error}
                onRetry={fetchData}
                onRowClick={(d) => router.push(`/dashboard/drivers/${d.id}`)}
                empty={{
                  title: m.noDrivers,
                  description: m.noDriversDesc,
                }}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
