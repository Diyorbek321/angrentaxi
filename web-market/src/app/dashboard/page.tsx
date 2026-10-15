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
      <PageHeader title="Bosh sahifa" description="Bugungi savdo va zaxira holati" />

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

const recentColumns: DataTableColumn<RecentOrder>[] = [
  {
    key: 'id',
    header: 'ID',
    width: 'w-24',
    cell: (o) => <span className="font-mono text-xs text-muted">{shortId(o.id)}</span>,
  },
  {
    key: 'customer',
    header: 'Mijoz',
    cell: (o) => <span className="block truncate text-ink">{o.customer?.trim() || '—'}</span>,
  },
  {
    key: 'items',
    header: 'Mahsulot',
    numeric: true,
    hideBelow: 'md',
    cell: (o) => `${formatNumber(o.itemsCount)} ta`,
  },
  { key: 'time', header: 'Vaqt', numeric: true, hideBelow: 'sm', cell: (o) => formatTime(o.createdAt) },
  { key: 'total', header: 'Summa', numeric: true, cell: (o) => <MoneyText value={o.totalPrice} /> },
  { key: 'status', header: 'Holat', width: 'w-36', cell: (o) => <StatusBadge status={o.status} /> },
];

function DashboardBody({
  data: { dashboard: d, newOrdersCount },
  onNavigate,
}: {
  data: HomeData;
  onNavigate: (href: string) => void;
}) {
  const lowCount = d.lowStock.length;

  return (
    <div className="space-y-4">
      {/* API o'tgan davr bilan solishtirishni bermaydi — delta/sparkline YO'Q. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bugungi buyurtmalar" value={formatNumber(d.todayOrdersCount)} />
        <StatCard label="Bugungi tushum" value={formatNumber(d.todayRevenue)} unit="soʻm" />
        <StatCard
          label="Faol mahsulotlar"
          value={formatNumber(d.activeProductsCount)}
          hint={`${formatNumber(d.hiddenProductsCount)} ta yashirilgan`}
        />
        <StatCard
          label={`Kam qolgan (≤ ${formatNumber(d.lowStockThreshold)})`}
          value={formatNumber(lowCount)}
          hint={lowCount > 0 ? 'Tez orada toʻldiring' : 'Hammasi yetarli'}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ActionBanner
          icon={newOrdersCount > 0 ? <BellRing aria-hidden /> : <CheckCircle2 aria-hidden />}
          title={
            newOrdersCount > 0
              ? `${formatNumber(newOrdersCount)} ta yangi buyurtma`
              : 'Yangi buyurtma yoʻq'
          }
          description={
            newOrdersCount > 0
              ? 'Qabul qilinishini kutmoqda — yigʻishni boshlang'
              : 'Hammasi qabul qilingan'
          }
          cta="Buyurtmalarga oʻtish"
          primary={newOrdersCount > 0}
          onClick={() => onNavigate(ORDERS_HREF)}
        />
        <ActionBanner
          icon={d.outOfStockCount > 0 ? <CircleOff aria-hidden /> : <CheckCircle2 aria-hidden />}
          title={
            d.outOfStockCount > 0
              ? `${formatNumber(d.outOfStockCount)} ta mahsulot tugagan`
              : 'Tugagan mahsulot yoʻq'
          }
          description={
            d.outOfStockCount > 0
              ? `Sotuvdan chiqib qolgan${lowCount > 0 ? ` · yana ${formatNumber(lowCount)} ta kam qolgan` : ''}`
              : lowCount > 0
                ? `${formatNumber(lowCount)} ta mahsulot kam qolgan`
                : 'Zaxira yetarli'
          }
          cta="Zaxirani toʻldirish"
          danger={d.outOfStockCount > 0}
          onClick={() => onNavigate(STOCK_HREF)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <DataTable
          title="Soʻnggi buyurtmalar"
          actions={
            <Button variant="ghost" size="sm" href={ORDERS_HREF} rightIcon={<ArrowRight size={14} aria-hidden />}>
              Barchasi
            </Button>
          }
          ariaLabel="Soʻnggi buyurtmalar"
          compact
          columns={recentColumns}
          rows={d.recentOrders}
          rowKey={(o) => o.id}
          onRowClick={() => onNavigate(ORDERS_HREF)}
          empty={{
            icon: <ClipboardList aria-hidden />,
            title: 'Hali buyurtma yoʻq',
            description: 'Yangi buyurtma kelganda shu yerda koʻrinadi.',
          }}
        />

        <Card padding="none">
          <CardHeader title="Bugungi sotuvlar" description="Eng koʻp sotilgan mahsulotlar" />
          <div className="px-4 pb-4">
            {d.bestSellers.length === 0 ? (
              <EmptyState
                compact
                icon={<Trophy aria-hidden />}
                title="Hali sotuv yoʻq"
                description="Birinchi sotuvdan keyin reyting shakllanadi."
              />
            ) : (
              <RankedBars
                ariaLabel="Bugun eng koʻp sotilgan mahsulotlar"
                unit="dona"
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
      <span className="sr-only">Yuklanmoqda</span>
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
