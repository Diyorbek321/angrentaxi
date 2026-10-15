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

const DATE_FMT = 'yyyy-MM-dd';
const TREND_DAYS = 7;

function ViewAll({ href }: { href: string }) {
  return (
    <Button href={href} variant="ghost" size="sm" rightIcon={<ArrowRight size={13} aria-hidden />}>
      Barchasi
    </Button>
  );
}

const orderColumns: DataTableColumn<Order>[] = [
  {
    key: 'passenger',
    header: 'Yoʻlovchi',
    cell: (o) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{fullName(o.passenger?.firstName, o.passenger?.lastName)}</p>
        <p className="truncate text-xs text-muted">{o.pickupAddress ?? '—'}</p>
      </div>
    ),
    className: 'max-w-[220px]',
  },
  { key: 'time', header: 'Vaqt', cell: (o) => formatTime(o.createdAt), numeric: true, hideBelow: 'md' },
  { key: 'status', header: 'Holat', cell: (o) => <OrderStatusBadge status={o.status} /> },
  {
    key: 'price',
    header: 'Narx',
    numeric: true,
    cell: (o) => <MoneyText value={o.finalPrice ?? o.estimatedPrice} />,
  },
];

const driverColumns: DataTableColumn<Driver>[] = [
  {
    key: 'name',
    header: 'Haydovchi',
    cell: (d) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar firstName={d.firstName} lastName={d.lastName} size="xs" tone="mint" />
        <span className="truncate font-medium">{fullName(d.firstName, d.lastName)}</span>
      </div>
    ),
    className: 'max-w-[200px]',
  },
  { key: 'plate', header: 'Davlat raqami', cell: (d) => <PlateNumber plate={d.carNumber} /> },
  { key: 'rating', header: 'Reyting', numeric: true, cell: (d) => formatRating(d.rating), hideBelow: 'md' },
  { key: 'status', header: 'Holat', cell: (d) => <DriverStatusBadge status={d.status} isOnline={d.isOnline} /> },
];

/**
 * Inverted pyramid: "are we OK?" KPIs on top (most important top-left),
 * 7-day trends in the middle, recent detail at the bottom.
 *
 * No deltas and no sparklines on purpose: /orders/stats has no previous
 * period to compare against, and a delta is only drawn from real data.
 */
export default function DashboardPage() {
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
      setError('Bosh sahifa maʼlumotlarini yuklab boʻlmadi.');
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
      setTrendsError('Trend maʼlumotlarini yuklab boʻlmadi.');
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
      <PageHeader title="Bosh sahifa" description="Bugungi holat va soʻnggi 7 kunlik trendlar" />

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
              <StatCard label="Bugungi buyurtmalar" value={formatNumber(stats?.ordersToday)} />
              <StatCard
                label="Bugungi daromad"
                value={formatMoney(stats?.revenueToday, { currency: false })}
                unit="soʻm"
              />
              <StatCard
                label="Onlayn haydovchilar"
                value={formatNumber(stats?.onlineDrivers)}
                hint={stats ? `${formatNumber(stats.activeDrivers)} ta faol haydovchidan` : undefined}
              />
              <StatCard
                label="Tasdiq kutmoqda"
                value={formatNumber(stats?.pendingDriverApprovals)}
                hint="Haydovchi arizalari"
                onClick={() => router.push('/dashboard/drivers?status=pending')}
              />
              <StatCard label="Jami foydalanuvchilar" value={formatNumber(stats?.totalUsers)} />
            </div>
          )}

          {trendsError && !trendsLoading ? (
            <Card padding="none">
              <CardHeader title="Trendlar" />
              <ErrorState compact message={trendsError} onRetry={fetchTrends} />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <OrdersChart data={trendData} isLoading={trendsLoading} description="Soʻnggi 7 kun" />
              <RevenueChart data={trendData} isLoading={trendsLoading} description="Soʻnggi 7 kun" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <section aria-label="Oxirgi buyurtmalar" className="min-w-0">
              <DataTable
                title="Oxirgi buyurtmalar"
                actions={<ViewAll href="/dashboard/orders" />}
                ariaLabel="Oxirgi buyurtmalar"
                columns={orderColumns}
                rows={recentOrders}
                rowKey={(o) => o.id}
                loading={isLoading}
                error={error}
                onRetry={fetchData}
                onRowClick={(o) => router.push(`/dashboard/orders/${o.id}`)}
                empty={{
                  title: 'Hozircha buyurtmalar yoʻq',
                  description: 'Yangi buyurtmalar shu yerda koʻrinadi.',
                }}
              />
            </section>

            <section aria-label="Onlayn haydovchilar" className="min-w-0">
              <DataTable
                title="Onlayn haydovchilar"
                actions={<ViewAll href="/dashboard/drivers?status=online" />}
                ariaLabel="Onlayn haydovchilar"
                columns={driverColumns}
                rows={onlineDrivers}
                rowKey={(d) => d.id}
                loading={isLoading}
                error={error}
                onRetry={fetchData}
                onRowClick={(d) => router.push(`/dashboard/drivers/${d.id}`)}
                empty={{
                  title: 'Onlayn haydovchilar yoʻq',
                  description: 'Haydovchi onlayn boʻlishi bilan shu yerda koʻrinadi.',
                }}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
