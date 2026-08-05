'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Boxes, Minus, Plus, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, Product, StockMovement, Store } from '@/lib/api';
import { errorMessage, formatTime, hueTint } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';

interface StockData {
  products: Product[];
  movements: StockMovement[];
  store: Store;
}

export default function StockPage() {
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

  const products = useMemo(() => data?.products ?? [], [data]);
  const movements = data?.movements ?? [];
  const threshold = data?.store.lowStockThreshold ?? 10;

  const outCount = products.filter((p) => p.stock === 0).length;
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= threshold).length;

  const needRestock = useMemo(
    () => products.filter((p) => p.stock <= threshold).sort((a, b) => a.stock - b.stock),
    [products, threshold]
  );

  const bump = async (p: Product, delta: number) => {
    setBusyId(p.id);
    try {
      await marketApi.updateProduct(p.id, { stock: Math.max(0, p.stock + delta) });
      await reload();
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Zaxira"
        description="Kam qolgan va tugagan mahsulotlar"
        icon={<Boxes size={18} aria-hidden />}
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
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">Yuklanmoqda</span>
          <SkeletonStats count={2} />
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Skeleton className="h-96 rounded-ds-md" />
            <Skeleton className="h-96 rounded-ds-md" />
          </div>
        </div>
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatTile
              label="Tugagan mahsulotlar"
              value={outCount}
              tone={outCount > 0 ? 'danger' : 'muted'}
              hint={outCount > 0 ? "Sotuvdan chiqib ketgan" : 'Tugagani yo‘q'}
            />
            <StatTile
              label={`Kam qolgan (≤${threshold})`}
              value={lowCount}
              tone={lowCount > 0 ? 'override' : 'muted'}
              hint={lowCount > 0 ? "Tez orada to'ldiring" : 'Hammasi yetarli'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-line px-4 py-3.5">
                <CardTitle>To&apos;ldirish kerak</CardTitle>
              </div>
              {needRestock.length === 0 ? (
                <EmptyState
                  compact
                  tone="positive"
                  title="Barcha mahsulotlar yetarli"
                  description="Zaxira chegaradan yuqori — hech narsa talab qilinmaydi."
                />
              ) : (
                <ul className="divide-y divide-divider">
                  {needRestock.map((p) => {
                    const critical = p.stock === 0;
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <span
                          aria-hidden
                          style={hueTint(p.hue)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm text-base"
                        >
                          {p.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-bold text-ink">{p.name}</p>
                          <p
                            className={clsx(
                              'mt-0.5 text-caption font-bold',
                              critical
                                ? 'text-danger-deep dark:text-danger-light'
                                : 'text-override-dark dark:text-override-light'
                            )}
                          >
                            {critical ? 'Tugagan' : 'Kam qoldi'} — {p.stock} {p.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`${p.name}: 5 ta kamaytirish`}
                            disabled={busyId === p.id || p.stock === 0}
                            onClick={() => void bump(p, -5)}
                          >
                            <Minus size={14} aria-hidden />
                          </Button>
                          <span
                            className="w-14 rounded-ds-xs border border-line bg-surface-2 py-1.5 text-center font-mono text-body font-bold text-ink"
                            aria-label={`Joriy zaxira: ${p.stock}`}
                          >
                            {p.stock}
                          </span>
                          <Button
                            size="sm"
                            aria-label={`${p.name}: 5 ta qo'shish`}
                            disabled={busyId === p.id}
                            onClick={() => void bump(p, 5)}
                          >
                            <Plus size={14} aria-hidden />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-line px-4 py-3.5">
                <CardTitle>Zaxira harakati</CardTitle>
              </div>
              {movements.length === 0 ? (
                <EmptyState
                  compact
                  title="Harakat yo'q"
                  description="Zaxira o'zgarganda yozuv shu yerda paydo bo'ladi."
                />
              ) : (
                <ul className="divide-y divide-divider">
                  {movements.map((m) => {
                    const up = m.delta > 0;
                    return (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          aria-hidden
                          className={clsx(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-xs',
                            up
                              ? 'bg-mint-tint text-primary-text'
                              : 'bg-danger/12 text-danger-deep dark:text-danger-light'
                          )}
                        >
                          {up ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-caption font-semibold text-ink">
                            {m.product.name}
                          </p>
                          <p className="mt-0.5 truncate text-caption text-subtle">
                            {m.note || 'Qo‘lda tuzatish'} · {formatTime(m.createdAt)}
                          </p>
                        </div>
                        <span
                          className={clsx(
                            'shrink-0 font-mono text-caption font-bold',
                            up
                              ? 'text-primary-text'
                              : 'text-danger-deep dark:text-danger-light'
                          )}
                        >
                          {up ? '+' : ''}
                          {m.delta}
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
