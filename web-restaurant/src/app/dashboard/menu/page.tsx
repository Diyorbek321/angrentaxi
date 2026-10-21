'use client';

import { useCallback, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { foodApi, Dish, MenuCategory } from '@/lib/api';
import { useAsyncData, errorMessage } from '@/hooks/useAsyncData';
import { catalogImageSrc } from '@/lib/catalog-image';
import { formatNumber } from '@/lib/format';
import { usePageRefresh } from '@/components/shell';
import { DishImage } from '@/components/DishImage';
import { DishModal } from '@/components/menu/DishModal';
import { InlinePrice } from '@/components/menu/InlinePrice';
import { DiscountTag } from '@/components/promotions/DiscountTag';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import type { FilterChip } from '@/components/ui/FilterChips';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { intlLocale } from '@/lib/i18n/core';
import { t } from '@/locales';

interface MenuData {
  dishes: Dish[];
  categories: MenuCategory[];
}

/** Katalog HOLAT bo'yicha birinchi bo'linadi (Ozon naqshi): sotuvda / tugagan. */
type AvailFilter = 'all' | 'on' | 'off';

export default function MenuPage() {
  const m = t();
  const mm = m.menu;
  const AVAIL_LABEL: Record<AvailFilter, string> = mm.avail;
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [availFilter, setAvailFilter] = useState<AvailFilter>('all');
  const [editing, setEditing] = useState<Dish | 'new' | null>(null);
  const [removing, setRemoving] = useState<Dish | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<MenuData> => {
    const [d, c] = await Promise.all([foodApi.getDishes(), foodApi.getCategories()]);
    return { dishes: d.data.data, categories: c.data.data };
  }, []);

  const { data, status, error, reload, setData } = useAsyncData<MenuData>(load);
  usePageRefresh(reload);

  const dishes = useMemo(() => data?.dishes ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const categoryName = useCallback(
    (id: string | null) => categories.find((c) => c.id === id)?.name ?? mm.uncategorized,
    [categories, mm]
  );

  const availItems = useMemo(
    () => [
      { value: 'all' as const, label: AVAIL_LABEL.all, count: dishes.length },
      { value: 'on' as const, label: AVAIL_LABEL.on, count: dishes.filter((d) => d.isAvailable).length },
      { value: 'off' as const, label: AVAIL_LABEL.off, count: dishes.filter((d) => !d.isAvailable).length },
    ],
    [dishes, AVAIL_LABEL]
  );

  const q = search.trim().toLocaleLowerCase(intlLocale());
  const filtered = dishes.filter(
    (d) =>
      (catFilter === 'all' || d.categoryId === catFilter) &&
      (availFilter === 'all' || (availFilter === 'on' ? d.isAvailable : !d.isAvailable)) &&
      (!q || d.name.toLocaleLowerCase(intlLocale()).includes(q))
  );

  const clearFilters = () => {
    setSearch('');
    setCatFilter('all');
    setAvailFilter('all');
  };

  const chips: FilterChip[] = [
    ...(catFilter !== 'all'
      ? [{ key: 'cat', label: mm.chipCategory(categoryName(catFilter)), onRemove: () => setCatFilter('all') }]
      : []),
    ...(availFilter !== 'all'
      ? [{ key: 'avail', label: mm.chipStatus(AVAIL_LABEL[availFilter]), onRemove: () => setAvailFilter('all') }]
      : []),
    ...(q ? [{ key: 'q', label: mm.chipSearch(search.trim()), onRemove: () => setSearch('') }] : []),
  ];

  const applyDishUpdate = (updated: Dish) =>
    setData((prev) =>
      prev ? { ...prev, dishes: prev.dishes.map((d) => (d.id === updated.id ? updated : d)) } : prev
    );

  const toggleAvailability = async (dish: Dish) => {
    setBusyId(dish.id);
    try {
      const res = await foodApi.updateDish(dish.id, { isAvailable: !dish.isAvailable });
      const updated = res.data.data;
      applyDishUpdate(updated);
      toast({
        title: updated.isAvailable ? mm.nowOnSale(updated.name) : mm.nowSoldOut(updated.name),
        variant: 'success',
      });
    } catch (err) {
      toast({ title: mm.statusChangeFailed, description: errorMessage(err), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemovePending(true);
    try {
      await foodApi.deleteDish(removing.id);
      toast({ title: mm.removed(removing.name), variant: 'success' });
    } catch (err) {
      toast({ title: mm.removeFailed, description: errorMessage(err), variant: 'error' });
    } finally {
      setRemovePending(false);
      setRemoving(null);
      await reload();
    }
  };

  const columns: DataTableColumn<Dish>[] = [
    {
      key: 'dish',
      header: mm.colDish,
      cell: (dish) => (
        <div className="flex min-w-0 items-center gap-3">
          <DishImage src={catalogImageSrc(dish.imageKey)} name={dish.name} className="h-10 w-10 rounded-ds-sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{dish.name}</p>
            <p className="line-clamp-1 text-xs text-muted">{dish.description || mm.noDescription}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: mm.colCategory, hideBelow: 'md', cell: (dish) => categoryName(dish.categoryId) },
    {
      key: 'prep',
      header: mm.colPrep,
      numeric: true,
      hideBelow: 'lg',
      cell: (dish) => mm.prepMinutes(formatNumber(dish.prepMinutes)),
    },
    {
      key: 'price',
      header: mm.colPrice,
      numeric: true,
      width: 'w-44',
      cell: (dish) => (
        <span className="flex flex-col items-end">
          <InlinePrice dish={dish} onSaved={applyDishUpdate} />
          <DiscountTag item={dish} />
        </span>
      ),
    },
    {
      key: 'available',
      header: mm.colAvailable,
      width: 'w-32',
      cell: (dish) => (
        <Switch
          checked={dish.isAvailable}
          disabled={busyId === dish.id}
          onCheckedChange={() => toggleAvailability(dish)}
          aria-label={mm.onSaleAria(dish.name)}
          label={
            <span className={dish.isAvailable ? 'text-ink' : 'text-muted'}>
              {dish.isAvailable ? AVAIL_LABEL.on : AVAIL_LABEL.off}
            </span>
          }
        />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{m.common.actions}</span>,
      align: 'right',
      width: 'w-24',
      cell: (dish) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton aria-label={mm.editAria(dish.name)} onClick={() => setEditing(dish)}>
            <Pencil aria-hidden />
          </IconButton>
          <IconButton variant="danger-ghost" aria-label={mm.deleteAria(dish.name)} onClick={() => setRemoving(dish)}>
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      ),
    },
  ];

  const hasDishes = dishes.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={mm.title}
        description={
          status === 'ready'
            ? mm.summary(formatNumber(dishes.length), formatNumber(availItems[2].count))
            : mm.description
        }
        actions={
          <Button leftIcon={<Plus size={15} />} onClick={() => setEditing('new')}>
            {mm.newDish}
          </Button>
        }
      />

      <DataTable
        ariaLabel={mm.tableAria}
        columns={columns}
        rows={filtered}
        rowKey={(d) => d.id}
        loading={status === 'loading'}
        error={error}
        onRetry={reload}
        rowClassName={(d) => (d.isAvailable ? undefined : 'bg-surface-2/40')}
        toolbar={
          hasDishes ? (
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={mm.searchPlaceholder}
              chips={chips}
              onClearAll={clearFilters}
            >
              <SegmentedControl
                items={availItems}
                value={availFilter}
                onChange={setAvailFilter}
                label={mm.availFilter}
              />
              {categories.length > 0 && (
                <Select
                  aria-label={mm.categoryFilter}
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  wrapperClassName="w-full sm:w-52"
                  options={[
                    { value: 'all', label: mm.allCategories },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
            </FilterBar>
          ) : undefined
        }
        isFiltered={hasDishes}
        onClearFilters={clearFilters}
        emptyFiltered={{ title: mm.emptyFilteredTitle, description: mm.emptyFilteredDescription }}
        empty={{
          variant: 'first-use',
          icon: <UtensilsCrossed size={20} />,
          title: mm.emptyTitle,
          description: mm.emptyDescription,
          action: (
            <Button leftIcon={<Plus size={15} />} onClick={() => setEditing('new')}>
              {mm.emptyAction}
            </Button>
          ),
        }}
      />

      {editing && (
        <DishModal
          dish={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={removing != null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        isPending={removePending}
        title={mm.removeTitle}
        description={
          removing
            ? mm.removeDescription(removing.name)
            : undefined
        }
        confirmLabel={m.common.delete}
      />
    </div>
  );
}
