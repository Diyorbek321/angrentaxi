'use client';

import { useMemo, useState } from 'react';
import { Package, Plus, RefreshCw, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, MarketCategory, Product, ProductStatus, Store } from '@/lib/api';
import { PRODUCT_STATUS } from '@/lib/product-status';
import { errorMessage } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips, type FilterChip } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { AddProductModal } from '@/components/products/AddProductModal';
import { BulkPriceModal, type BulkPriceChange } from '@/components/products/BulkPriceModal';
import { BulkToolbar } from '@/components/products/BulkToolbar';
import {
  PRODUCT_ROW_GRID,
  ProductCardMobile,
  ProductRow,
} from '@/components/products/ProductRow';

interface CatalogData {
  products: Product[];
  categories: MarketCategory[];
  store: Store;
}

type TabKey = 'all' | ProductStatus;

/** Katalog HOLAT bo'yicha birinchi bo'linadi (Ozon naqshi) — real API holatlari. */
const TAB_ORDER: TabKey[] = ['all', 'active', 'out', 'hidden'];

const STATE_PRIORITY: Record<ProductStatus, number> = { active: 0, out: 1, hidden: 2 };

export default function ProductsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<CatalogData>(async () => {
    const [p, c, s] = await Promise.all([
      marketApi.getProducts(),
      marketApi.getCategories(),
      marketApi.getStore(),
    ]);
    return { products: p.data.data, categories: c.data.data, store: s.data.data };
  });

  const products = useMemo(() => data?.products ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const threshold = data?.store.lowStockThreshold ?? 10;

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  const tabs: readonly TabItem<TabKey>[] = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    for (const p of products) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return TAB_ORDER.map((value) => ({
      value,
      label: value === 'all' ? 'Barchasi' : PRODUCT_STATUS[value].segmentLabel,
      count: counts[value] ?? 0,
    }));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (tab === 'all' ? true : p.status === tab))
      .filter((p) => (categoryId ? p.categoryId === categoryId : true))
      .filter((p) =>
        q ? p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q) : true
      )
      .sort(
        (a, b) =>
          STATE_PRIORITY[a.status] - STATE_PRIORITY[b.status] ||
          a.name.localeCompare(b.name, 'uz')
      );
  }, [products, tab, categoryId, query]);

  const paged = usePagination(filtered, 25);

  const chips: FilterChip[] = [
    ...(query.trim()
      ? [{ key: 'q', label: `Qidiruv: «${query.trim()}»`, onRemove: () => setQuery('') }]
      : []),
    ...(categoryId
      ? [
          {
            key: 'cat',
            label: `Kategoriya: ${categoryName(categoryId)}`,
            onRemove: () => setCategoryId(''),
          },
        ]
      : []),
  ];

  const clearFilters = () => {
    setQuery('');
    setCategoryId('');
    setTab('all');
  };

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
  const selectedCount = selectedIds.length;
  const pageAllSelected = paged.pageItems.length > 0 && paged.pageItems.every((p) => selected[p.id]);

  const toggleAllOnPage = () => {
    const next = { ...selected };
    paged.pageItems.forEach((p) => (next[p.id] = !pageAllSelected));
    setSelected(next);
  };

  const patchProduct = async (id: string, patch: Parameters<typeof marketApi.updateProduct>[1]) => {
    try {
      await marketApi.updateProduct(id, patch);
      await reload();
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
      await reload();
    }
  };

  const setStatus = async (id: string, status: ProductStatus) => {
    setStatusBusyId(id);
    try {
      await patchProduct(id, { status });
    } finally {
      setStatusBusyId(null);
    }
  };

  const bulkSetStatus = async (status: ProductStatus) => {
    setBusy(true);
    try {
      await marketApi.bulkUpdateProducts(selectedIds, status);
      setSelected({});
      await reload();
      toast({ title: `${selectedIds.length} ta mahsulot yangilandi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Ommaviy narx uchun alohida endpoint yo'q — inline narx tahriri ishlatadigan
  // updateProduct har bir tanlangan mahsulotga qo'llanadi (modal oldin
  // ko'rib chiqishni ko'rsatgan bo'ladi).
  const bulkApplyPrice = async (changes: BulkPriceChange[]) => {
    try {
      await Promise.all(changes.map((c) => marketApi.updateProduct(c.id, { price: c.newPrice })));
      setBulkPriceOpen(false);
      setSelected({});
      await reload();
      toast({ title: `${changes.length} ta narx yangilandi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
      await reload();
    }
  };

  const hasFilters = query.trim() !== '' || categoryId !== '' || tab !== 'all';

  return (
    <div>
      <PageHeader
        title="Mahsulotlar"
        description="Katalog, narx va zaxirani boshqaring"
        icon={<Package size={18} aria-hidden />}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void reload()}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw size={13} aria-hidden />}
            >
              Yangilash
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus size={14} aria-hidden />}>
              Mahsulot qo&apos;shish
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs items={tabs} value={tab} onChange={setTab} size="sm" />
        <div className="w-full sm:w-64">
          <Input
            aria-label="Mahsulot qidirish"
            placeholder="Nomi yoki SKU bo'yicha qidirish"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftElement={<Search size={15} aria-hidden />}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            aria-label="Kategoriya bo'yicha filtrlash"
            placeholder="Barcha kategoriyalar"
            options={[
              { value: '', label: 'Barcha kategoriyalar' },
              ...categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` })),
            ]}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
        </div>
      </div>

      <FilterChips chips={chips} onClearAll={clearFilters} className="mb-3" />

      <BulkToolbar
        count={selectedCount}
        busy={busy}
        onSetStatus={(status) => void bulkSetStatus(status)}
        onOpenPrice={() => setBulkPriceOpen(true)}
        onClear={() => setSelected({})}
      />

      {error && products.length > 0 && (
        <DataErrorBanner message={error} onRetry={reload} retrying={isRefreshing} />
      )}

      {isLoading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : error && products.length === 0 ? (
        <ErrorState message={error} onRetry={reload} />
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={24} aria-hidden />}
            title="Katalog hali bo’sh"
            description="Birinchi mahsulotni qo'shsangiz, u shu yerda ko'rinadi."
            action={
              <Button size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus size={14} aria-hidden />}>
                Mahsulot qo&apos;shish
              </Button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          {tab === 'out' && !query.trim() && !categoryId ? (
            <EmptyState
              tone="positive"
              title="Tugagan mahsulot yo'q"
              description="Barcha mahsulotlar sotuvda — zaxira joyida."
            />
          ) : (
            <EmptyState
              title="Hech narsa topilmadi"
              description="Filtr mezonlariga mos mahsulot yo'q."
              action={
                <Button size="sm" variant="secondary" onClick={clearFilters}>
                  Filtrlarni tozalash
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <>
          {/* Desktop: tahrirlanadigan jadval, yopishqoq sarlavha bilan. */}
          <Card padding="none" className="hidden lg:block">
            <div
              className={clsx(
                PRODUCT_ROW_GRID,
                'sticky top-14 z-20 rounded-t-ds-md border-b border-line bg-surface-2 px-4 py-2.5 text-micro uppercase text-muted'
              )}
            >
              <span>
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleAllOnPage}
                  aria-label="Sahifadagi hammasini tanlash"
                  className="h-4 w-4 accent-brand"
                />
              </span>
              <span>Mahsulot</span>
              <span className="hidden xl:block">Kategoriya</span>
              <span className="text-right">Narx (so&apos;m)</span>
              <span className="text-right">Zaxira</span>
              <span>Holat</span>
              <span>Amal</span>
            </div>
            <ul className="divide-y divide-divider">
              {paged.pageItems.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  categoryName={categoryName(p.categoryId)}
                  threshold={threshold}
                  checked={!!selected[p.id]}
                  onCheck={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
                  onSavePrice={(v) => patchProduct(p.id, { price: v })}
                  onSaveStock={(v) => patchProduct(p.id, { stock: Math.max(0, v) })}
                  onSetStatus={(status) => void setStatus(p.id, status)}
                  statusBusy={statusBusyId === p.id}
                />
              ))}
            </ul>
            <Pagination paged={paged} />
          </Card>

          {/* Mobil: bitta mahsulot — bitta karta. */}
          <ul className="space-y-2.5 lg:hidden">
            {paged.pageItems.map((p) => (
              <li key={p.id}>
                <ProductCardMobile
                  product={p}
                  categoryName={categoryName(p.categoryId)}
                  threshold={threshold}
                  checked={!!selected[p.id]}
                  onCheck={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
                  onSavePrice={(v) => patchProduct(p.id, { price: v })}
                  onSaveStock={(v) => patchProduct(p.id, { stock: Math.max(0, v) })}
                  onSetStatus={(status) => void setStatus(p.id, status)}
                  statusBusy={statusBusyId === p.id}
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 lg:hidden">
            <Card padding="none">
              <Pagination paged={paged} className="border-t-0" />
            </Card>
          </div>
        </>
      )}

      {hasFilters && filtered.length > 0 && (
        <p className="mt-3 text-caption text-subtle">
          Filtr qo&apos;llangan: {filtered.length} / {products.length} ta mahsulot ko&apos;rsatilmoqda
        </p>
      )}

      <AddProductModal
        isOpen={showAdd}
        categories={categories}
        onClose={() => setShowAdd(false)}
        onCreated={async () => {
          setShowAdd(false);
          await reload();
          toast({ title: "Mahsulot qo'shildi", variant: 'success' });
        }}
        onError={(msg) => toast({ title: 'Xatolik', description: msg, variant: 'error' })}
      />

      <BulkPriceModal
        isOpen={bulkPriceOpen}
        products={selectedProducts}
        onClose={() => setBulkPriceOpen(false)}
        onApply={bulkApplyPrice}
      />
    </div>
  );
}
