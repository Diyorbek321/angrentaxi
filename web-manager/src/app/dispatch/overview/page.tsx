'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Car,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Tag,
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
import { RetryBanner } from '@/components/ui/RetryBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { formatMoney, formatNumber } from '@/lib/format';

/**
 * KPI card, honest edition: label → value → optional real sub-figure.
 * The backend returns today's numbers only — there is no previous-period
 * data, so there are no delta arrows. A trend indicator with nothing behind
 * it would be a fabricated signal (dashboard doctrine: real data only).
 */
function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <span className="h-8 w-8 rounded-ds-sm bg-primary/12 flex items-center justify-center text-primary-600 dark:text-primary-300 mb-2">
        {icon}
      </span>
      <p className="font-mono text-xl font-bold text-ink tabular-nums">{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-subtle mt-0.5 truncate">{hint}</p>}
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
      // The last good snapshot stays on screen; the banner names the failure.
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

        {error && (
          <RetryBanner
            message={error}
            onRetry={fetchData}
            keepsLastData={stats != null}
            className="mb-4"
          />
        )}

        {error && !stats ? (
          <ErrorState message="Tarmoq yoki server xatosi. Qayta urinib koʻring." onRetry={fetchData} />
        ) : (
          <div className="space-y-6">
            {/* Top row — "are we OK today?", 5 cards max, money top-left. */}
            {isLoading && !stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[118px] rounded-ds-md" />
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                  label="Bugungi tushum"
                  value={formatMoney(stats.revenueToday)}
                  icon={<DollarSign size={16} />}
                />
                <StatCard
                  label="Bugungi buyurtmalar"
                  value={formatNumber(stats.ordersToday)}
                  icon={<ClipboardList size={16} />}
                  hint={`${formatNumber(stats.completedToday)} tasi yakunlandi`}
                />
                <StatCard
                  label="Bekor qilish ulushi"
                  value={`${stats.cancellationRateToday}%`}
                  icon={<XCircle size={16} />}
                  hint="bugungi buyurtmalardan"
                />
                <StatCard
                  label="Oʻrtacha safar narxi"
                  value={formatMoney(stats.avgTripPriceToday)}
                  icon={<Receipt size={16} />}
                />
                <StatCard
                  label="Onlayn haydovchilar"
                  value={formatNumber(stats.onlineDrivers)}
                  icon={<Car size={16} />}
                  hint={`jami faol: ${formatNumber(stats.activeDrivers)}`}
                />
              </div>
            ) : null}

            {/* Middle — what needs a human look today. */}
            <Card padding="lg">
              <h2 className="text-sm font-semibold text-ink mb-3">Eʼtibor talab qiladi</h2>

              {isLoading && !stats ? (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                </div>
              ) : (
                <div className="space-y-2">
                  {stats && stats.pendingDriverApprovals > 0 && (
                    <Link
                      href="/dispatch/drivers"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-ds-xs bg-info/[0.08] border border-info/30 hover:bg-info/[0.14] transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm text-info-deep dark:text-info-light">
                        <Users size={14} className="shrink-0" />
                        {stats.pendingDriverApprovals} ta haydovchi tasdiq kutmoqda
                      </span>
                      <span className="text-xs font-semibold text-info-deep dark:text-info-light shrink-0">
                        Koʻrib chiqish →
                      </span>
                    </Link>
                  )}

                  {expiringPromos.map((p) => (
                    <Link
                      key={p.id}
                      href="/dispatch/promo-codes"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-ds-xs bg-info/[0.08] border border-info/30 hover:bg-info/[0.14] transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm text-info-deep dark:text-info-light min-w-0">
                        <Tag size={14} className="shrink-0" />
                        <span className="font-mono">{p.code}</span>
                        <span className="truncate">
                          — 7 kun ichida tugaydi · {p.usedCount}
                          {p.maxUses ? `/${p.maxUses}` : ''} marta ishlatilgan
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-info-deep dark:text-info-light shrink-0">
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

            {/* Bottom — platform totals, the drill-down layer. */}
            <div>
              <h2 className="text-sm font-semibold text-ink mb-3">Platforma boʻyicha jami</h2>
              {isLoading && !stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[74px] rounded-ds-sm" />
                  ))}
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatTile
                    label="Jami foydalanuvchilar"
                    value={formatNumber(stats.totalUsers)}
                    icon={<Users size={16} />}
                  />
                  <StatTile
                    label="Jami buyurtmalar"
                    value={formatNumber(stats.totalOrders)}
                    icon={<ClipboardList size={16} />}
                  />
                  <StatTile
                    label="Bugungi yangi mijozlar"
                    value={formatNumber(stats.newCustomersToday)}
                    icon={<UserPlus size={16} />}
                  />
                  <StatTile
                    label="Faol haydovchilar"
                    value={formatNumber(stats.activeDrivers)}
                    icon={<Car size={16} />}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
