'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, History, Minus, Plus, RefreshCw } from 'lucide-react';
import { marketApi, type Product, type StockMovement, type Store } from '@/lib/api';
import { errorMessage, hueTint } from '@/lib/utils';
import { formatDateTime, formatNumber } from '@/lib/format';
import { stockTone } from '@/lib/product-status';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { cn } from '@/components/ui/cn';
import { usePageRefresh } from '@/components/shell';
import { getLocale } from '@/lib/i18n/core';
import { t } from '@/locales';

interface StockData {
  products: Product[];
  movements: StockMovement[];
  store: Store;
}

const STEP = 5;

export default function StockPage() {
  const m = t();
  const sm = m.stock;
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<StockData>(async () => {
    const [p, m, s] = await Promise.all([
      marketApi.getProducts(),
      marketApi.getStockMovements(),
      marketApi.getStore(),
    ]);
    return { products: p.data.data, movements: m.data.data, store: s.data.data };
  });
  usePageRefresh(reload);

  const products = useMemo(() => data?.products ?? [], [data]);
  const movements = useMemo(() => data?.movements ?? [], [data]);
  // Do'konning haqiqiy chegarasi (Sozlamalar → Zaxira ogohlantirishi).
  const threshold = data?.store.lowStockThreshold ?? 0;

  const outCount = products.filter((p) => p.stock === 0).length;
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= threshold).length;

  // Kritik birinchi: tugaganlar, keyin eng kami tepada; teng bo'lsa nom bo'yicha.
  const needRestock = useMemo(
    () =>
      products
        .filter((p) => p.stock <= threshold)
        .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, getLocale())),
    [products, threshold]
  );

  const pagedMovements = usePagination(movements, 25);

  const bump = async (p: Product, delta: number) => {
    setBusyId(p.id);
    try {
      await marketApi.updateProduct(p.id, { stock: Math.max(0, p.stock + delta) });
      await reload();
    } catch (err) {
      toast({ title: m.common.error, description: errorMessage(err), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const restockColumns: DataTableColumn<Product>[] = [
    {
      key: 'name',
      header: m.common.product,
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            style={hueTint(p.hue)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-xs text-base"
          >
            {p.emoji}
          </span>
          <span className="truncate font-medium text-ink">{p.name}</span>
        </span>
      ),
    },
    {
      key: 'state',
      header: m.common.status,
      width: 'w-32',
      hideBelow: 'sm',
      cell: (p) =>
        p.stock === 0 ? (
          <Badge variant="danger">{m.productStatus.stockOut}</Badge>
        ) : (
          <Badge variant="neutral">{m.productStatus.stockLow}</Badge>
        ),
    },
    {
      key: 'stock',
      header: m.common.stock,
      numeric: true,
      width: 'w-28',
      cell: (p) => (
        <span className={stockTone(p.stock, threshold).text}>
          {formatNumber(p.stock)} <span className="text-xs font-normal text-muted">{m.units[p.unit] ?? p.unit}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      width: 'w-24',
      cell: (p) => (
        <span className="inline-flex items-center gap-1">
          <IconButton
            variant="secondary"
            size="sm"
            aria-label={sm.decrease(p.name, STEP)}
            disabled={busyId === p.id || p.stock === 0}
            onClick={() => void bump(p, -STEP)}
          >
            <Minus aria-hidden />
          </IconButton>
          <IconButton
            variant="secondary"
            size="sm"
            aria-label={sm.increase(p.name, STEP)}
            disabled={busyId === p.id}
            onClick={() => void bump(p, STEP)}
          >
            <Plus aria-hidden />
          </IconButton>
        </span>
      ),
    },
  ];

  const movementColumns: DataTableColumn<StockMovement>[] = [
    {
      key: 'product',
      header: m.common.product,
      cell: (mv) => (
        <span className="block min-w-0">
          <span className="block truncate text-ink">{mv.product.name}</span>
          <span className="block truncate text-xs text-muted">{mv.note || sm.manualFix}</span>
        </span>
      ),
    },
    {
      key: 'at',
      header: m.common.time,
      numeric: true,
      width: 'w-28',
      hideBelow: 'sm',
      cell: (mv) => <span className="text-muted">{formatDateTime(mv.createdAt)}</span>,
    },
    {
      key: 'delta',
      header: sm.change,
      numeric: true,
      width: 'w-24',
      cell: (mv) => {
        const up = mv.delta > 0;
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-medium',
              up ? 'text-primary-text' : 'text-danger-dark dark:text-danger-light'
            )}
          >
            {up ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
            {up ? '+' : ''}
            {formatNumber(mv.delta)}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={sm.title}
        description={
          data
            ? sm.description(formatNumber(threshold))
            : sm.descriptionLoading
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => void reload()}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={14} aria-hidden />}
          >
            {m.common.refresh}
          </Button>
        }
      />

      {error && data && <DataErrorBanner message={error} onRetry={reload} retrying={isRefreshing} />}

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">{m.common.loading}</span>
          <SkeletonStats count={3} className="lg:grid-cols-3" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <SkeletonTable rows={6} cols={4} />
            <SkeletonTable rows={6} cols={3} />
          </div>
        </div>
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} retrying={isRefreshing} />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={m.productStatus.stockOut}
              value={formatNumber(outCount)}
              tone={outCount > 0 ? 'danger' : 'neutral'}
              hint={outCount > 0 ? sm.outOfSale : sm.noneOut}
            />
            <StatCard
              label={m.common.lowStock(formatNumber(threshold))}
              value={formatNumber(lowCount)}
              hint={lowCount > 0 ? m.common.refillSoon : m.common.allEnough}
            />
            <StatCard label={sm.totalProducts} value={formatNumber(products.length)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <DataTable
              title={sm.needRefill}
              description={sm.needRefillDescription}
              ariaLabel={sm.needRefillAria}
              columns={restockColumns}
              rows={needRestock}
              rowKey={(p) => p.id}
              rowClassName={(p) => (p.stock === 0 ? 'bg-danger-tint/40' : undefined)}
              empty={
                products.length === 0
                  ? {
                      variant: 'first-use',
                      title: sm.noProducts,
                      description: sm.noProductsDescription,
                    }
                  : {
                      variant: 'cleared',
                      title: sm.allEnough,
                      description: sm.allEnoughDescription,
                    }
              }
            />

            <DataTable
              title={sm.movements}
              ariaLabel={sm.movements}
              compact
              columns={movementColumns}
              rows={pagedMovements.pageItems}
              rowKey={(mv) => mv.id}
              pagination={{ paged: pagedMovements }}
              empty={{
                icon: <History aria-hidden />,
                title: sm.noMovements,
                description: sm.noMovementsDescription,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
