'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BellRing, CheckCircle2, CircleOff, ClipboardList, Trophy } from 'lucide-react';
import { marketApi, type DashboardData } from '@/lib/api';
import { formatNumber, formatTime, shortId } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { StatusBadge } from '@/components/StatusBadge';
import { RankedBars } from '@/components/charts/RankedBars';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { cn } from '@/components/ui/cn';
import { usePageRefresh } from '@/components/shell';
import { t } from '@/locales';

interface HomeData {
  dashboard: DashboardData;
  /** Alohida so'rov: `new` holatdagi buyurtmalar — harakat talab qiladigan raqam. */
  newOrdersCount: number;
}

type RecentOrder = DashboardData['recentOrders'][number];

const POLL_INTERVAL_MS = 30_000;
const ORDERS_HREF = '/dashboard/orders';
const STOCK_HREF = '/dashboard/stock';

export default function DashboardPage() {
  const m = t();
  const router = useRouter();
  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<HomeData>(async () => {
    const [dash, newOrders] = await Promise.all([marketApi.getDashboard(), marketApi.getOrders('new')]);
    return { dashboard: dash.data.data, newOrdersCount: newOrders.data.data.length };
  });
  usePageRefresh(reload);

  useEffect(() => {
    const interval = setInterval(() => void reload(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reload]);
  useRealtimeRefresh(reload);

  return (
    <div>
      <PageHeader title={m.dashboard.title} description={m.dashboard.description} />

      {error && data && <DataErrorBanner message={error} onRetry={reload} retrying={isRefreshing} />}

      {isLoading ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} retrying={isRefreshing} />
      ) : data ? (
        <DashboardBody data={data} onNavigate={(href) => router.push(href)} />
      ) : null}
    </div>
  );
}

function recentColumns(): DataTableColumn<RecentOrder>[] {
  const m = t();
  return [
  {
    key: 'id',
    header: 'ID',
    width: 'w-24',
    cell: (o) => <span className="font-mono text-xs text-muted">{shortId(o.id)}</span>,
  },
  {
    key: 'customer',
    header: m.dashboard.colCustomer,
    cell: (o) => <span className="block truncate text-ink">{o.customer?.trim() || '—'}</span>,
  },
  {
    key: 'items',
    header: m.common.product,
    numeric: true,
    hideBelow: 'md',
    cell: (o) => m.common.count(formatNumber(o.itemsCount)),
  },
  { key: 'time', header: m.common.time, numeric: true, hideBelow: 'sm', cell: (o) => formatTime(o.createdAt) },
  { key: 'total', header: m.common.sum, numeric: true, cell: (o) => <MoneyText value={o.totalPrice} /> },
  { key: 'status', header: m.common.status, width: 'w-36', cell: (o) => <StatusBadge status={o.status} /> },
  ];
}

function DashboardBody({
  data: { dashboard: d, newOrdersCount },
  onNavigate,
}: {
  data: HomeData;
  onNavigate: (href: string) => void;
}) {
  const m = t();
  const dm = m.dashboard;
  const lowCount = d.lowStock.length;

  return (
    <div className="space-y-4">
      {/* API o'tgan davr bilan solishtirishni bermaydi — delta/sparkline YO'Q. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={dm.todayOrders} value={formatNumber(d.todayOrdersCount)} />
        <StatCard label={dm.todayRevenue} value={formatNumber(d.todayRevenue)} unit={m.common.som} />
        <StatCard
          label={dm.activeProducts}
          value={formatNumber(d.activeProductsCount)}
          hint={dm.hidden(formatNumber(d.hiddenProductsCount))}
        />
        <StatCard
          label={m.common.lowStock(formatNumber(d.lowStockThreshold))}
          value={formatNumber(lowCount)}
          hint={lowCount > 0 ? m.common.refillSoon : m.common.allEnough}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ActionBanner
          icon={newOrdersCount > 0 ? <BellRing aria-hidden /> : <CheckCircle2 aria-hidden />}
          title={
            newOrdersCount > 0
              ? dm.newOrders(formatNumber(newOrdersCount))
              : dm.noNewOrders
          }
          description={
            newOrdersCount > 0
              ? dm.awaitingAccept
              : dm.allAccepted
          }
          cta={dm.toOrders}
          primary={newOrdersCount > 0}
          onClick={() => onNavigate(ORDERS_HREF)}
        />
        <ActionBanner
          icon={d.outOfStockCount > 0 ? <CircleOff aria-hidden /> : <CheckCircle2 aria-hidden />}
          title={
            d.outOfStockCount > 0
              ? dm.outOfStock(formatNumber(d.outOfStockCount))
              : dm.noOutOfStock
          }
          description={
            d.outOfStockCount > 0
              ? dm.outOfSale(lowCount > 0 ? formatNumber(lowCount) : null)
              : lowCount > 0
                ? dm.lowCount(formatNumber(lowCount))
                : dm.stockEnough
          }
          cta={dm.refill}
          danger={d.outOfStockCount > 0}
          onClick={() => onNavigate(STOCK_HREF)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <DataTable
          title={dm.recentOrders}
          actions={
            <Button variant="ghost" size="sm" href={ORDERS_HREF} rightIcon={<ArrowRight size={14} aria-hidden />}>
              {m.common.all}
            </Button>
          }
          ariaLabel={dm.recentOrders}
          compact
          columns={recentColumns()}
          rows={d.recentOrders}
          rowKey={(o) => o.id}
          onRowClick={() => onNavigate(ORDERS_HREF)}
          empty={{
            icon: <ClipboardList aria-hidden />,
            title: dm.noOrdersYet,
            description: dm.noOrdersDescription,
          }}
        />

        <Card padding="none">
          <CardHeader title={dm.todaySales} description={dm.bestSellers} />
          <div className="px-4 pb-4">
            {d.bestSellers.length === 0 ? (
              <EmptyState
                compact
                icon={<Trophy aria-hidden />}
                title={m.common.noSalesYet}
                description={m.common.ratingAfterFirstSale}
              />
            ) : (
              <RankedBars
                ariaLabel={dm.bestSellersToday}
                unit={m.common.unitPcs}
                items={d.bestSellers.map((b) => ({ label: b.name, value: b.sold }))}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Harakat banneri: sokin karta, BITTA CTA. Qizil tint faqat haqiqatan
 * tugagan mahsulot bo'lganda; yangi buyurtma — oddiy karta + asosiy tugma.
 */
function ActionBanner({
  icon,
  title,
  description,
  cta,
  primary = false,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  primary?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-ds-md border px-4 py-3',
        danger ? 'border-danger/30 bg-danger-tint' : 'border-line bg-surface'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]',
          danger ? 'text-danger-dark dark:text-danger-light' : primary ? 'text-primary-text' : 'text-subtle'
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold', danger ? 'text-danger-dark dark:text-danger-light' : 'text-ink')}>
          {title}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-muted">{description}</p>
      </div>
      <Button
        size="sm"
        variant={primary ? 'primary' : danger ? 'danger' : 'secondary'}
        onClick={onClick}
        className="shrink-0"
      >
        {cta}
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t().common.loading}</span>
      <SkeletonStats count={4} className="xl:grid-cols-4" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-[62px] rounded-ds-md" />
        <Skeleton className="h-[62px] rounded-ds-md" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <SkeletonTable rows={6} cols={5} compact />
        <Skeleton className="h-72 rounded-ds-md" />
      </div>
    </div>
  );
}
