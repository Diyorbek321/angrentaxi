'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutGrid, List, Package, Plus, Search } from 'lucide-react';
import {
  marketApi,
  type MarketCategory,
  type Product,
  type ProductStatus,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { PRODUCT_STATUS_META } from '@/lib/orderStatus';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonGrid } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductsTable } from '@/components/products/ProductsTable';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { BulkPriceModal, type BulkPriceMode } from '@/components/products/BulkPriceModal';

const VIEW_STORAGE_KEY = 'angren-market-products-view';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Barcha holatlar' },
  ...(Object.keys(PRODUCT_STATUS_META) as ProductStatus[]).map((key) => ({
    value: key,
    label: PRODUCT_STATUS_META[key].label,
  })),
];

export default function ProductsPage() {
  // useSearchParams needs a Suspense boundary above it for the build to
  // prerender this route.
  return (
    <Suspense fallback={<SkeletonGrid />}>
      <ProductsView />
    </Suspense>
  );
}

function ProductsView() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [threshold, setThreshold] = useState(10);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [savedFlags, setSavedFlags] = useState<Record<string, boolean>>({});
  const [formProduct, setFormProduct] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);

  // Seeded from the header's quick search (`?q=`).
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_STORAGE_KEY) === 'table') setView('table');
    } catch {
      /* private mode — defaults to grid */
    }
  }, []);

  const changeView = (next: 'grid' | 'table') => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const [productsRes, categoriesRes, storeRes] = await Promise.all([
        marketApi.getProducts(),
        marketApi.getCategories(),
        marketApi.getStore(),
      ]);
      setProducts(productsRes.data.data);
      setCategories(categoriesRes.data.data);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, query, categoryFilter, statusFilter]);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const allSelected = filtered.length > 0 && filtered.every((p) => selected[p.id]);

  const flashSaved = (key: string) => {
    setSavedFlags((s) => ({ ...s, [key]: true }));
    setTimeout(() => setSavedFlags((s) => ({ ...s, [key]: false })), 1300);
  };

  const replaceProduct = (updated: Product) =>
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

  const onInlineChange = async (product: Product, field: 'price' | 'stock', value: number) => {
    try {
      const res = await marketApi.updateProduct(product.id, { [field]: value });
      replaceProduct(res.data.data);
      flashSaved(`${product.id}-${field}`);
    } catch {
      toast({ title: 'Saqlab bo‘lmadi', variant: 'error' });
    }
  };

  const onToggleActive = async (product: Product, next: boolean) => {
    try {
      const res = await marketApi.updateProduct(product.id, {
        status: next ? 'active' : 'hidden',
      });
      replaceProduct(res.data.data);
    } catch {
      toast({ title: 'Holatni o‘zgartirib bo‘lmadi', variant: 'error' });
    }
  };

  const bulkSetStatus = async (next: ProductStatus) => {
    try {
      await marketApi.bulkUpdateProducts(selectedIds, next);
      setSelected({});
      await load();
      toast({ title: `${selectedIds.length} ta mahsulot yangilandi`, variant: 'success' });
    } catch {
      toast({ title: 'Ommaviy amal bajarilmadi', variant: 'error' });
    }
  };

  // No bulk-price endpoint exists — this loops the same per-product update the
  // inline price field already uses.
  const bulkChangePrice = async (mode: BulkPriceMode, value: number) => {
    try {
      await Promise.all(
        selectedIds.map((id) => {
          const product = products.find((p) => p.id === id);
          if (!product) return Promise.resolve();
          const price =
            mode === 'set'
              ? Math.max(0, Math.round(value))
              : Math.max(0, Math.round(product.price * (1 + value / 100)));
          return marketApi.updateProduct(id, { price });
        })
      );
      setBulkPriceOpen(false);
      setSelected({});
      await load();
      toast({ title: 'Narxlar yangilandi', variant: 'success' });
    } catch {
      toast({ title: 'Narxlarni o‘zgartirib bo‘lmadi', variant: 'error' });
    }
  };

  const openCreate = () => {
    setFormProduct(null);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setFormProduct(product);
    setFormOpen(true);
  };

  if (status === 'loading') return <SkeletonGrid />;
  if (status === 'error') return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nomi yoki SKU bo'yicha qidirish..."
            aria-label="Mahsulot qidirish"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-line text-sm text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          />
        </div>

        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Kategoriya bo'yicha filtr"
          className="w-auto min-w-40 h-9 py-0"
          options={[
            { value: 'all', label: 'Barcha kategoriyalar' },
            ...categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` })),
          ]}
        />

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Holat bo'yicha filtr"
          className="w-auto min-w-36 h-9 py-0"
          options={STATUS_OPTIONS}
        />

        <div className="flex rounded-lg border border-line overflow-hidden">
          {(
            [
              { key: 'grid', icon: LayoutGrid, label: 'Karta ko‘rinishi' },
              { key: 'table', icon: List, label: 'Jadval ko‘rinishi' },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => changeView(key)}
              title={label}
              aria-label={label}
              aria-pressed={view === key}
              className={cn(
                'h-9 w-9 inline-flex items-center justify-center transition-colors',
                view === key
                  ? 'bg-primary/12 text-primary-700 dark:text-primary-300'
                  : 'bg-surface text-muted hover:bg-surface-2 hover:text-ink'
              )}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        <Button onClick={openCreate} leftIcon={<Plus size={15} />} className="ml-auto">
          Mahsulot qo&apos;shish
        </Button>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.07] px-3.5 py-2.5">
          <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
            {selectedIds.length} ta tanlandi
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => bulkSetStatus('active')}>
              Faollashtirish
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulkSetStatus('hidden')}>
              Yashirish
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkPriceOpen(true)}>
              Narxni o&apos;zgartirish
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
              Bekor qilish
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={24} />}
          title={products.length === 0 ? "Hali mahsulot yo'q" : 'Mos mahsulot topilmadi'}
          description={
            products.length === 0
              ? "Katalogni to'ldirish uchun birinchi mahsulotni qo'shing."
              : "Qidiruv so'zini yoki filtrlarni o'zgartirib ko'ring."
          }
          action={
            products.length === 0 ? (
              <Button onClick={openCreate} leftIcon={<Plus size={15} />}>
                Mahsulot qo&apos;shish
              </Button>
            ) : undefined
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              selected={!!selected[product.id]}
              onToggleSelected={() =>
                setSelected((s) => ({ ...s, [product.id]: !s[product.id] }))
              }
              onEdit={() => openEdit(product)}
              onToggleActive={(next) => onToggleActive(product, next)}
              lowStockThreshold={threshold}
            />
          ))}
        </div>
      ) : (
        <ProductsTable
          products={filtered}
          categories={categories}
          selected={selected}
          onToggleSelected={(id) => setSelected((s) => ({ ...s, [id]: !s[id] }))}
          onToggleAll={() => {
            const next = { ...selected };
            filtered.forEach((p) => {
              next[p.id] = !allSelected;
            });
            setSelected(next);
          }}
          allSelected={allSelected}
          onEdit={openEdit}
          onToggleActive={onToggleActive}
          onInlineChange={onInlineChange}
          savedFlags={savedFlags}
          lowStockThreshold={threshold}
        />
      )}

      {formOpen && (
        <ProductFormModal
          product={formProduct}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await load();
          }}
        />
      )}

      {bulkPriceOpen && (
        <BulkPriceModal
          count={selectedIds.length}
          onClose={() => setBulkPriceOpen(false)}
          onApply={bulkChangePrice}
        />
      )}
    </div>
  );
}
