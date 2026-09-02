'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Boxes,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, DashboardData } from '@/lib/api';
import { money, moneyShort, formatTime } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';

interface HomeData {
  dashboard: DashboardData;
  /** Alohida so'rov: `new` holatdagi buyurtmalar — harakat talab qiladigan raqam. */
  newOrdersCount: number;
}

const POLL_INTERVAL_MS = 30_000;

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<HomeData>(async () => {
    const [dash, newOrders] = await Promise.all([
      marketApi.getDashboard(),
      marketApi.getOrders('new'),
    ]);
    return { dashboard: dash.data.data, newOrdersCount: newOrders.data.data.length };
  });

  useEffect(() => {
    const interval = setInterval(() => void reload(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reload]);

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

      {error && data && <DataErrorBanner message={error} onRetry={reload} retrying={isRefreshing} />}

      {isLoading ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <DashboardBody data={data} onNavigate={(href) => router.push(href)} />
      ) : null}
    </div>
  );
}

function DashboardBody({
  data: { dashboard: d, newOrdersCount },
  onNavigate,
}: {
  data: HomeData;
  onNavigate: (href: string) => void;
}) {
  const lowCount = d.lowStock.length;
  const allCalm = newOrdersCount === 0 && d.outOfStockCount === 0;

  return (
    <div className="space-y-4">
      {/* Bugun birinchi: 3 ta KPI. API o'tgan davr bilan solishtirishni
          bermaydi, shuning uchun delta/sparkline YO'Q — o'ylab topilgan
          o'sish foizi ishonchni yo'q qiladi. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Bugungi buyurtmalar"
          value={d.todayOrdersCount}
          tone="neutral"
          icon={<ClipboardList size={18} aria-hidden />}
        />
        <StatTile
          label="Bugungi tushum"
          value={moneyShort(d.todayRevenue)}
          hint="so'm"
          tone="mint"
          icon={<Wallet size={18} aria-hidden />}
        />
        <StatTile
          label="Faol mahsulotlar"
          value={d.activeProductsCount}
          hint={`${d.hiddenProductsCount} ta yashirilgan`}
          tone="neutral"
          icon={<Boxes size={18} aria-hidden />}
        />
      </div>

      {/* Harakat talab qiladigan ikki raqam — bosiladigan YIRIK plitkalar.
          Ikkalasi ham nolga teng bo'lsa — xotirjam ijobiy holat, bo'sh jadval emas. */}
      {allCalm ? (
        <div className="flex items-center gap-4 rounded-ds-md border border-mint/30 bg-mint-tint px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm bg-primary/12 text-primary-text">
            <CheckCircle2 size={20} aria-hidden />
          </span>
          <div>
            <p className="text-body font-bold text-primary-text">Hammasi joyida</p>
            <p className="mt-0.5 text-caption text-muted">
              Javobsiz buyurtma ham, tugagan mahsulot ham yo&apos;q.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionTile
            title="Yangi buyurtmalar"
            value={newOrdersCount}
            description={
              newOrdersCount > 0
                ? "Qabul qilinishini kutmoqda — yig'ishni boshlang"
                : 'Hammasi qabul qilingan'
            }
            cta="Buyurtmalarga o'tish"
            tone={newOrdersCount > 0 ? 'attention' : 'calm'}
            icon={<BellRing size={19} aria-hidden />}
            onClick={() => onNavigate('/dashboard/orders')}
          />
          <ActionTile
            title="Zaxira tugagan"
            value={d.outOfStockCount}
            description={
              d.outOfStockCount > 0
                ? `Sotuvdan chiqib qolgan${lowCount > 0 ? ` · yana ${lowCount} ta kam qolgan` : ''}`
                : lowCount > 0
                  ? `Tugagani yo'q, lekin ${lowCount} ta mahsulot kam qolgan`
                  : "Zaxira yetarli"
            }
            cta="Zaxirani to'ldirish"
            tone={d.outOfStockCount > 0 ? 'danger' : 'calm'}
            icon={<AlertTriangle size={19} aria-hidden />}
            onClick={() => onNavigate('/dashboard/stock')}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card padding="none">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
            <CardTitle>So&apos;nggi buyurtmalar</CardTitle>
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1 rounded-ds-xs px-2 py-1 text-caption font-bold text-primary-text transition-colors duration-fast hover:bg-mint-tint"
            >
              Barchasi
              <ArrowRight size={12} aria-hidden />
            </Link>
          </div>

          {d.recentOrders.length === 0 ? (
            <EmptyState
              compact
              title="Hali buyurtma yo'q"
              description="Yangi buyurtma kelganda shu yerda ko'rinadi."
            />
          ) : (
            <ul className="divide-y divide-divider">
              {d.recentOrders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('/dashboard/orders')}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-surface-2/60"
                  >
                    <span className="w-16 shrink-0 font-mono text-caption tabular-nums font-bold text-muted">
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
                    <span className="shrink-0 font-mono text-body tabular-nums font-bold text-ink">
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
          {d.bestSellers.length === 0 ? (
            <EmptyState
              compact
              title="Hali ma'lumot yo'q"
              description="Birinchi sotuvdan keyin reyting shakllanadi."
            />
          ) : (
            <ul className="space-y-3.5">
              {d.bestSellers.map((b, i) => {
                const maxSold = d.bestSellers[0]?.sold || 1;
                const pct = Math.round((b.sold / maxSold) * 100);
                return (
                  <li key={b.name} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-xs bg-mint-tint font-mono text-caption tabular-nums font-bold text-primary-text">
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
                    <span className="shrink-0 font-mono text-caption tabular-nums font-bold text-muted">
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
  );
}

/** Harakatga yo'naltirilgan plitka: raqam + nima qilish kerakligi + CTA. */
function ActionTile({
  title,
  value,
  description,
  cta,
  tone,
  icon,
  onClick,
}: {
  title: string;
  value: number;
  description: string;
  cta: string;
  tone: 'attention' | 'danger' | 'calm';
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group flex items-center gap-4 rounded-ds-md border p-4 text-left transition-colors duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        tone === 'attention' && 'border-mint/40 bg-mint-tint hover:border-mint-deep/50',
        tone === 'danger' && 'border-danger/40 bg-danger-tint hover:border-danger/60',
        tone === 'calm' && 'border-line bg-surface hover:bg-surface-2/60'
      )}
    >
      <span
        className={clsx(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-ds-sm',
          tone === 'attention' && 'bg-primary/12 text-primary-text',
          tone === 'danger' && 'bg-danger/12 text-danger-deep dark:text-danger-light',
          tone === 'calm' && 'bg-surface-2 text-muted'
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={clsx(
              'font-mono text-h1 tabular-nums leading-none',
              tone === 'attention' && 'text-primary-text',
              tone === 'danger' && 'text-danger-deep dark:text-danger-light',
              tone === 'calm' && 'text-ink'
            )}
          >
            {value}
          </span>
          <span className="text-body font-bold text-ink">{title}</span>
        </span>
        <span className="mt-1 block truncate text-caption text-muted">{description}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-caption font-bold text-primary-text">
        <span className="hidden xl:inline">{cta}</span>
        <ArrowRight
          size={14}
          aria-hidden
          className="transition-transform duration-fast motion-safe:group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Yuklanmoqda</span>
      <SkeletonStats count={3} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-[84px] rounded-ds-md" />
        <Skeleton className="h-[84px] rounded-ds-md" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80 rounded-ds-md" />
        <Skeleton className="h-80 rounded-ds-md" />
      </div>
    </div>
  );
}
