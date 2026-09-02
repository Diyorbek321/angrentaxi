'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, Tags, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, MarketCategory, Product } from '@/lib/api';
import { errorMessage, hueTint } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataErrorBanner } from '@/components/ui/DataErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { CategoryModal } from '@/components/categories/CategoryModal';

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

  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<CategoriesData>(
    async () => {
      const [c, p] = await Promise.all([marketApi.getCategories(), marketApi.getProducts()]);
      return { categories: c.data.data, products: p.data.data };
    }
  );

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
    try {
      await marketApi.deleteCategory(pendingDelete.id);
      setPendingDelete(null);
      await reload();
      toast({ title: "Kategoriya o'chirildi", variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
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

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Kategoriyalar"
        description="Mahsulot guruhlari va ularning mijozga ko'rinish tartibi"
        icon={<Tags size={18} aria-hidden />}
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
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              leftIcon={<Plus size={14} aria-hidden />}
            >
              Kategoriya
            </Button>
          </>
        }
      />

      {error && data && <DataErrorBanner message={error} onRetry={reload} retrying={isRefreshing} />}

      {isLoading ? (
        <SkeletonCards count={4} height="h-[72px]" />
      ) : error && categories.length === 0 ? (
        <ErrorState message={error} onRetry={reload} />
      ) : categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tags size={24} aria-hidden />}
            title="Kategoriya yo'q"
            description="Kategoriyalar mahsulotlarni mijoz uchun guruhlaydi."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
                leftIcon={<Plus size={14} aria-hidden />}
              >
                Birinchi kategoriya
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Card padding="sm" className="flex items-center gap-3">
                {/* Tartib: drag emas — aniq yuqoriga/pastga tugmalar. */}
                <span className="flex flex-col">
                  <button
                    type="button"
                    aria-label={`${c.name} — yuqoriga ko'tarish`}
                    disabled={i === 0 || reordering}
                    onClick={() => void move(i, -1)}
                    className="flex h-5 w-6 items-center justify-center rounded-ds-xs text-subtle transition-colors duration-fast hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronUp size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`${c.name} — pastga tushirish`}
                    disabled={i === categories.length - 1 || reordering}
                    onClick={() => void move(i, 1)}
                    className="flex h-5 w-6 items-center justify-center rounded-ds-xs text-subtle transition-colors duration-fast hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronDown size={14} aria-hidden />
                  </button>
                </span>
                <span
                  aria-hidden
                  style={hueTint(HUES[i % HUES.length])}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm text-lg"
                >
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-ink">{c.name}</p>
                  <p className="mt-0.5 text-caption text-muted">
                    <span className="font-mono tabular-nums">{productCount[c.id] ?? 0}</span> ta
                    mahsulot · {c.isActive ? 'Faol' : "O'chirilgan"}
                  </p>
                </div>

                {/* Switch, not a styled div: role + aria-checked make the state
                    readable, and the label says which category it belongs to. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={c.isActive}
                  aria-label={`${c.name} — faol holati`}
                  onClick={() => void toggle(c)}
                  className={clsx(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-fast',
                    c.isActive ? 'bg-primary' : 'border border-line bg-surface-3'
                  )}
                >
                  <span
                    aria-hidden
                    className={clsx(
                      'absolute top-1 h-4 w-4 rounded-full bg-white shadow-card transition-all duration-fast',
                      c.isActive ? 'left-6' : 'left-1'
                    )}
                  />
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${c.name} kategoriyasini tahrirlash`}
                  onClick={() => {
                    setEditing(c);
                    setModalOpen(true);
                  }}
                  className="shrink-0"
                >
                  <Pencil size={14} aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${c.name} kategoriyasini o'chirish`}
                  onClick={() => setPendingDelete(c)}
                  className="shrink-0 hover:text-danger"
                >
                  <Trash2 size={15} aria-hidden />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CategoryModal
        isOpen={modalOpen}
        category={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={save}
      />

      <Modal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Kategoriyani o'chirish"
        subtitle={pendingDelete?.name}
        tone="danger"
        size="sm"
      >
        <p className="text-body text-muted">
          Bu amalni bekor qilib bo&apos;lmaydi.{' '}
          {pendingDelete && (productCount[pendingDelete.id] ?? 0) > 0
            ? `Ichidagi ${productCount[pendingDelete.id]} ta mahsulot kategoriyasiz qoladi.`
            : 'Bu kategoriyada mahsulot yo‘q.'}
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setPendingDelete(null)}>
            Bekor qilish
          </Button>
          <Button variant="danger" onClick={() => void confirmRemove()}>
            O&apos;chirish
          </Button>
        </div>
      </Modal>
    </div>
  );
}
