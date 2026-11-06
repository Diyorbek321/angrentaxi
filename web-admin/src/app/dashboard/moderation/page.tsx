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
import { t } from '@/locales';

type Tab = 'products' | 'dishes';

interface DeleteTarget {
  kind: Tab;
  id: string;
  name: string;
  vendor: string;
}

function productStatus(): Record<string, { label: string; variant: BadgeVariant }> {
  const s = t().moderation.productStatus;
  return {
    active: { label: s.active, variant: 'success' },
    out: { label: s.out, variant: 'neutral' },
    hidden: { label: s.hidden, variant: 'neutral' },
  };
}

function NameCell({ name, imageKey }: { name: string; imageKey?: string | null }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <CatalogThumb imageKey={imageKey} name={name} />
      <span className="font-medium text-ink truncate">{name}</span>
    </div>
  );
}

export default function ModerationPage() {
  const m = t();
  const mo = m.moderation;
  const PRODUCT_STATUS = productStatus();
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
      setError(mo.loadError);
      toast({ title: m.common.error, description: mo.loadError, variant: 'error' });
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
        title: mo.deleted(deleteTarget.name),
        description: mo.deletedDesc,
        variant: 'success',
      });
      setDeleteTarget(null);
    } catch {
      toast({ title: m.common.error, description: mo.deleteFailed, variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const deleteButton = (target: DeleteTarget) => (
    <Button
      size="sm"
      variant="danger-ghost"
      leftIcon={<Trash2 size={13} aria-hidden />}
      aria-label={mo.deleteAria(target.name)}
      onClick={() => setDeleteTarget(target)}
    >
      {mo.delete}
    </Button>
  );

  const productColumns: DataTableColumn<ModeratedProduct>[] = [
    { key: 'name', header: mo.colProduct, cell: (p) => <NameCell name={p.name} imageKey={p.imageKey} /> },
    { key: 'vendor', header: mo.colStore, cell: (p) => <span className="text-muted">{p.store?.name ?? '—'}</span> },
    { key: 'price', header: mo.colPrice, numeric: true, cell: (p) => <MoneyText value={p.price} /> },
    {
      key: 'status',
      header: mo.colStatus,
      cell: (p) => {
        const s = PRODUCT_STATUS[p.status];
        return <Badge variant={s?.variant ?? 'neutral'}>{s?.label ?? p.status}</Badge>;
      },
    },
    {
      key: 'actions',
      header: <span className="sr-only">{mo.colAction}</span>,
      align: 'right',
      cell: (p) => deleteButton({ kind: 'products', id: p.id, name: p.name, vendor: p.store?.name ?? '—' }),
    },
  ];

  const dishColumns: DataTableColumn<ModeratedDish>[] = [
    { key: 'name', header: mo.colDish, cell: (d) => <NameCell name={d.name} imageKey={d.imageKey} /> },
    { key: 'vendor', header: mo.colRestaurant, cell: (d) => <span className="text-muted">{d.restaurant?.name ?? '—'}</span> },
    { key: 'price', header: mo.colPrice, numeric: true, cell: (d) => <MoneyText value={d.price} /> },
    {
      key: 'status',
      header: mo.colStatus,
      cell: (d) => (
        <Badge variant={d.isAvailable ? 'success' : 'neutral'} dot>
          {d.isAvailable ? mo.available : mo.outOfStock}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{mo.colAction}</span>,
      align: 'right',
      cell: (d) => deleteButton({ kind: 'dishes', id: d.id, name: d.name, vendor: d.restaurant?.name ?? '—' }),
    },
  ];

  const empty: EmptyStateProps = q
    ? {
        variant: 'no-results',
        title: mo.noMatchTitle,
        description: tab === 'products' ? mo.noMatchProducts(q) : mo.noMatchDishes(q),
        onClearFilters: clearSearch,
      }
    : {
        // An empty queue is a HEALTHY state.
        variant: 'cleared',
        icon: <CheckCircle2 aria-hidden />,
        title: mo.queueEmpty,
        description: tab === 'products' ? mo.queueEmptyProducts : mo.queueEmptyDishes,
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
      searchPlaceholder={mo.searchPlaceholder}
      searchAriaLabel={mo.searchAria}
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
        title={mo.title}
        description={mo.description}
      />

      <Tabs
        ariaLabel={mo.tabsAria}
        className="mb-4"
        items={[
          { value: 'products', label: mo.products, count: totals.products },
          { value: 'dishes', label: mo.dishes, count: totals.dishes },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v as Tab);
          resetPage();
        }}
      />

      {tab === 'products' ? (
        <DataTable ariaLabel={mo.products} columns={productColumns} rows={products} rowKey={(p) => p.id} {...common} />
      ) : (
        <DataTable ariaLabel={mo.dishes} columns={dishColumns} rows={dishes} rowKey={(d) => d.id} {...common} />
      )}

      {/* Destructive — always confirmed; the consequence and the name are spelled out. */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isPending={deleting}
        title={deleteTarget?.kind === 'products' ? mo.deleteProduct : mo.deleteDish}
        description={
          <>
            <strong className="text-ink">«{deleteTarget?.name}»</strong> ({deleteTarget?.vendor})
            {mo.deleteBody}
          </>
        }
        confirmLabel={mo.delete}
      />
    </div>
  );
}
