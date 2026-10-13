'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, RefreshCw, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, MarketCategory, Product, ProductPage, ProductStatus, Store } from '@/lib/api';
import { PRODUCT_STATUS } from '@/lib/product-status';
import { errorMessage } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useServerPagination } from '@/hooks/usePagination';
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
import { ProductImageModal } from '@/components/products/ProductImageModal';
import { BulkPriceModal, type BulkPriceChange } from '@/components/products/BulkPriceModal';
import { BulkToolbar } from '@/components/products/BulkToolbar';
import {
  PRODUCT_ROW_GRID,
  ProductCardMobile,
  ProductRow,
} from '@/components/products/ProductRow';

interface CatalogMeta {
  categories: MarketCategory[];
  store: Store;
}

type TabKey = 'all' | ProductStatus;

/** Katalog HOLAT bo'yicha birinchi bo'linadi (Ozon naqshi) — real API holatlari. */
const TAB_ORDER: TabKey[] = ['all', 'active', 'out', 'hidden'];

/** Qidiruv har harfda emas, yozish to'xtagach serverga ketadi. */
const SEARCH_DEBOUNCE_MS = 300;

export default function ProductsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('all');
  /** Tanlov sahifalar orasida saqlanadi — shuning uchun mahsulotning o'zi saqlanadi. */
  const [selected, setSelected] = useState<Record<string, Product>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [imageFor, setImageFor] = useState<Product | null>(null);

  const pager = useServerPagination(25);
  const { page, pageSize, setPage } = pager;

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, setPage]);

  const meta = useAsyncData<CatalogMeta>(async () => {
    const [c, s] = await Promise.all([marketApi.getCategories(), marketApi.getStore()]);
    return { categories: c.data.data, store: s.data.data };
  });

  // Katalog server tomonida sahifalanadi va filtrlanadi — katalog o'sgani sari
  // hammasini olib brauzerda saralash sekinlashib borardi.
  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<ProductPage>(
    async () =>
      (
        await marketApi.browseProducts({
          page,
          limit: pageSize,
          search: search || undefined,
          status: tab === 'all' ? undefined : tab,
          categoryId: categoryId || undefined,
        })
      ).data.data,
    [page, pageSize, search, tab, categoryId]
  );

  const products = useMemo(() => data?.products ?? [], [data]);
  const total = data?.total ?? 0;
  const categories = useMemo(() => meta.data?.categories ?? [], [meta.data]);
  const threshold = meta.data?.store.lowStockThreshold ?? 10;
  const paged = pager.toPaged(products, total);

  // Tanlangan qatorlar sahifadagi eng yangi nusxa bilan yangilanadi — inline
  // narx tahriridan keyin ommaviy narx eski narxdan hisoblanmasin.
  useEffect(() => {
    if (!data) return;
    setSelected((s) => {
      const fresh = data.products.filter((p) => s[p.id] && s[p.id] !== p);
      return fresh.length ? { ...s, ...Object.fromEntries(fresh.map((p) => [p.id, p])) } : s;
    });
  }, [data]);

  // O'chirish yoki holat o'zgarishidan keyin sahifa bo'shab qolsa — oxirgisiga qaytamiz.
  useEffect(() => {
    if (data && page > paged.pageCount) setPage(paged.pageCount);
  }, [data, page, paged.pageCount, setPage]);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  const tabs: readonly TabItem<TabKey>[] = useMemo(
    () =>
      TAB_ORDER.map((value) => ({
        value,
        label: value === 'all' ? 'Barchasi' : PRODUCT_STATUS[value].segmentLabel,
        count: data?.counts[value] ?? 0,
      })),
    [data]
  );

  const changeTab = (next: TabKey) => {
    setTab(next);
    setPage(1);
  };

  const changeCategory = (next: string) => {
    setCategoryId(next);
    setPage(1);
  };

  const reloadAll = async () => {
    await Promise.all([reload(), meta.reload()]);
  };

  const chips: FilterChip[] = [
    ...(query.trim()
      ? [{ key: 'q', label: `Qidiruv: «${query.trim()}»`, onRemove: () => setQuery('') }]
      : []),
    ...(categoryId
      ? [
          {
            key: 'cat',
            label: `Kategoriya: ${categoryName(categoryId)}`,
            onRemove: () => changeCategory(''),
          },
        ]
      : []),
  ];

  const clearFilters = () => {
    setQuery('');
    setSearch('');
    setCategoryId('');
    setTab('all');
    setPage(1);
  };

  const selectedProducts = Object.values(selected);
  const selectedIds = selectedProducts.map((p) => p.id);
  const selectedCount = selectedIds.length;
  const pageAllSelected = products.length > 0 && products.every((p) => selected[p.id]);

  const toggleOne = (p: Product) =>
    setSelected((s) => {
      if (!s[p.id]) return { ...s, [p.id]: p };
      const { [p.id]: _removed, ...rest } = s;
      return rest;
    });

  const toggleAllOnPage = () => {
    const pageIds = new Set(products.map((p) => p.id));
    setSelected((s) =>
      pageAllSelected
        ? Object.fromEntries(Object.entries(s).filter(([id]) => !pageIds.has(id)))
        : { ...s, ...Object.fromEntries(products.map((p) => [p.id, p])) }
    );
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

  const hasFilters = search !== '' || categoryId !== '' || tab !== 'all';
  const catalogEmpty = !hasFilters && total === 0;

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
              onClick={() => void reloadAll()}
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
        <Tabs items={tabs} value={tab} onChange={changeTab} size="sm" />
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
            onChange={(e) => changeCategory(e.target.value)}
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
      ) : catalogEmpty ? (
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
      ) : total === 0 ? (
        <Card>
          {tab === 'out' && !search && !categoryId ? (
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
                  onCheck={() => toggleOne(p)}
                  onSavePrice={(v) => patchProduct(p.id, { price: v })}
                  onSaveStock={(v) => patchProduct(p.id, { stock: Math.max(0, v) })}
                  onSetStatus={(status) => void setStatus(p.id, status)}
                  statusBusy={statusBusyId === p.id}
                  onEditImage={() => setImageFor(p)}
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
                  onCheck={() => toggleOne(p)}
                  onSavePrice={(v) => patchProduct(p.id, { price: v })}
                  onSaveStock={(v) => patchProduct(p.id, { stock: Math.max(0, v) })}
                  onSetStatus={(status) => void setStatus(p.id, status)}
                  statusBusy={statusBusyId === p.id}
                  onEditImage={() => setImageFor(p)}
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

      {hasFilters && total > 0 && (
        <p className="mt-3 text-caption text-subtle">
          Filtr qo&apos;llangan: {total} ta mahsulot topildi
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

      {imageFor && (
        <ProductImageModal
          product={imageFor}
          onClose={() => setImageFor(null)}
          onSaved={async () => {
            setImageFor(null);
            await reload();
            toast({ title: 'Rasm yangilandi', variant: 'success' });
          }}
          onError={(msg) => toast({ title: 'Xatolik', description: msg, variant: 'error' })}
        />
      )}

      <BulkPriceModal
        isOpen={bulkPriceOpen}
        products={selectedProducts}
        onClose={() => setBulkPriceOpen(false)}
        onApply={bulkApplyPrice}
      />
    </div>
  );
}
