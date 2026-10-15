'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, RefreshCw } from 'lucide-react';
import { marketApi, MarketCategory, Product, ProductPage, ProductStatus, Store } from '@/lib/api';
import { PRODUCT_STATUS } from '@/lib/product-status';
import { errorMessage } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useServerPagination } from '@/hooks/usePagination';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { type FilterChip } from '@/components/ui/FilterChips';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { type TabItem } from '@/components/ui/Tabs';
import { AddProductModal } from '@/components/products/AddProductModal';
import { ProductImageModal } from '@/components/products/ProductImageModal';
import { BulkPriceModal, type BulkPriceChange } from '@/components/products/BulkPriceModal';
import { productColumns } from '@/components/products/productColumns';
import { usePageRefresh } from '@/components/shell';

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
  usePageRefresh(reload);

  const products = useMemo(() => data?.products ?? [], [data]);
  const total = data?.total ?? 0;
  const categories = useMemo(() => meta.data?.categories ?? [], [meta.data]);
  // Haqiqiy do'kon sozlamasi; u kelguncha faqat "tugagan" belgilanadi (soxta chegara yo'q).
  const threshold = meta.data?.store.lowStockThreshold ?? 0;
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
  const selectedKeys = useMemo(() => new Set(Object.keys(selected)), [selected]);

  // DataTable kalitlar to'plamini beradi; mahsulotning o'zi saqlanadi —
  // tanlov sahifalar orasida yashaydi (ommaviy narx eski sahifadagini ham oladi).
  const changeSelection = (keys: Set<string>) =>
    setSelected((s) => {
      const next: Record<string, Product> = {};
      keys.forEach((k) => {
        const p = s[k] ?? products.find((x) => x.id === k);
        if (p) next[k] = p;
      });
      return next;
    });

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
  // "Tugaganlar" tabi bo'sh = yaxshi xabar (filtr natijasi emas).
  const outOfStockCleared = tab === 'out' && !search && !categoryId;

  const columns = productColumns({
    categoryName,
    threshold,
    onSavePrice: (p, v) => patchProduct(p.id, { price: v }),
    onSaveStock: (p, v) => patchProduct(p.id, { stock: Math.max(0, v) }),
    onSetStatus: (p, status) => void setStatus(p.id, status),
    statusBusyId,
    onEditImage: setImageFor,
  });

  const openAdd = () => setShowAdd(true);

  return (
    <div>
      <PageHeader
        title="Mahsulotlar"
        description={
          data ? `${formatNumber(data.counts.all)} ta mahsulot · narx va zaxira jadvalda tahrirlanadi` : 'Katalog, narx va zaxira'
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void reloadAll()}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw size={14} aria-hidden />}
            >
              Yangilash
            </Button>
            <Button onClick={openAdd} leftIcon={<Plus size={14} aria-hidden />}>
              Mahsulot qo&apos;shish
            </Button>
          </>
        }
      />

      <DataTable
        ariaLabel="Mahsulotlar"
        columns={columns}
        rows={catalogEmpty ? [] : products}
        rowKey={(p) => p.id}
        loading={isLoading || (isRefreshing && products.length === 0)}
        error={error}
        onRetry={reload}
        selectable
        rowLabel={(p) => p.name}
        selectedKeys={selectedKeys}
        onSelectionChange={changeSelection}
        bulkActions={() => (
          <>
            <Button size="sm" variant="secondary" isLoading={busy} onClick={() => void bulkSetStatus('active')}>
              Faollashtirish
            </Button>
            <Button size="sm" variant="secondary" isLoading={busy} onClick={() => void bulkSetStatus('hidden')}>
              Yashirish
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkPriceOpen(true)}>
              Narxni o&apos;zgartirish
            </Button>
          </>
        )}
        pagination={{ paged }}
        toolbar={
          <FilterBar
            searchAriaLabel="Mahsulot qidirish"
            searchPlaceholder="Nomi yoki SKU"
            search={query}
            onSearchChange={setQuery}
            searchClassName="w-full sm:w-60"
            chips={chips}
            onClearAll={clearFilters}
          >
            <SegmentedControl items={tabs} value={tab} onChange={changeTab} ariaLabel="Mahsulot holati" />
            <Select
              aria-label="Kategoriya bo'yicha filtrlash"
              options={[
                { value: '', label: 'Barcha kategoriyalar' },
                ...categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` })),
              ]}
              value={categoryId}
              onChange={(e) => changeCategory(e.target.value)}
              wrapperClassName="w-full sm:w-52"
            />
          </FilterBar>
        }
        isFiltered={!catalogEmpty && !outOfStockCleared}
        onClearFilters={clearFilters}
        emptyFiltered={{ title: 'Hech narsa topilmadi', description: 'Filtr mezonlariga mos mahsulot yoʻq.' }}
        empty={
          catalogEmpty
            ? {
                variant: 'first-use',
                icon: <Package aria-hidden />,
                title: 'Katalog hali boʻsh',
                description: 'Birinchi mahsulotni qoʻshsangiz, u shu yerda koʻrinadi.',
                action: (
                  <Button size="sm" onClick={openAdd} leftIcon={<Plus size={14} aria-hidden />}>
                    Mahsulot qo&apos;shish
                  </Button>
                ),
              }
            : {
                variant: 'cleared',
                title: 'Tugagan mahsulot yoʻq',
                description: 'Barcha mahsulotlar sotuvda — zaxira joyida.',
              }
        }
      />

      {hasFilters && total > 0 && (
        <p className="num mt-2 text-xs text-muted">
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
