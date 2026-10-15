'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, RefreshCw, Tag, Users } from 'lucide-react';
import { getDashboardStats, getPromoCodes, DashboardStats, PromoCode } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageBody } from '@/components/ui/PageBody';
import { formatNumber, formatPercent, formatTime } from '@/lib/format';

const DAY_MS = 86_400_000;

/** A row in "Eʼtibor talab qiladi": what it is, then where to act on it. */
function AttentionRow({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] text-ink hover:bg-surface-2 transition-colors"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="text-subtle shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
          <span className="truncate">{children}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-muted shrink-0">
          Koʻrib chiqish
          <ChevronRight size={14} aria-hidden />
        </span>
      </Link>
    </li>
  );
}

export default function ManagerOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsResult, promoResult] = await Promise.all([getDashboardStats(), getPromoCodes()]);
      setStats(statsResult);
      setPromoCodes(promoResult);
      setLoadedAt(Date.now());
      setError(null);
    } catch (err) {
      console.error('Failed to load overview:', err);
      // The last good snapshot stays on screen; the banner names the failure.
      setError('Statistikani yuklab boʻlmadi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Promo expiry is computed against the load time, not during render.
  const expiringPromos =
    loadedAt == null
      ? []
      : promoCodes.filter((p) => {
          if (!p.isActive || !p.expiresAt) return false;
          const days = (new Date(p.expiresAt).getTime() - loadedAt) / DAY_MS;
          return days > 0 && days <= 7;
        });

  const attentionCount = (stats?.pendingDriverApprovals ?? 0) + expiringPromos.length;
  const firstLoad = isLoading && !stats;

  return (
    <PageBody>
      <PageHeader
        title="Umumiy koʻrinish"
        description={
          loadedAt ? `Bugungi koʻrsatkichlar · ${formatTime(loadedAt)} holatiga` : 'Bugungi koʻrsatkichlar'
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            isLoading={isLoading && stats != null}
            leftIcon={<RefreshCw size={13} aria-hidden />}
          >
            Yangilash
          </Button>
        }
      />

      {error && stats && (
        <RetryBanner
          message={error}
          onRetry={fetchData}
          keepsLastData
          lastUpdatedAt={loadedAt}
          className="mb-4"
        />
      )}

      {error && !stats ? (
        <Card>
          <ErrorState
            title="Statistikani yuklab boʻlmadi"
            message="Tarmoq yoki server xatosi. Qayta urinib koʻring."
            onRetry={fetchData}
            retrying={isLoading}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* "Are we OK today?" — business tempo. Live counters (online
              drivers, active orders) already sit in the topbar. No deltas:
              the API returns today only, there is no real baseline. */}
          {firstLoad ? (
            <SkeletonStats count={4} />
          ) : stats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Bugungi tushum" value={<MoneyText value={stats.revenueToday} />} />
              <StatCard
                label="Bugungi buyurtmalar"
                value={formatNumber(stats.ordersToday)}
                hint={`${formatNumber(stats.completedToday)} tasi yakunlandi`}
              />
              <StatCard
                label="Bekor qilish ulushi"
                value={formatPercent(stats.cancellationRateToday)}
                hint="bugungi buyurtmalardan"
              />
              <StatCard label="Oʻrtacha safar narxi" value={<MoneyText value={stats.avgTripPriceToday} />} />
            </div>
          ) : null}

          <Card padding="none">
            <CardHeader
              title="Eʼtibor talab qiladi"
              actions={attentionCount > 0 ? <Badge variant="neutral">{attentionCount}</Badge> : undefined}
              divider
            />
            {firstLoad ? (
              <div className="p-4 space-y-2" aria-busy="true">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            ) : attentionCount === 0 ? (
              <EmptyState
                compact
                variant="cleared"
                icon={<CheckCircle2 aria-hidden />}
                title="Hozircha hech narsa talab qilinmaydi"
                description="Tasdiq kutayotgan haydovchi ham, tugayotgan promo kod ham yoʻq."
              />
            ) : (
              <ul className="divide-y divide-line">
                {stats && stats.pendingDriverApprovals > 0 && (
                  <AttentionRow href="/dispatch/drivers" icon={<Users aria-hidden />}>
                    <span className="num font-semibold">{stats.pendingDriverApprovals}</span> ta haydovchi
                    tasdiq kutmoqda
                  </AttentionRow>
                )}
                {expiringPromos.map((p) => (
                  <AttentionRow key={p.id} href="/dispatch/promo-codes" icon={<Tag aria-hidden />}>
                    <span className="font-mono">{p.code}</span> — 7 kun ichida tugaydi ·{' '}
                    <span className="num">
                      {p.usedCount}
                      {p.maxUses ? `/${p.maxUses}` : ''}
                    </span>{' '}
                    marta ishlatilgan
                  </AttentionRow>
                ))}
              </ul>
            )}
          </Card>

          <section>
            <h2 className="text-h3 text-ink mb-3">Platforma boʻyicha jami</h2>
            {firstLoad ? (
              <SkeletonStats count={4} />
            ) : stats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard size="sm" label="Jami foydalanuvchilar" value={formatNumber(stats.totalUsers)} />
                <StatCard size="sm" label="Jami buyurtmalar" value={formatNumber(stats.totalOrders)} />
                <StatCard size="sm" label="Bugungi yangi mijozlar" value={formatNumber(stats.newCustomersToday)} />
                <StatCard
                  size="sm"
                  label="Faol haydovchilar"
                  value={formatNumber(stats.activeDrivers)}
                  hint={`hozir onlayn: ${formatNumber(stats.onlineDrivers)}`}
                />
              </div>
            ) : null}
          </section>
        </div>
      )}
    </PageBody>
  );
}
