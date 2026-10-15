'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, Tags, Trash2 } from 'lucide-react';
import { marketApi, MarketCategory, Product } from '@/lib/api';
import { errorMessage, hueTint } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Switch } from '@/components/ui/Switch';
import { CategoryModal } from '@/components/categories/CategoryModal';
import { usePageRefresh } from '@/components/shell';

const HUES = [45, 200, 25, 280, 150, 320];

interface CategoriesData {
  categories: MarketCategory[];
  products: Product[];
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MarketCategory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MarketCategory | null>(null);
  const [reordering, setReordering] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<CategoriesData>(
    async () => {
      const [c, p] = await Promise.all([marketApi.getCategories(), marketApi.getProducts()]);
      return { categories: c.data.data, products: p.data.data };
    }
  );
  usePageRefresh(reload);

  // Mijoz ilovasida ko'rinadigan tartib — sortOrder bo'yicha.
  const categories = useMemo(
    () =>
      [...(data?.categories ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'uz')
      ),
    [data]
  );

  const productCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data?.products ?? []) {
      if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  const toggle = async (c: MarketCategory) => {
    try {
      await marketApi.updateCategory(c.id, { isActive: !c.isActive });
      await reload();
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    }
  };

  /** Yuqoriga/pastga: ikkala qo'shni ham YANGI o'rnini sortOrder qilib oladi. */
  const move = async (index: number, dir: -1 | 1) => {
    const target = categories[index];
    const neighbor = categories[index + dir];
    if (!target || !neighbor) return;
    setReordering(true);
    try {
      await Promise.all([
        marketApi.updateCategory(target.id, { sortOrder: index + dir }),
        marketApi.updateCategory(neighbor.id, { sortOrder: index }),
      ]);
      await reload();
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setReordering(false);
    }
  };

  const confirmRemove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await marketApi.deleteCategory(pendingDelete.id);
      setPendingDelete(null);
      await reload();
      toast({ title: "Kategoriya o'chirildi", variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const save = async (form: { name: string; emoji: string }) => {
    try {
      if (editing) {
        await marketApi.updateCategory(editing.id, form);
      } else {
        await marketApi.createCategory({ ...form, sortOrder: categories.length });
      }
      setModalOpen(false);
      setEditing(null);
      await reload();
      toast({ title: editing ? 'Saqlandi' : "Kategoriya qo'shildi", variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const columns: DataTableColumn<MarketCategory>[] = [
    {
      key: 'order',
      header: <span className="sr-only">Tartib</span>,
      width: 'w-16',
      cell: (c) => {
        const i = categories.indexOf(c);
        return (
          // Tartib: drag emas — aniq yuqoriga/pastga tugmalar.
          <span className="inline-flex items-center">
            <IconButton
              size="sm"
              aria-label={`${c.name} — yuqoriga ko'tarish`}
              disabled={i === 0 || reordering}
              onClick={() => void move(i, -1)}
            >
              <ChevronUp aria-hidden />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={`${c.name} — pastga tushirish`}
              disabled={i === categories.length - 1 || reordering}
              onClick={() => void move(i, 1)}
            >
              <ChevronDown aria-hidden />
            </IconButton>
          </span>
        );
      },
    },
    {
      key: 'name',
      header: 'Kategoriya',
      cell: (c) => {
        const i = categories.indexOf(c);
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              style={hueTint(HUES[i % HUES.length])}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-xs text-base"
            >
              {c.emoji}
            </span>
            <span className={c.isActive ? 'truncate font-medium text-ink' : 'truncate font-medium text-muted'}>
              {c.name}
            </span>
          </span>
        );
      },
    },
    {
      key: 'count',
      header: 'Mahsulot',
      numeric: true,
      width: 'w-28',
      cell: (c) => `${formatNumber(productCount[c.id] ?? 0)} ta`,
    },
    {
      key: 'active',
      header: 'Faol',
      width: 'w-20',
      cell: (c) => (
        <Switch
          size="sm"
          checked={c.isActive}
          onCheckedChange={() => void toggle(c)}
          aria-label={`${c.name} — faol holati`}
        />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Amallar</span>,
      align: 'right',
      width: 'w-20',
      cell: (c) => (
        <span className="inline-flex items-center">
          <IconButton
            size="sm"
            aria-label={`${c.name} kategoriyasini tahrirlash`}
            onClick={() => {
              setEditing(c);
              setModalOpen(true);
            }}
          >
            <Pencil aria-hidden />
          </IconButton>
          <IconButton
            size="sm"
            variant="danger-ghost"
            aria-label={`${c.name} kategoriyasini o'chirish`}
            onClick={() => setPendingDelete(c)}
          >
            <Trash2 aria-hidden />
          </IconButton>
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Kategoriyalar"
        description="Mahsulot guruhlari va ularning mijoz ilovasidagi tartibi"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void reload()}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw size={14} aria-hidden />}
            >
              Yangilash
            </Button>
            <Button onClick={openCreate} leftIcon={<Plus size={14} aria-hidden />}>
              Kategoriya qo&apos;shish
            </Button>
          </>
        }
      />

      {error && data && <DataErrorBanner message={error} onRetry={reload} retrying={isRefreshing} />}

      <DataTable
        ariaLabel="Kategoriyalar"
        columns={columns}
        rows={categories}
        rowKey={(c) => c.id}
        loading={isLoading}
        error={data ? null : error}
        onRetry={reload}
        empty={{
          variant: 'first-use',
          icon: <Tags aria-hidden />,
          title: "Kategoriya yo'q",
          description: 'Kategoriyalar mahsulotlarni mijoz uchun guruhlaydi.',
          action: (
            <Button size="sm" onClick={openCreate} leftIcon={<Plus size={14} aria-hidden />}>
              Birinchi kategoriya
            </Button>
          ),
        }}
      />

      <CategoryModal
        isOpen={modalOpen}
        category={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={save}
      />

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmRemove}
        title={`«${pendingDelete?.name ?? ''}» kategoriyasini o'chirish`}
        description={
          <>
            Bu amalni bekor qilib bo&apos;lmaydi.{' '}
            {pendingDelete && (productCount[pendingDelete.id] ?? 0) > 0
              ? `Ichidagi ${productCount[pendingDelete.id]} ta mahsulot kategoriyasiz qoladi.`
              : 'Bu kategoriyada mahsulot yo‘q.'}
          </>
        }
        confirmLabel="O'chirish"
        tone="danger"
        isPending={deleting}
      />
    </div>
  );
}
