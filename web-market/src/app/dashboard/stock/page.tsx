'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, PackageX, ShieldCheck } from 'lucide-react';
import { marketApi, type Product, type StockMovement } from '@/lib/api';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { StockTable } from '@/components/stock/StockTable';
import { StockMovements } from '@/components/stock/StockMovements';

type Filter = 'attention' | 'all';

export default function StockPage() {
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [threshold, setThreshold] = useState(10);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('attention');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const [productsRes, movementsRes, storeRes] = await Promise.all([
        marketApi.getProducts(),
        marketApi.getStockMovements(),
        marketApi.getStore(),
      ]);
      setProducts(productsRes.data.data);
      setMovements(movementsRes.data.data);
      setThreshold(storeRes.data.data.lowStockThreshold);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : null);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const outCount = products.filter((p) => p.stock === 0).length;
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= threshold).length;

  const visible = useMemo(() => {
    const list =
      filter === 'attention' ? products.filter((p) => p.stock <= threshold) : [...products];
    // Emptiest first — the vendor works down the list.
    return list.sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }, [products, threshold, filter]);

  /**
   * There is no restock endpoint: stock is written through `updateProduct`,
   * which is also what records the movement on the backend. So this sends the
   * absolute new value rather than a delta.
   */
  const setStock = async (product: Product, stock: number) => {
    setBusyId(product.id);
    try {
      const res = await marketApi.updateProduct(product.id, { stock });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? res.data.data : p)));
      const movementsRes = await marketApi.getStockMovements();
      setMovements(movementsRes.data.data);
    } catch {
      toast({ title: 'Zaxirani saqlab bo‘lmadi', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <SkeletonStats count={3} />
        <div className="grid grid-cols-1 2xl:grid-cols-[1.6fr_1fr] gap-4">
          <SkeletonTable rows={6} cols={5} />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (status === 'error') return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Zaxira tugagan"
          value={outCount}
          icon={<PackageX size={18} />}
          tone={outCount > 0 ? 'danger' : 'neutral'}
          hint={outCount > 0 ? 'Sotib bo‘lmaydi' : undefined}
        />
        <StatCard
          label={`Zaxira kam (≤ ${threshold})`}
          value={lowCount}
          icon={<Boxes size={18} />}
          tone={lowCount > 0 ? 'warn' : 'neutral'}
        />
        <StatCard
          label="Jami mahsulotlar"
          value={products.length}
          icon={<ShieldCheck size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.6fr_1fr] gap-4">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            {(
              [
                { key: 'attention', label: "To'ldirish kerak", count: outCount + lowCount },
                { key: 'all', label: 'Barcha mahsulotlar', count: products.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                aria-pressed={filter === tab.key}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  filter === tab.key
                    ? 'border-primary/45 bg-primary/10 text-primary-700 dark:text-primary-300'
                    : 'border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink'
                )}
              >
                {tab.label}
                <span className="font-mono tabular-nums">{tab.count}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="surface-card">
              <EmptyState
                tone="positive"
                icon={<ShieldCheck size={24} />}
                title="Zaxira yetarli"
                description="Hozircha to'ldirish kerak bo'lgan mahsulot yo'q."
              />
            </div>
          ) : (
            <StockTable
              products={visible}
              threshold={threshold}
              onSetStock={setStock}
              busyId={busyId}
            />
          )}
        </div>

        <StockMovements movements={movements} />
      </div>
    </div>
  );
}
