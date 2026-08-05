'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Car,
  ClipboardList,
  DollarSign,
  Clock,
  CheckCircle,
  LayoutDashboard,
  Inbox,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonStats, SkeletonCards } from '@/components/ui/Skeleton';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { DriverStatusBadge } from '@/components/drivers/DriverStatusBadge';
import { dashboardApi, DashboardStats, ordersApi, driversApi, Order, Driver } from '@/lib/api';
import { formatCurrency, getFullName } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          {/* Stats grid */}
          {isLoading ? (
            <SkeletonStats count={6} className="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <StatCard
                title="Jami foydalanuvchilar"
                value={stats?.totalUsers?.toLocaleString() ?? '—'}
                icon={<Users className="h-5 w-5" />}
                variant="info"
              />
              <StatCard
                title="Faol haydovchilar"
                value={stats?.activeDrivers?.toLocaleString() ?? '—'}
                icon={<Car className="h-5 w-5" />}
                variant="mint"
              />
              <StatCard
                title="Onlayn haydovchilar"
                value={stats?.onlineDrivers?.toLocaleString() ?? '—'}
                icon={<CheckCircle className="h-5 w-5" />}
                variant="mint"
              />
              <StatCard
                title="Bugungi buyurtmalar"
                value={stats?.ordersToday?.toLocaleString() ?? '—'}
                icon={<ClipboardList className="h-5 w-5" />}
                variant="override"
              />
              <StatCard
                title="Bugungi daromad"
                value={stats ? formatCurrency(stats.revenueToday) : '—'}
                icon={<DollarSign className="h-5 w-5" />}
                variant="violet"
              />
              <StatCard
                title="Tasdiqlanmagan"
                value={stats?.pendingDriverApprovals?.toLocaleString() ?? '—'}
                subtitle="Haydovchi arizalari"
                icon={<Clock className="h-5 w-5" />}
                variant="override"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent orders */}
            <Card>
              <CardHeader>
                <CardTitle>Oxirgi buyurtmalar</CardTitle>
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
                    title="Buyurtmalar yo'q"
                  />
                ) : (
                  <ul className="divide-y divide-divider">
                    {recentOrders.map((order) => (
                      <li
                        key={order.id}
                        className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2"
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
                          <span className="text-body font-semibold text-ink">
                            {formatCurrency(order.finalPrice ?? order.estimatedPrice)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Online drivers */}
            <Card>
              <CardHeader>
                <CardTitle>Onlayn haydovchilar</CardTitle>
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
                  />
                ) : (
                  <ul className="divide-y divide-divider">
                    {onlineDrivers.map((driver) => (
                      <li
                        key={driver.id}
                        className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-bold text-white">
                            {driver.firstName?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-body font-medium text-ink">
                              {getFullName(driver.firstName, driver.lastName)}
                            </p>
                            <p className="text-caption text-muted">{driver.carNumber}</p>
                          </div>
                        </div>
                        <DriverStatusBadge status={driver.status} isOnline={driver.isOnline} />
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
