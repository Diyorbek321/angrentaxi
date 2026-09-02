'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import {
  Users,
  Car,
  ClipboardList,
  Banknote,
  Clock,
  LayoutDashboard,
  Inbox,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonStats, SkeletonCards } from '@/components/ui/Skeleton';
import { OrdersChart } from '@/components/charts/OrdersChart';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { DriverStatusBadge } from '@/components/drivers/DriverStatusBadge';
import {
  dashboardApi,
  DashboardStats,
  ordersApi,
  driversApi,
  reportsApi,
  Order,
  Driver,
  RevenueDataPoint,
} from '@/lib/api';
import { cn, formatCurrency, getFullName } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

const DATE_FMT = 'yyyy-MM-dd';

const viewAllLink = cn(
  'inline-flex items-center gap-1 rounded-ds-xs text-caption font-semibold text-primary-text',
  'transition-colors duration-fast hover:underline',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
);

/**
 * Teskari piramida: tepada "hammasi joyidami?" (5 ta KPI, eng muhimi chap
 * yuqorida), o'rtada harakatni tushuntiruvchi 7 kunlik trendlar, pastda
 * detal (oxirgi buyurtmalar, onlayn haydovchilar) va drill-down havolalar.
 *
 * DELTA YO'Q — bu qaror: /orders/stats o'tgan-davr taqqoslamasini bermaydi,
 * delta esa faqat haqiqiy ma'lumotdan chiziladi. Sparkline'lar reports
 * API'sining HAQIQIY 7 kunlik seriyasidan keladi.
 */
export default function DashboardPage() {
  const { toast } = useToast();
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
      const message = "Ma'lumotlarni yuklashda xatolik";
      setError(message);
      toast({ title: 'Xatolik', description: message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Trendlar alohida yuklanadi: KPI'lar birinchi, diagrammalar keyin —
  // trend so'rovi yiqilsa ham yuqoridagi javob ekranda qoladi.
  const fetchTrends = useCallback(async () => {
    setTrendsLoading(true);
    try {
      const res = await reportsApi.getData({
        from: format(subDays(new Date(), 7), DATE_FMT),
        to: format(new Date(), DATE_FMT),
      });
      setTrendData(res.data.data?.revenueChart ?? []);
      setTrendsError(null);
    } catch {
      setTrendsError('Trend maʼlumotlarini yuklashda xatolik');
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchTrends();
  }, [fetchData, fetchTrends]);

  const ordersSparkline = trendData.map((d) => d.orders);
  const revenueSparkline = trendData.map((d) => d.revenue);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Bosh sahifa"
        description="Tizimning umumiy ko'rinishi"
        icon={<LayoutDashboard className="h-4 w-4" />}
      />

      {error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <div className="space-y-6">
          {/* 1-qavat: KPI'lar — eng muhimi (bugungi buyurtmalar) chap yuqorida */}
          {isLoading ? (
            <SkeletonStats count={5} className="sm:grid-cols-2 xl:grid-cols-5" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                title="Bugungi buyurtmalar"
                value={stats?.ordersToday?.toLocaleString('uz-UZ') ?? '—'}
                icon={<ClipboardList className="h-5 w-5" />}
                variant="mint"
                sparkline={ordersSparkline}
                subtitle={ordersSparkline.length > 1 ? "So'nggi 7 kun" : undefined}
              />
              <StatCard
                title="Bugungi daromad"
                value={stats ? formatCurrency(stats.revenueToday) : '—'}
                icon={<Banknote className="h-5 w-5" />}
                variant="violet"
                sparkline={revenueSparkline}
                subtitle={revenueSparkline.length > 1 ? "So'nggi 7 kun" : undefined}
              />
              <StatCard
                title="Onlayn haydovchilar"
                value={stats?.onlineDrivers?.toLocaleString('uz-UZ') ?? '—'}
                subtitle={
                  stats ? `${stats.activeDrivers.toLocaleString('uz-UZ')} ta faol haydovchidan` : undefined
                }
                icon={<Car className="h-5 w-5" />}
                variant="info"
              />
              <StatCard
                title="Tasdiqlanmagan"
                value={stats?.pendingDriverApprovals?.toLocaleString('uz-UZ') ?? '—'}
                subtitle="Haydovchi arizalari"
                icon={<Clock className="h-5 w-5" />}
                variant="override"
              />
              <StatCard
                title="Jami foydalanuvchilar"
                value={stats?.totalUsers?.toLocaleString('uz-UZ') ?? '—'}
                icon={<Users className="h-5 w-5" />}
                variant="neutral"
              />
            </div>
          )}

          {/* 2-qavat: harakatni tushuntiruvchi trendlar (so'nggi 7 kun) */}
          {trendsError && !trendsLoading ? (
            <Card>
              <CardContent className="p-0">
                <ErrorState compact message={trendsError} onRetry={fetchTrends} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <OrdersChart data={trendData} isLoading={trendsLoading} />
              <RevenueChart data={trendData} isLoading={trendsLoading} />
            </div>
          )}

          {/* 3-qavat: detal va drill-down */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent orders */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Oxirgi buyurtmalar</CardTitle>
                <Link href="/dashboard/orders" className={viewAllLink}>
                  Barchasini ko&apos;rish
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-4">
                    <SkeletonCards count={5} height="h-12" />
                  </div>
                ) : recentOrders.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Inbox className="h-5 w-5" />}
                    title="Hozircha buyurtmalar yo'q"
                    description="Yangi buyurtmalar shu yerda ko'rinadi."
                  />
                ) : (
                  <ul className="divide-y divide-divider">
                    {recentOrders.map((order) => (
                      <li key={order.id}>
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className={cn(
                            'flex items-center justify-between px-4 py-3 transition-colors duration-fast hover:bg-surface-2',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus'
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-body font-medium text-ink">
                              {getFullName(order.passenger.firstName, order.passenger.lastName)}
                            </p>
                            <p className="truncate text-caption text-muted">
                              {order.pickupAddress ?? '—'}
                            </p>
                          </div>
                          <div className="ml-4 flex shrink-0 items-center gap-3">
                            <OrderStatusBadge status={order.status} />
                            <span className="text-body font-semibold tabular-nums text-ink">
                              {formatCurrency(order.finalPrice ?? order.estimatedPrice)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Online drivers */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Onlayn haydovchilar</CardTitle>
                <Link href="/dashboard/drivers?status=online" className={viewAllLink}>
                  Barchasini ko&apos;rish
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-4">
                    <SkeletonCards count={5} height="h-12" />
                  </div>
                ) : onlineDrivers.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Inbox className="h-5 w-5" />}
                    title="Onlayn haydovchilar yo'q"
                    description="Haydovchi onlayn bo'lishi bilan shu yerda ko'rinadi."
                  />
                ) : (
                  <ul className="divide-y divide-divider">
                    {onlineDrivers.map((driver) => (
                      <li key={driver.id}>
                        <Link
                          href={`/dashboard/drivers/${driver.id}`}
                          className={cn(
                            'flex items-center justify-between px-4 py-3 transition-colors duration-fast hover:bg-surface-2',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus'
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint-tint text-caption font-bold text-primary-text">
                              {driver.firstName?.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-body font-medium text-ink">
                                {getFullName(driver.firstName, driver.lastName)}
                              </p>
                              <p className="font-mono text-caption text-muted">{driver.carNumber}</p>
                            </div>
                          </div>
                          <DriverStatusBadge status={driver.status} isOnline={driver.isOnline} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
