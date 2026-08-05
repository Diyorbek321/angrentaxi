'use client';

import { useState } from 'react';
import { Plus, RefreshCw, Tags, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, MarketCategory } from '@/lib/api';
import { errorMessage, hueTint } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCards } from '@/components/ui/Skeleton';

const HUES = [45, 200, 25, 280, 150, 320];

export default function CategoriesPage() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🛒');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MarketCategory | null>(null);

  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<MarketCategory[]>(
    async () => {
      const res = await marketApi.getCategories();
      return res.data.data;
    }
  );

  const categories = data ?? [];

  const toggle = async (c: MarketCategory) => {
    try {
      await marketApi.updateCategory(c.id, { isActive: !c.isActive });
      await reload();
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
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

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await marketApi.createCategory({
        name: name.trim(),
        emoji: emoji || '🛒',
        sortOrder: categories.length,
      });
      setName('');
      setEmoji('🛒');
      setShowAdd(false);
      await reload();
      toast({ title: "Kategoriya qo'shildi", variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Kategoriyalar"
        description="Mahsulot guruhlari va ularning tartibi"
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
            <Button size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus size={14} aria-hidden />}>
              Kategoriya
            </Button>
          </>
        }
      />

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
              <Button size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus size={14} aria-hidden />}>
                Birinchi kategoriya
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Card padding="sm" className="flex items-center gap-3.5">
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
                    {c.isActive ? 'Faol' : "O'chirilgan"}
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
                    c.isActive ? 'bg-primary' : 'bg-surface-3 border border-line'
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

      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Yangi kategoriya"
        size="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div className="flex gap-3">
            <div className="w-20">
              <Input
                label="Belgi"
                value={emoji}
                maxLength={2}
                onChange={(e) => setEmoji(e.target.value)}
                className="text-center text-lg"
              />
            </div>
            <div className="flex-1">
              <Input
                label="Kategoriya nomi"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Ichimliklar"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={!name.trim()} isLoading={saving}>
              Saqlash
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Kategoriyani o'chirish"
        subtitle={pendingDelete?.name}
        tone="danger"
        size="sm"
      >
        <p className="text-body text-muted">
          Bu amalni bekor qilib bo&apos;lmaydi. Kategoriyadagi mahsulotlar kategoriyasiz qoladi.
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
