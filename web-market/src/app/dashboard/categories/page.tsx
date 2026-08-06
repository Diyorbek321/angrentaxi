'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { marketApi, type MarketCategory, type Product } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';

export default function CategoriesPage() {
  const { toast } = useToast();

  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketCategory | null>(null);
  const [deleting, setDeleting] = useState<MarketCategory | null>(null);

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        marketApi.getCategories(),
        marketApi.getProducts(),
      ]);
      setCategories(categoriesRes.data.data);
      setProducts(productsRes.data.data);
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

  const productCount = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    });
    return counts;
  }, [products]);

  const toggleActive = async (category: MarketCategory, next: boolean) => {
    try {
      const res = await marketApi.updateCategory(category.id, { isActive: next });
      setCategories((prev) => prev.map((c) => (c.id === category.id ? res.data.data : c)));
    } catch {
      toast({ title: 'Holatni o‘zgartirib bo‘lmadi', variant: 'error' });
    }
  };

  /**
   * Up/down instead of drag-and-drop, which the task spec explicitly allows.
   * Seeded categories can share a sortOrder (all zero), so swapping the two
   * values alone would not always change the order — every position is
   * rewritten to its index and only the rows that actually moved are sent.
   */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;

    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCategories(reordered);
    setBusy(true);

    try {
      await Promise.all(
        reordered
          .map((category, i) => ({ category, i }))
          .filter(({ category, i }) => category.sortOrder !== i)
          .map(({ category, i }) => marketApi.updateCategory(category.id, { sortOrder: i }))
      );
      await load();
    } catch {
      toast({ title: 'Tartibni saqlab bo‘lmadi', variant: 'error' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await marketApi.deleteCategory(deleting.id);
      setDeleting(null);
      await load();
      toast({ title: "Kategoriya o'chirildi", variant: 'success' });
    } catch {
      toast({
        title: 'O‘chirib bo‘lmadi',
        description: 'Kategoriyada mahsulot bo‘lsa, avval ularni ko‘chiring.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return <SkeletonCards count={5} height="h-[72px]" />;
  if (status === 'error') return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="max-w-3xl space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Tartibni o&apos;zgartirish uchun strelkalardan foydalaning.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          leftIcon={<Plus size={15} />}
        >
          Kategoriya qo&apos;shish
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Tags size={24} />}
          title="Hali kategoriya yo'q"
          description="Mahsulotlarni guruhlash uchun birinchi kategoriyani qo'shing."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              leftIcon={<Plus size={15} />}
            >
              Kategoriya qo&apos;shish
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {categories.map((category, index) => {
            const count = productCount.get(category.id) ?? 0;

            return (
              <li
                key={category.id}
                className={cn(
                  'surface-card flex items-center gap-3.5 px-4 py-3',
                  !category.isActive && 'opacity-70'
                )}
              >
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || busy}
                    aria-label={`${category.name} — yuqoriga`}
                    className="h-5 w-5 rounded inline-flex items-center justify-center text-subtle hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === categories.length - 1 || busy}
                    aria-label={`${category.name} — pastga`}
                    className="h-5 w-5 rounded inline-flex items-center justify-center text-subtle hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>

                <span
                  className="h-10 w-10 shrink-0 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-xl"
                  aria-hidden
                >
                  {category.emoji}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">{category.name}</p>
                  <p className="text-2xs text-subtle mt-0.5">
                    <span className="font-mono tabular-nums">{count}</span> ta mahsulot
                  </p>
                </div>

                <Switch
                  size="sm"
                  checked={category.isActive}
                  onChange={(next) => toggleActive(category, next)}
                  label={`${category.name} — faollik`}
                >
                  <span className="text-xs text-muted w-20">
                    {category.isActive ? 'Faol' : 'Yashirilgan'}
                  </span>
                </Switch>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(category);
                      setFormOpen(true);
                    }}
                    aria-label={`${category.name} — tahrirlash`}
                    className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-subtle hover:text-ink hover:bg-surface-2 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(category)}
                    aria-label={`${category.name} — o'chirish`}
                    className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-subtle hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {formOpen && (
        <CategoryFormModal
          category={editing}
          nextSortOrder={categories.length}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await load();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        isLoading={busy}
        title="Kategoriyani o'chirish"
        message={`«${deleting?.name ?? ''}» o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
        confirmLabel="O'chirish"
      />
    </div>
  );
}
