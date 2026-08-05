'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { foodApi, Dish, MenuCategory } from '@/lib/api';
import { useAsyncData, errorMessage } from '@/hooks/useAsyncData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface CategoriesData {
  categories: MenuCategory[];
  dishes: Dish[];
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<MenuCategory | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [removing, setRemoving] = useState<MenuCategory | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<CategoriesData> => {
    const [c, d] = await Promise.all([foodApi.getCategories(), foodApi.getDishes()]);
    return { categories: c.data.data, dishes: d.data.data };
  }, []);

  const { data, status, error, reload } = useAsyncData<CategoriesData>(load);

  const categories = useMemo(
    () => [...(data?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [data]
  );
  const dishes = data?.dishes ?? [];
  const dishCount = (id: string) => dishes.filter((d) => d.categoryId === id).length;

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await foodApi.createCategory({ name, sortOrder: categories.length });
      setNewName('');
      toast({ title: `«${name}» qo‘shildi`, variant: 'success' });
      await reload();
    } catch (err) {
      toast({ title: 'Qo‘shib bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const commitRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    setBusyId(renaming.id);
    try {
      await foodApi.updateCategory(renaming.id, { name: renameValue.trim() });
      toast({ title: 'Nomi yangilandi', variant: 'success' });
      setRenaming(null);
      await reload();
    } catch (err) {
      toast({ title: 'Saqlab bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  /** Tartibni klaviatura bilan ham o'zgartirish mumkin — sudrash shart emas. */
  const move = async (category: MenuCategory, direction: -1 | 1) => {
    const index = categories.findIndex((c) => c.id === category.id);
    const neighbour = categories[index + direction];
    if (!neighbour) return;
    setBusyId(category.id);
    try {
      await Promise.all([
        foodApi.updateCategory(category.id, { sortOrder: neighbour.sortOrder }),
        foodApi.updateCategory(neighbour.id, { sortOrder: category.sortOrder }),
      ]);
      await reload();
    } catch (err) {
      toast({ title: 'Tartibni o‘zgartirib bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await foodApi.deleteCategory(removing.id);
      toast({ title: `«${removing.name}» o‘chirildi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'O‘chirib bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setRemoving(null);
      await reload();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Kategoriyalar"
        description="Menyu bo'limlari va ularning tartibi"
        icon={<Tags size={20} />}
      />

      <form
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <div className="flex-1">
          <Input
            label="Yangi kategoriya"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Masalan: Salatlar"
          />
        </div>
        <Button type="submit" leftIcon={<Plus size={16} />} isLoading={creating} disabled={!newName.trim()}>
          Qo&apos;shish
        </Button>
      </form>

      {status === 'loading' && <SkeletonCards count={4} height="h-[68px]" />}

      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && categories.length === 0 && (
        <EmptyState
          icon={<Tags size={24} />}
          title="Kategoriya yo'q"
          description="Kategoriyalar menyuni mijoz uchun o'qishli qiladi. Birinchisini yuqorida qo'shing."
        />
      )}

      {status === 'ready' && categories.length > 0 && (
        <ol className="flex flex-col gap-2">
          {categories.map((category, index) => (
            <li key={category.id}>
              <Card padding="none" className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-caption text-subtle w-6 tabular-nums" aria-hidden>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-title text-ink truncate">{category.name}</p>
                  <p className="text-caption text-muted">{dishCount(category.id)} ta taom</p>
                </div>

                {dishCount(category.id) === 0 && (
                  <Badge variant="warning" size="sm">
                    Bo&apos;sh
                  </Badge>
                )}

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === 0 || busyId === category.id}
                    onClick={() => move(category, -1)}
                    aria-label={`${category.name} — yuqoriga ko'chirish`}
                  >
                    <ArrowUp size={16} aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === categories.length - 1 || busyId === category.id}
                    onClick={() => move(category, 1)}
                    aria-label={`${category.name} — pastga ko'chirish`}
                  >
                    <ArrowDown size={16} aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenaming(category);
                      setRenameValue(category.name);
                    }}
                    aria-label={`${category.name} — nomini o'zgartirish`}
                  >
                    <Pencil size={16} aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemoving(category)}
                    aria-label={`${category.name} — o'chirish`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <Modal
        isOpen={renaming != null}
        onClose={() => setRenaming(null)}
        size="sm"
        title="Kategoriya nomi"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setRenaming(null)}>
              Bekor qilish
            </Button>
            <Button
              size="lg"
              className="flex-1"
              isLoading={busyId === renaming?.id}
              disabled={!renameValue.trim()}
              onClick={commitRename}
            >
              Saqlash
            </Button>
          </div>
        }
      >
        <Input
          label="Nomi"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
          autoFocus
        />
      </Modal>

      <Modal
        isOpen={removing != null}
        onClose={() => setRemoving(null)}
        tone="danger"
        size="sm"
        title="Kategoriyani o'chirish"
        subtitle={removing ? `«${removing.name}» o'chiriladi.` : undefined}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setRemoving(null)}>
              Bekor qilish
            </Button>
            <Button variant="danger" size="lg" className="flex-1" onClick={confirmRemove}>
              O&apos;chirish
            </Button>
          </div>
        }
      >
        <p className="text-body text-muted">
          {removing && dishCount(removing.id) > 0
            ? `Bu bo'limda ${dishCount(removing.id)} ta taom bor — ular kategoriyasiz qoladi va menyuda pastda ko'rinadi.`
            : "Bo'sh kategoriya o'chiriladi, taomlarga ta'sir qilmaydi."}
        </p>
      </Modal>
    </div>
  );
}
