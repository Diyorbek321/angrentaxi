'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Car,
  CheckCircle2,
  DollarSign,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Tag,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { getDashboardStats, getPromoCodes, DashboardStats, PromoCode } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney, formatNumber } from '@/lib/format';

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
        <span className="h-8 w-8 rounded-xl bg-primary/12 flex items-center justify-center text-primary-600 dark:text-primary-300">
          {icon}
        </span>
        {positive !== undefined &&
          (positive ? (
            <TrendingUp size={14} className="text-primary-600 dark:text-primary-300" />
          ) : (
            <TrendingDown size={14} className="text-danger" />
          ))}
      </div>
      <p className="font-mono text-xl font-bold text-ink tabular-nums">{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </Card>
  );
}

export default function ManagerOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsResult, promoResult] = await Promise.all([getDashboardStats(), getPromoCodes()]);
      setStats(statsResult);
      setPromoCodes(promoResult);
      setError(null);
    } catch (err) {
      console.error('Failed to load overview:', err);
      setError('Statistikani yuklab boʻlmadi.');
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

  const nothingToReview =
    stats != null && stats.pendingDriverApprovals === 0 && expiringPromos.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4">
        <PageHeader
          title="Umumiy koʻrinish"
          description="Bugungi koʻrsatkichlar bir qarashda"
          icon={<LayoutDashboard size={17} />}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              leftIcon={<RefreshCw size={13} />}
            >
              Yangilash
            </Button>
          }
        />

        {error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : (
          <div className="space-y-6">
            {isLoading || !stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                  label="Bugungi tushum"
                  value={formatMoney(stats.revenueToday)}
                  icon={<DollarSign size={16} />}
                />
                <StatCard
                  label="Yakunlangan buyurtmalar"
                  value={formatNumber(stats.completedToday)}
                  icon={<CheckCircle2 size={16} />}
                />
                <StatCard
                  label="Faol haydovchilar"
                  value={formatNumber(stats.activeDrivers)}
                  icon={<Car size={16} />}
                />
                <StatCard
                  label="Oʻrtacha safar narxi"
                  value={formatMoney(stats.avgTripPriceToday)}
                  icon={<Receipt size={16} />}
                />
                <StatCard
                  label="Bekor qilish ulushi"
                  value={`${stats.cancellationRateToday}%`}
                  icon={<XCircle size={16} />}
                  positive={stats.cancellationRateToday < 10}
                />
                <StatCard
                  label="Yangi mijozlar"
                  value={formatNumber(stats.newCustomersToday)}
                  icon={<UserPlus size={16} />}
                  positive
                />
              </div>
            )}

            <Card padding="lg">
              <h2 className="text-sm font-semibold text-ink mb-3">Eʼtibor talab qiladi</h2>

              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                </div>
              ) : (
                <div className="space-y-2">
                  {stats && stats.pendingDriverApprovals > 0 && (
                    <Link
                      href="/dispatch/drivers"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-override/[0.08] border border-override/30 hover:bg-override/[0.14] transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm text-override-dark dark:text-override-light">
                        <Users size={14} className="shrink-0" />
                        {stats.pendingDriverApprovals} ta haydovchi tasdiq kutmoqda
                      </span>
                      <span className="text-xs font-semibold text-override shrink-0">
                        Koʻrib chiqish →
                      </span>
                    </Link>
                  )}

                  {expiringPromos.map((p) => (
                    <Link
                      key={p.id}
                      href="/dispatch/promo-codes"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-info/[0.08] border border-info/30 hover:bg-info/[0.14] transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm text-info dark:text-blue-300 min-w-0">
                        <Tag size={14} className="shrink-0" />
                        <span className="font-mono">{p.code}</span>
                        <span className="truncate">
                          — 7 kun ichida tugaydi · {p.usedCount}
                          {p.maxUses ? `/${p.maxUses}` : ''} marta ishlatilgan
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-info shrink-0">
                        Koʻrib chiqish →
                      </span>
                    </Link>
                  ))}

                  {nothingToReview && (
                    <EmptyState
                      compact
                      tone="positive"
                      icon={<CheckCircle2 size={20} />}
                      title="Hozircha hech narsa talab qilinmaydi"
                      description="Tasdiq kutayotgan haydovchi ham, tugayotgan promo kod ham yoʻq."
                    />
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
