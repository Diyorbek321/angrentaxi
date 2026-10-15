'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { foodApi, Dish, MenuCategory } from '@/lib/api';
import { useAsyncData, errorMessage } from '@/hooks/useAsyncData';
import { formatNumber } from '@/lib/format';
import { usePageRefresh } from '@/components/shell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonTable } from '@/components/ui/Skeleton';
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
  const [removePending, setRemovePending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<CategoriesData> => {
    const [c, d] = await Promise.all([foodApi.getCategories(), foodApi.getDishes()]);
    return { categories: c.data.data, dishes: d.data.data };
  }, []);

  const { data, status, error, reload, isRefreshing, lastUpdatedAt } = useAsyncData<CategoriesData>(load);
  usePageRefresh(reload);

  const categories = useMemo(
    () => [...(data?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [data]
  );
  const dishCounts = useMemo(() => {
    const map = new Map<string, number>();
    (data?.dishes ?? []).forEach((d) => d.categoryId && map.set(d.categoryId, (map.get(d.categoryId) ?? 0) + 1));
    return map;
  }, [data]);
  const dishCount = (id: string) => dishCounts.get(id) ?? 0;

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
    setRemovePending(true);
    try {
      await foodApi.deleteCategory(removing.id);
      toast({ title: `«${removing.name}» o‘chirildi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'O‘chirib bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setRemovePending(false);
      setRemoving(null);
      await reload();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Kategoriyalar"
        description="Menyu boʻlimlari — mijoz ilovasida shu tartibda koʻrinadi"
      />

      <Card padding="none">
        <form
          className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Input
            label="Yangi kategoriya"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Masalan: Salatlar"
            wrapperClassName="flex-1"
          />
          <Button type="submit" leftIcon={<Plus size={15} />} isLoading={creating} disabled={!newName.trim()}>
            Qo&apos;shish
          </Button>
        </form>

        {status === 'loading' && <SkeletonTable rows={4} cols={3} className="rounded-none border-0" />}

        {status === 'error' && <ErrorState message={error} onRetry={reload} compact className="py-8" />}

        {status === 'ready' && error && (
          <div className="p-4 pb-0">
            <RetryBanner message={error} onRetry={reload} isRetrying={isRefreshing} keepsLastData lastUpdatedAt={lastUpdatedAt} />
          </div>
        )}

        {status === 'ready' && categories.length === 0 && (
          <EmptyState
            variant="first-use"
            icon={<Tags size={20} />}
            title="Kategoriya yoʻq"
            description="Kategoriyalar menyuni mijoz uchun oʻqishli qiladi. Birinchisini yuqorida qoʻshing."
          />
        )}

        {status === 'ready' && categories.length > 0 && (
          <>
            <CardHeader
              title="Tartib"
              description={`${formatNumber(categories.length)} ta boʻlim`}
              divider
              className="pt-3"
            />
            <ol className="divide-y divide-line">
              {categories.map((category, index) => {
                const count = dishCount(category.id);
                const busy = busyId === category.id;
                return (
                  <li key={category.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50">
                    <span className="num w-6 text-[13px] text-subtle" aria-hidden>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-ink">{category.name}</p>
                      <p className="text-xs text-muted">{formatNumber(count)} ta taom</p>
                    </div>
                    {count === 0 && (
                      <Badge variant="neutral" size="sm">
                        Boʻsh
                      </Badge>
                    )}
                    <div className="flex items-center gap-0.5">
                      <IconButton
                        disabled={index === 0 || busy}
                        onClick={() => move(category, -1)}
                        aria-label={`${category.name} — yuqoriga ko'chirish`}
                      >
                        <ArrowUp aria-hidden />
                      </IconButton>
                      <IconButton
                        disabled={index === categories.length - 1 || busy}
                        onClick={() => move(category, 1)}
                        aria-label={`${category.name} — pastga ko'chirish`}
                      >
                        <ArrowDown aria-hidden />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          setRenaming(category);
                          setRenameValue(category.name);
                        }}
                        aria-label={`${category.name} — nomini o'zgartirish`}
                      >
                        <Pencil aria-hidden />
                      </IconButton>
                      <IconButton
                        variant="danger-ghost"
                        onClick={() => setRemoving(category)}
                        aria-label={`${category.name} — o'chirish`}
                      >
                        <Trash2 aria-hidden />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </Card>

      <Modal
        isOpen={renaming != null}
        onClose={() => setRenaming(null)}
        size="sm"
        title="Kategoriya nomi"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              Bekor qilish
            </Button>
            <Button isLoading={busyId === renaming?.id} disabled={!renameValue.trim()} onClick={commitRename}>
              Saqlash
            </Button>
          </>
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

      <ConfirmDialog
        isOpen={removing != null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        isPending={removePending}
        title="Kategoriyani oʻchirish"
        description={
          removing && dishCount(removing.id) > 0
            ? `«${removing.name}» oʻchiriladi. Undagi ${dishCount(removing.id)} ta taom kategoriyasiz qoladi va menyuda pastda koʻrinadi.`
            : removing
              ? `«${removing.name}» oʻchiriladi. Boʻsh kategoriya — taomlarga taʼsir qilmaydi.`
              : undefined
        }
        confirmLabel="O'chirish"
      />
    </div>
  );
}
