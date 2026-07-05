'use client';

import { useEffect, useState } from 'react';
import { Users, Car, ClipboardList, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { DriverStatusBadge } from '@/components/drivers/DriverStatusBadge';
import { dashboardApi, DashboardStats, ordersApi, driversApi, Order, Driver } from '@/lib/api';
import { formatCurrency, formatDate, getFullName } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ordersRes, driversRes] = await Promise.all([
          dashboardApi.getStats(),
          ordersApi.getAll({ page: 1, limit: 5 }),
          driversApi.getAll({ page: 1, limit: 5, isOnline: true }),
        ]);
        setStats(statsRes.data.data);
        setRecentOrders(ordersRes.data.data?.orders ?? []);
        setOnlineDrivers(driversRes.data.data?.drivers ?? []);
      } catch {
        toast({ title: 'Xatolik', description: 'Ma\'lumotlarni yuklashda xatolik', variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  return (
    <div>
      <Header title="Bosh sahifa" subtitle="Tizimning umumiy ko'rinishi" />
      <div className="p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard
            title="Jami foydalanuvchilar"
            value={stats?.totalUsers?.toLocaleString() ?? '—'}
            icon={<Users className="h-5 w-5 text-white" />}
            variant="blue"
            isLoading={isLoading}
          />
          <StatCard
            title="Faol haydovchilar"
            value={stats?.activeDrivers?.toLocaleString() ?? '—'}
            icon={<Car className="h-5 w-5 text-white" />}
            variant="green"
            isLoading={isLoading}
          />
          <StatCard
            title="Onlayn haydovchilar"
            value={stats?.onlineDrivers?.toLocaleString() ?? '—'}
            icon={<CheckCircle className="h-5 w-5 text-white" />}
            variant="green"
            isLoading={isLoading}
          />
          <StatCard
            title="Bugungi buyurtmalar"
            value={stats?.ordersToday?.toLocaleString() ?? '—'}
            icon={<ClipboardList className="h-5 w-5 text-white" />}
            variant="yellow"
            isLoading={isLoading}
          />
          <StatCard
            title="Bugungi daromad"
            value={stats ? formatCurrency(stats.revenueToday) : '—'}
            icon={<DollarSign className="h-5 w-5 text-white" />}
            variant="purple"
            isLoading={isLoading}
          />
          <StatCard
            title="Tasdiqlanmagan"
            value={stats?.pendingDriverApprovals?.toLocaleString() ?? '—'}
            subtitle="Haydovchi arizalari"
            icon={<Clock className="h-5 w-5 text-white" />}
            variant="yellow"
            isLoading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent orders */}
          <Card>
            <CardHeader>
              <CardTitle>Oxirgi buyurtmalar</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.06]" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">Buyurtmalar yo&apos;q</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {recentOrders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200">
                          {getFullName(order.passenger.firstName, order.passenger.lastName)}
                        </p>
                        <p className="truncate text-xs text-slate-500">{order.pickupAddress ?? '—'}</p>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-3">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-sm font-semibold text-white">
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
                <div className="space-y-3 p-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.06]" />
                  ))}
                </div>
              ) : onlineDrivers.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">Onlayn haydovchilar yo&apos;q</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {onlineDrivers.map((driver) => (
                    <li key={driver.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-[#080D1A]"
                          style={{ boxShadow: '0 0 8px rgba(250,204,21,0.3)' }}
                        >
                          {driver.firstName?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-200">
                            {getFullName(driver.firstName, driver.lastName)}
                          </p>
                          <p className="text-xs text-slate-500">{driver.carNumber}</p>
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
    </div>
  );
}
