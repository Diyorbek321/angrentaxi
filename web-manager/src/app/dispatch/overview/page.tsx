'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle,
  Car,
  Receipt,
  XCircle,
  UserPlus,
} from 'lucide-react';
import { getDashboardStats, getPromoCodes, DashboardStats, PromoCode } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function StatCard({
  label,
  value,
  icon,
  positive,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  positive?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="h-8 w-8 rounded-lg bg-[#FACC15]/10 flex items-center justify-center text-[#FACC15]">
          {icon}
        </div>
        {positive !== undefined &&
          (positive ? (
            <TrendingUp size={14} className="text-emerald-400" />
          ) : (
            <TrendingDown size={14} className="text-red-400" />
          ))}
      </div>
      <p className="text-xl font-bold text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Card>
  );
}

export default function ManagerOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsResult, promoResult] = await Promise.all([getDashboardStats(), getPromoCodes()]);
      setStats(statsResult);
      setPromoCodes(promoResult);
    } catch (err) {
      console.error('Failed to load overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const expiringPromos = promoCodes
    .filter((p) => p.isActive && p.expiresAt)
    .filter((p) => {
      const days = (new Date(p.expiresAt as string).getTime() - Date.now()) / 86400000;
      return days > 0 && days <= 7;
    });

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="px-6 py-4 border-b border-white/[0.06] bg-[#0D1526]/50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F1F5F9]">Overview</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">Today&apos;s business at a glance</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw size={13} />}>
          Refresh
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {isLoading || !stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              label="Revenue today"
              value={`${stats.revenueToday.toLocaleString()} UZS`}
              icon={<DollarSign size={16} />}
            />
            <StatCard
              label="Completed orders"
              value={String(stats.completedToday)}
              icon={<CheckCircle size={16} />}
            />
            <StatCard label="Active drivers" value={String(stats.activeDrivers)} icon={<Car size={16} />} />
            <StatCard
              label="Avg trip price"
              value={`${stats.avgTripPriceToday.toLocaleString()} UZS`}
              icon={<Receipt size={16} />}
            />
            <StatCard
              label="Cancellation rate"
              value={`${stats.cancellationRateToday}%`}
              icon={<XCircle size={16} />}
              positive={stats.cancellationRateToday < 10}
            />
            <StatCard
              label="New customers"
              value={String(stats.newCustomersToday)}
              icon={<UserPlus size={16} />}
              positive
            />
          </div>
        )}

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-100 mb-3">Needs attention</h2>
          <div className="space-y-2">
            {stats && stats.pendingDriverApprovals > 0 && (
              <Link
                href="/dispatch/drivers"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15"
              >
                <span className="text-sm text-amber-200">
                  {stats.pendingDriverApprovals} driver{stats.pendingDriverApprovals !== 1 ? 's' : ''} pending
                  approval
                </span>
                <span className="text-xs text-amber-400">Review →</span>
              </Link>
            )}
            {expiringPromos.map((p) => (
              <Link
                key={p.id}
                href="/dispatch/promo-codes"
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15"
              >
                <span className="text-sm text-purple-200">
                  {p.code} expires within 7 days · {p.usedCount}
                  {p.maxUses ? `/${p.maxUses}` : ''} used
                </span>
                <span className="text-xs text-purple-400">Review →</span>
              </Link>
            ))}
            {stats?.pendingDriverApprovals === 0 && expiringPromos.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">Nothing needs attention right now.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
