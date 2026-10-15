'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import type { EmptyStateProps } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MoneyText } from '@/components/ui/MoneyText';
import { moderationApi, ModeratedProduct, ModeratedDish } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { debounce } from '@/lib/utils';
import { usePagination } from '@/hooks/usePagination';
import { CatalogThumb } from '@/components/moderation/CatalogThumb';

type Tab = 'products' | 'dishes';

interface DeleteTarget {
  kind: Tab;
  id: string;
  name: string;
  vendor: string;
}

const PRODUCT_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Faol', variant: 'success' },
  out: { label: 'Tugagan', variant: 'neutral' },
  hidden: { label: 'Yashirin', variant: 'neutral' },
};

function NameCell({ name, imageKey }: { name: string; imageKey?: string | null }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <CatalogThumb imageKey={imageKey} name={name} />
      <span className="font-medium text-ink truncate">{name}</span>
    </div>
  );
}

export default function ModerationPage() {
  const { toast } = useToast();
  // Most-used first (the product queue is bigger).
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<ModeratedProduct[]>([]);
  const [dishes, setDishes] = useState<ModeratedDish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Text in the input (instant) and the text sent to the server (after 400 ms). */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [totals, setTotals] = useState<Record<Tab, number>>({ products: 0, dishes: 0 });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pagination = usePagination(20);
  const { page, limit, setTotal, reset: resetPage } = pagination;

  // Server pages and searches the catalog.
  const load = useCallback(async () => {
    setIsLoading(true);
    const params = { page, limit, search: search.trim() || undefined };
    try {
      if (tab === 'products') {
        const res = (await moderationApi.getProducts(params)).data.data;
        setProducts(res.products);
        setTotals((t) => ({ ...t, products: res.total }));
        setTotal(res.total, Math.max(1, Math.ceil(res.total / res.limit)));
      } else {
        const res = (await moderationApi.getDishes(params)).data.data;
        setDishes(res.dishes);
        setTotals((t) => ({ ...t, dishes: res.total }));
        setTotal(res.total, Math.max(1, Math.ceil(res.total / res.limit)));
      }
      setError(null);
    } catch {
      setError('Moderatsiya navbatini yuklashda xatolik');
      toast({ title: 'Xatolik', description: 'Moderatsiya navbatini yuklashda xatolik', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [tab, page, limit, search, setTotal, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // The other tab's count too — one-row lightweight request.
  useEffect(() => {
    void Promise.all([
      moderationApi.getProducts({ page: 1, limit: 1 }),
      moderationApi.getDishes({ page: 1, limit: 1 }),
    ])
      .then(([p, d]) => setTotals({ products: p.data.data.total, dishes: d.data.data.total }))
      .catch(() => {});
  }, []);

  const debouncedSearch = useRef(
    debounce((value: string) => {
      setSearch(value);
      resetPage();
    }, 400)
  ).current;

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSearch(value);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    resetPage();
  };

  const q = search.trim();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'products') {
        await moderationApi.deleteProduct(deleteTarget.id);
      } else {
        await moderationApi.deleteDish(deleteTarget.id);
      }
      // Reload from the server: the next page's item fills the gap.
      await load();
      toast({
        title: `«${deleteTarget.name}» o'chirildi`,
        description: 'Sotuvchi katalogidan butunlay olib tashlandi.',
        variant: 'success',
      });
      setDeleteTarget(null);
    } catch {
      toast({ title: 'Xatolik', description: "O'chirishda xatolik", variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const deleteButton = (target: DeleteTarget) => (
    <Button
      size="sm"
      variant="danger-ghost"
      leftIcon={<Trash2 size={13} aria-hidden />}
      aria-label={`${target.name} — o'chirish`}
      onClick={() => setDeleteTarget(target)}
    >
      O&apos;chirish
    </Button>
  );

  const productColumns: DataTableColumn<ModeratedProduct>[] = [
    { key: 'name', header: 'Mahsulot', cell: (p) => <NameCell name={p.name} imageKey={p.imageKey} /> },
    { key: 'vendor', header: "Do'kon", cell: (p) => <span className="text-muted">{p.store?.name ?? '—'}</span> },
    { key: 'price', header: 'Narx', numeric: true, cell: (p) => <MoneyText value={p.price} /> },
    {
      key: 'status',
      header: 'Holat',
      cell: (p) => {
        const s = PRODUCT_STATUS[p.status];
        return <Badge variant={s?.variant ?? 'neutral'}>{s?.label ?? p.status}</Badge>;
      },
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amal</span>,
      align: 'right',
      cell: (p) => deleteButton({ kind: 'products', id: p.id, name: p.name, vendor: p.store?.name ?? '—' }),
    },
  ];

  const dishColumns: DataTableColumn<ModeratedDish>[] = [
    { key: 'name', header: 'Taom', cell: (d) => <NameCell name={d.name} imageKey={d.imageKey} /> },
    { key: 'vendor', header: 'Restoran', cell: (d) => <span className="text-muted">{d.restaurant?.name ?? '—'}</span> },
    { key: 'price', header: 'Narx', numeric: true, cell: (d) => <MoneyText value={d.price} /> },
    {
      key: 'status',
      header: 'Holat',
      cell: (d) => (
        <Badge variant={d.isAvailable ? 'success' : 'neutral'} dot>
          {d.isAvailable ? 'Mavjud' : 'Tugagan'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amal</span>,
      align: 'right',
      cell: (d) => deleteButton({ kind: 'dishes', id: d.id, name: d.name, vendor: d.restaurant?.name ?? '—' }),
    },
  ];

  const empty: EmptyStateProps = q
    ? {
        variant: 'no-results',
        title: 'Hech narsa mos kelmadi',
        description: `"${q}" bo'yicha ${tab === 'products' ? 'mahsulot' : 'taom'} topilmadi.`,
        onClearFilters: clearSearch,
      }
    : {
        // An empty queue is a HEALTHY state.
        variant: 'cleared',
        icon: <CheckCircle2 aria-hidden />,
        title: "Navbat bo'sh",
        description:
          tab === 'products'
            ? "Ko'rib chiqilishi kerak bo'lgan mahsulot qolmadi."
            : "Ko'rib chiqilishi kerak bo'lgan taom qolmadi.",
      };

  const tablePagination = {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    totalPages: pagination.totalPages,
    pageRange: pagination.pageRange,
    canGoPrev: pagination.canGoPrev,
    canGoNext: pagination.canGoNext,
    onPageChange: pagination.goToPage,
    onLimitChange: pagination.setLimit,
  };

  const toolbar = (
    <FilterBar
      search={searchInput}
      onSearchChange={handleSearchChange}
      onSearchClear={clearSearch}
      searchPlaceholder="Nomi yoki sotuvchi…"
      searchAriaLabel="Moderatsiya navbatida qidirish"
    />
  );

  const common = {
    loading: isLoading,
    error,
    onRetry: load,
    empty,
    toolbar,
    pagination: tablePagination,
    maxHeightClassName: 'max-h-[calc(100vh-300px)]',
  };

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        title="Moderatsiya"
        description="Barcha do'kon va restoranlar bo'yicha mahsulot va taomlarni ko'rib chiqish"
      />

      <Tabs
        ariaLabel="Moderatsiya turi"
        className="mb-4"
        items={[
          { value: 'products', label: 'Mahsulotlar', count: totals.products },
          { value: 'dishes', label: 'Taomlar', count: totals.dishes },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v as Tab);
          resetPage();
        }}
      />

      {tab === 'products' ? (
        <DataTable ariaLabel="Mahsulotlar" columns={productColumns} rows={products} rowKey={(p) => p.id} {...common} />
      ) : (
        <DataTable ariaLabel="Taomlar" columns={dishColumns} rows={dishes} rowKey={(d) => d.id} {...common} />
      )}

      {/* Destructive — always confirmed; the consequence and the name are spelled out. */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isPending={deleting}
        title={deleteTarget?.kind === 'products' ? "Mahsulotni o'chirish" : "Taomni o'chirish"}
        description={
          <>
            <strong className="text-ink">«{deleteTarget?.name}»</strong> ({deleteTarget?.vendor}) katalogdan
            butunlay o&apos;chiriladi va mijozlarga ko&apos;rinmay qoladi. Bu amalni ortga qaytarib bo&apos;lmaydi.
          </>
        }
        confirmLabel="O'chirish"
      />
    </div>
  );
}
