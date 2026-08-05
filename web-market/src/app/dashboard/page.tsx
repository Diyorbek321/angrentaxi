'use client';

import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  LayoutGrid,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { marketApi, DashboardData } from '@/lib/api';
import { money, moneyShort, formatTime } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<DashboardData>(async () => {
    const res = await marketApi.getDashboard();
    return res.data.data;
  });

  return (
    <div>
      <PageHeader
        title="Bosh sahifa"
        description="Bugungi savdo va zaxira holati"
        icon={<LayoutGrid size={18} aria-hidden />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void reload()}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={13} aria-hidden />}
          >
            Yangilash
          </Button>
        }
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              label="Bugungi buyurtmalar"
              value={data.todayOrdersCount}
              tone="neutral"
              icon={<ClipboardList size={18} aria-hidden />}
            />
            <StatTile
              label="Bugungi tushum"
              value={moneyShort(data.todayRevenue)}
              hint="so'm"
              tone="mint"
              icon={<Wallet size={18} aria-hidden />}
            />
            <StatTile
              label="Tugagan mahsulotlar"
              value={data.outOfStockCount}
              hint={data.outOfStockCount > 0 ? "Zudlik bilan to'ldiring" : 'Hammasi joyida'}
              tone={data.outOfStockCount > 0 ? 'danger' : 'muted'}
              icon={<AlertTriangle size={18} aria-hidden />}
            />
            <StatTile
              label="Faol mahsulotlar"
              value={data.activeProductsCount}
              hint={`${data.hiddenProductsCount} yashirilgan`}
              tone="neutral"
              icon={<Boxes size={18} aria-hidden />}
            />
          </div>

          {data.lowStock.length > 0 && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-4 rounded-ds-md border border-danger/40 bg-danger-tint px-4 py-3.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm bg-danger/15 text-danger">
                <AlertTriangle size={20} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-danger-deep dark:text-danger-light">
                  Zaxira tugash arafasida — {data.lowStock.length} ta mahsulot
                </p>
                <p className="mt-0.5 truncate text-caption text-muted">
                  {data.lowStock.map((p) => `${p.name} (${p.stock} ${p.unit})`).join(' · ')}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => router.push('/dashboard/stock')}
                rightIcon={<ArrowRight size={14} aria-hidden />}
              >
                To&apos;ldirish
              </Button>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
                <CardTitle>So&apos;nggi buyurtmalar</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/orders')}>
                  Barchasi
                </Button>
              </div>

              {data.recentOrders.length === 0 ? (
                <EmptyState
                  compact
                  title="Hali buyurtma yo'q"
                  description="Yangi buyurtma kelganda shu yerda ko'rinadi."
                />
              ) : (
                <ul className="divide-y divide-divider">
                  {data.recentOrders.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => router.push('/dashboard/orders')}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-surface-2/60"
                      >
                        <span className="w-16 shrink-0 font-mono text-caption font-bold text-muted">
                          {o.id.slice(0, 6)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-semibold text-ink">
                            {o.customer}
                          </span>
                          <span className="mt-0.5 block text-caption text-muted">
                            {o.itemsCount} ta mahsulot · {formatTime(o.createdAt)}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-body font-bold text-ink">
                          {money(o.totalPrice)}
                        </span>
                        <StatusBadge status={o.status} size="sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bugungi sotuvlar</CardTitle>
              </CardHeader>
              {data.bestSellers.length === 0 ? (
                <EmptyState
                  compact
                  title="Hali ma'lumot yo'q"
                  description="Birinchi sotuvdan keyin reyting shakllanadi."
                />
              ) : (
                <ul className="space-y-3.5">
                  {data.bestSellers.map((b, i) => {
                    const maxSold = data.bestSellers[0]?.sold || 1;
                    const pct = Math.round((b.sold / maxSold) * 100);
                    return (
                      <li key={b.name} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-xs bg-mint-tint font-mono text-caption font-bold text-primary-text">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-caption font-semibold text-ink">{b.name}</p>
                          <div
                            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pct}
                            aria-label={`${b.name}: ${b.sold} dona sotilgan`}
                          >
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-caption font-bold text-muted">
                          {b.sold}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Yuklanmoqda</span>
      <SkeletonStats />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80 rounded-ds-md" />
        <Skeleton className="h-80 rounded-ds-md" />
      </div>
    </div>
  );
}
