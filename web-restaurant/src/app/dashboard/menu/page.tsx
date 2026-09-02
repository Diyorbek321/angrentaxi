'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Clock, Pencil, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { clsx } from 'clsx';
import { foodApi, Dish, MenuCategory } from '@/lib/api';
import { useAsyncData, errorMessage } from '@/hooks/useAsyncData';
import { money } from '@/lib/utils';
import { DishImage } from '@/components/DishImage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';

interface MenuData {
  dishes: Dish[];
  categories: MenuCategory[];
}

/** Katalog HOLAT bo'yicha birinchi bo'linadi (Ozon naqshi): sotuvda / tugagan. */
type AvailFilter = 'all' | 'on' | 'off';

export default function MenuPage() {
  const { toast } = useToast();
  const [catFilter, setCatFilter] = useState<string>('all');
  const [availFilter, setAvailFilter] = useState<AvailFilter>('all');
  const [editing, setEditing] = useState<Dish | 'new' | null>(null);
  const [removing, setRemoving] = useState<Dish | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<MenuData> => {
    const [d, c] = await Promise.all([foodApi.getDishes(), foodApi.getCategories()]);
    return { dishes: d.data.data, categories: c.data.data };
  }, []);

  const { data, status, error, reload, setData } = useAsyncData<MenuData>(load);

  const dishes = useMemo(() => data?.dishes ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'Barchasi', count: dishes.length },
      ...categories.map((c) => ({
        value: c.id,
        label: c.name,
        count: dishes.filter((d) => d.categoryId === c.id).length,
      })),
    ],
    [categories, dishes]
  );

  const availTabs = useMemo(
    () =>
      [
        { value: 'all', label: 'Barchasi', count: dishes.length },
        { value: 'on', label: 'Sotuvda', count: dishes.filter((d) => d.isAvailable).length },
        { value: 'off', label: 'Tugagan', count: dishes.filter((d) => !d.isAvailable).length },
      ] as const,
    [dishes]
  );

  const filtered = dishes.filter(
    (d) =>
      (catFilter === 'all' || d.categoryId === catFilter) &&
      (availFilter === 'all' || (availFilter === 'on' ? d.isAvailable : !d.isAvailable))
  );
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Kategoriyasiz';

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
        title: updated.isAvailable ? `${updated.name} — mavjud` : `${updated.name} — tugagan`,
        variant: 'success',
      });
    } catch (err) {
      toast({ title: 'Holatni o‘zgartirib bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await foodApi.deleteDish(removing.id);
      toast({ title: `${removing.name} o‘chirildi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'O‘chirib bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setRemoving(null);
      await reload();
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Menyu"
        description="Taomlar, narxlar va mavjudlik"
        icon={<UtensilsCrossed size={20} />}
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setEditing('new')}>
            Yangi taom
          </Button>
        }
      />

      {status === 'loading' && <SkeletonCards count={6} height="h-64" columns />}

      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && (
        <div className="flex flex-col gap-5">
          {/* Holat birinchi, kategoriya keyin — tugagan taomlar bir qarashda. */}
          {dishes.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <Tabs
                items={availTabs}
                value={availFilter}
                onChange={(v) => setAvailFilter(v)}
                label="Mavjudlik bo'yicha filtr"
                size="sm"
              />
              {categories.length > 0 && (
                <Tabs items={tabs} value={catFilter} onChange={setCatFilter} label="Menyu kategoriyalari" />
              )}
            </div>
          )}

          {dishes.length === 0 ? (
            <EmptyState
              icon={<UtensilsCrossed size={24} />}
              title="Menyu hali bo'sh"
              description="Birinchi taomni qo'shing — u mijozlarga darhol ko'rinadi."
              action={
                <Button leftIcon={<Plus size={16} />} onClick={() => setEditing('new')}>
                  Yangi taom qo&apos;shish
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              compact
              icon={<UtensilsCrossed size={20} />}
              title="Filtrga mos taom yo'q"
              description="Tanlangan holat va kategoriya kombinatsiyasida hech narsa topilmadi."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCatFilter('all');
                    setAvailFilter('all');
                  }}
                >
                  Filtrlarni tozalash
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((dish) => (
                <li
                  key={dish.id}
                  className={clsx(
                    'flex flex-col overflow-hidden rounded-ds-md border bg-surface shadow-card transition-colors duration-fast',
                    dish.isAvailable ? 'border-line' : 'border-dashed border-line-strong'
                  )}
                >
                  <div className="relative">
                    <DishImage src={dish.imageUrl} name={dish.name} className="h-36 w-full" />
                    <span className="absolute left-2.5 top-2.5">
                      <Badge variant="default" size="sm">
                        {categoryName(dish.categoryId)}
                      </Badge>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-title text-ink">{dish.name}</h2>
                      <InlinePrice dish={dish} onSaved={applyDishUpdate} />
                    </div>

                    <p className="min-h-[36px] text-caption text-muted line-clamp-2">
                      {dish.description || 'Tavsif kiritilmagan'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Mavjudlik: rang + nuqta + yozuv. */}
                      <Badge variant={dish.isAvailable ? 'success' : 'danger'} size="sm" dot>
                        {dish.isAvailable ? 'Mavjud' : 'Tugagan'}
                      </Badge>
                      <Badge variant="default" size="sm" icon={<Clock size={12} />}>
                        {dish.prepMinutes} daq
                      </Badge>
                      {dish.tags.map((t) => (
                        <Badge key={t} variant="mint" size="sm">
                          {t}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-auto flex items-center gap-2 border-t border-divider pt-3">
                      <Button
                        size="sm"
                        variant={dish.isAvailable ? 'secondary' : 'primary'}
                        isLoading={busyId === dish.id}
                        onClick={() => toggleAvailability(dish)}
                        aria-label={
                          dish.isAvailable
                            ? `${dish.name} — tugagan deb belgilash`
                            : `${dish.name} — mavjud deb belgilash`
                        }
                      >
                        {dish.isAvailable ? 'Tugadi' : 'Mavjud'}
                      </Button>
                      <span className="flex-1" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(dish)}
                        aria-label={`${dish.name} — tahrirlash`}
                        leftIcon={<Pencil size={14} />}
                      >
                        Tahrir
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setRemoving(dish)}
                        aria-label={`${dish.name} — o'chirish`}
                      >
                        <Trash2 size={14} aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

      <Modal
        isOpen={removing != null}
        onClose={() => setRemoving(null)}
        tone="danger"
        title="Taomni o'chirish"
        subtitle={removing ? `${removing.name} menyudan butunlay olib tashlanadi.` : undefined}
        size="sm"
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
          Taomni vaqtincha yashirish uchun uni o&apos;chirish shart emas — &laquo;Tugadi&raquo; deb
          belgilash yetarli.
        </p>
      </Modal>
    </div>
  );
}

/**
 * Bir maydonlik tuzatish uchun to'liq forma ochilmaydi — narx joyida
 * tahrirlanadi (data-tables: inline edit + KO'RINADIGAN affordance).
 * Backend PATCH qisman yangilashni qo'llaydi, faqat `price` yuboriladi.
 */
function InlinePrice({ dish, onSaved }: { dish: Dish; onSaved: (updated: Dish) => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => {
    setValue(String(dish.price));
    setEditing(true);
  };

  const commit = async () => {
    const price = Number(value);
    if (!value.trim() || !Number.isFinite(price) || price <= 0) {
      toast({ title: "Narx 0 dan katta bo'lishi kerak", variant: 'error' });
      return;
    }
    if (price === dish.price) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await foodApi.updateDish(dish.id, { price });
      onSaved(res.data.data);
      toast({ title: `${dish.name} — narx yangilandi`, variant: 'success' });
      setEditing(false);
    } catch (err) {
      toast({ title: 'Narxni saqlab bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
        <span className="font-mono text-title text-ink tabular-nums">{money(dish.price)}</span>
        <button
          type="button"
          onClick={start}
          aria-label={`${dish.name} — narxini o'zgartirish`}
          title="Narxni o'zgartirish"
          className="h-7 w-7 inline-flex items-center justify-center rounded-ds-xs text-subtle hover:bg-surface-2 hover:text-primary-text transition-colors duration-fast"
        >
          <Pencil size={13} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        step={500}
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label={`${dish.name} — yangi narx (so'm)`}
        className="w-24 rounded-ds-xs border border-primary bg-surface px-2 py-1 font-mono text-body text-ink tabular-nums"
      />
      <button
        type="button"
        onClick={commit}
        disabled={saving}
        aria-label="Narxni saqlash"
        className="h-7 w-7 inline-flex items-center justify-center rounded-ds-xs bg-primary text-white hover:bg-primary-hover disabled:opacity-60 transition-colors duration-fast dark:bg-primary-on-dark"
      >
        <Check size={14} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        aria-label="Tahrirni bekor qilish"
        className="h-7 w-7 inline-flex items-center justify-center rounded-ds-xs border border-line text-muted hover:bg-surface-2 hover:text-ink transition-colors duration-fast"
      >
        <X size={14} aria-hidden />
      </button>
    </span>
  );
}

function DishModal({
  dish,
  categories,
  onClose,
  onSaved,
}: {
  dish: Dish | null;
  categories: MenuCategory[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(dish?.name ?? '');
  const [description, setDescription] = useState(dish?.description ?? '');
  const [price, setPrice] = useState(dish ? String(dish.price) : '');
  const [prep, setPrep] = useState(dish ? String(dish.prepMinutes) : '12');
  const [categoryId, setCategoryId] = useState(dish?.categoryId ?? categories[0]?.id ?? '');
  const [tags, setTags] = useState(dish?.tags.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; price?: string; prep?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Nomi majburiy';
    if (!price.trim() || Number(price) <= 0) next.price = "Narx 0 dan katta bo'lishi kerak";
    if (Number(prep) <= 0) next.prep = "Tayyorlash vaqti 0 dan katta bo'lishi kerak";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    // ⚠️ Faqat backend kutayotgan maydonlar yuboriladi — `forbidNonWhitelisted`.
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number(price),
      prepMinutes: Number(prep) || 10,
      categoryId: categoryId || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (dish) await foodApi.updateDish(dish.id, payload);
      else await foodApi.createDish(payload);
      toast({ title: dish ? 'Taom yangilandi' : "Taom qo'shildi", variant: 'success' });
      await onSaved();
    } catch (err) {
      toast({ title: 'Saqlab bo‘lmadi', description: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={dish ? 'Taomni tahrirlash' : "Yangi taom qo'shish"}
      subtitle={dish ? dish.name : 'Menyuga yangi pozitsiya'}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button size="lg" className="flex-1" isLoading={saving} onClick={save}>
            Saqlash
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Nomi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masalan: Klassik burger"
          error={errors.name}
          autoFocus
        />
        <Textarea
          label="Tavsif"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Qisqacha tarkib va o'ziga xosligi"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Narxi (so'm)"
            type="number"
            min={0}
            mono
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="32000"
            error={errors.price}
          />
          <Input
            label="Tayyorlash (daqiqa)"
            type="number"
            min={1}
            mono
            value={prep}
            onChange={(e) => setPrep(e.target.value)}
            placeholder="12"
            error={errors.prep}
          />
        </div>
        <Select
          label="Kategoriya"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          placeholder={categories.length === 0 ? 'Avval kategoriya yarating' : undefined}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Input
          label="Teglar"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Achchiq, Vegetarian"
          hint="Vergul bilan ajrating"
        />
      </div>
    </Modal>
  );
}
