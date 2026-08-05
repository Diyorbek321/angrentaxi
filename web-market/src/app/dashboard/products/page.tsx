'use client';

import { useMemo, useState } from 'react';
import { Package, Plus, RefreshCw, Search } from 'lucide-react';
import { clsx } from 'clsx';
import {
  marketApi,
  MarketCategory,
  Product,
  ProductStatus,
  ProductUnit,
} from '@/lib/api';
import { errorMessage, hueTint } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import { ProductStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';

interface CatalogData {
  products: Product[];
  categories: MarketCategory[];
}

const ROW_GRID =
  'grid grid-cols-[36px_minmax(0,2.2fr)_1fr_130px_150px_130px] gap-3 items-center';

/** Stock colouring, with the word repeated in `title` so hue is never alone. */
function stockTone(stock: number, threshold: number) {
  if (stock === 0) return { text: 'text-danger-deep dark:text-danger-light', label: 'Tugagan' };
  if (stock <= threshold)
    return { text: 'text-override-dark dark:text-override-light', label: 'Kam qolgan' };
  return { text: 'text-ink', label: 'Yetarli' };
}

export default function ProductsPage() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<CatalogData>(async () => {
    const [p, c] = await Promise.all([marketApi.getProducts(), marketApi.getCategories()]);
    return { products: p.data.data, categories: c.data.data };
  });

  const products = useMemo(() => data?.products ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
    );
  }, [products, query]);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const selectedCount = selectedIds.length;

  const patchProduct = async (id: string, patch: Parameters<typeof marketApi.updateProduct>[1]) => {
    try {
      await marketApi.updateProduct(id, patch);
      await reload();
      toast({ title: 'Saqlandi', variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
      await reload();
    }
  };

  const bulkSetStatus = async (status: ProductStatus) => {
    setBusy(true);
    try {
      await marketApi.bulkUpdateProducts(selectedIds, status);
      setSelected({});
      await reload();
      toast({ title: `${selectedIds.length} ta mahsulot yangilandi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // No dedicated bulk-price backend endpoint — this applies the same
  // per-product update the inline price field already uses, just looped over
  // the selection (exact value, or a % adjustment floored at 0).
  const bulkChangePrice = async (mode: 'set' | 'pct', value: number) => {
    await Promise.all(
      selectedIds.map((id) => {
        const product = products.find((p) => p.id === id);
        if (!product) return Promise.resolve();
        const newPrice =
          mode === 'set'
            ? Math.max(0, value)
            : Math.max(0, Math.round(product.price * (1 + value / 100)));
        return marketApi.updateProduct(id, { price: newPrice });
      })
    );
    setBulkPriceOpen(false);
    setSelected({});
    await reload();
    toast({ title: 'Narxlar yangilandi', variant: 'success' });
  };

  return (
    <div>
      <PageHeader
        title="Mahsulotlar"
        description="Katalog, narx va zaxirani boshqaring"
        icon={<Package size={18} aria-hidden />}
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
              Mahsulot qo&apos;shish
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input
            aria-label="Mahsulot qidirish"
            placeholder="Nomi yoki SKU bo'yicha qidirish"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftElement={<Search size={15} aria-hidden />}
          />
        </div>
        {selectedCount > 0 && (
          <div
            role="group"
            aria-label="Tanlanganlar uchun amallar"
            className="flex flex-wrap items-center gap-2 rounded-ds-sm border border-line bg-surface-2/60 px-3 py-1.5"
          >
            <span className="text-caption font-bold text-primary-text">
              {selectedCount} tanlandi
            </span>
            <Button size="sm" variant="secondary" isLoading={busy} onClick={() => void bulkSetStatus('active')}>
              Faollashtirish
            </Button>
            <Button size="sm" variant="secondary" isLoading={busy} onClick={() => void bulkSetStatus('hidden')}>
              Yashirish
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulkPriceOpen(true)}>
              Narxni o&apos;zgartirish
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : error && products.length === 0 ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={24} aria-hidden />}
            title={query ? 'Hech narsa topilmadi' : 'Katalog hali bo’sh'}
            description={
              query
                ? "Qidiruv so'zini o'zgartirib ko'ring."
                : "Birinchi mahsulotni qo'shsangiz, u shu yerda ko'rinadi."
            }
            action={
              query ? (
                <Button size="sm" variant="secondary" onClick={() => setQuery('')}>
                  Qidiruvni tozalash
                </Button>
              ) : (
                <Button size="sm" onClick={() => setShowAdd(true)} leftIcon={<Plus size={14} aria-hidden />}>
                  Mahsulot qo&apos;shish
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop: editable table. */}
          <Card padding="none" className="hidden overflow-hidden lg:block">
            <div
              className={clsx(
                ROW_GRID,
                'border-b border-line bg-surface-2/60 px-4 py-2.5 text-micro uppercase text-muted'
              )}
            >
              <span aria-hidden />
              <span>Mahsulot</span>
              <span>Kategoriya</span>
              <span>Narx (so&apos;m)</span>
              <span>Zaxira</span>
              <span>Holat</span>
            </div>
            <ul className="divide-y divide-divider">
              {filtered.map((p) => {
                const tone = stockTone(p.stock, 10);
                return (
                  <li key={p.id} className={clsx(ROW_GRID, 'px-4 py-2.5')}>
                    <input
                      type="checkbox"
                      checked={!!selected[p.id]}
                      onChange={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
                      aria-label={`${p.name} tanlash`}
                      className="h-4 w-4 accent-brand"
                    />
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        style={hueTint(p.hue)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm text-lg"
                      >
                        {p.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-body font-semibold text-ink">
                          {p.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-caption text-subtle">
                          {p.sku || '—'}
                        </span>
                      </span>
                    </div>
                    <span className="truncate text-caption text-muted">
                      {categoryName(p.categoryId)}
                    </span>
                    <Input
                      type="number"
                      mono
                      defaultValue={p.price}
                      aria-label={`${p.name} narxi`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v !== p.price) void patchProduct(p.id, { price: v });
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        mono
                        defaultValue={p.stock}
                        title={tone.label}
                        aria-label={`${p.name} zaxirasi — ${tone.label}`}
                        className={clsx('font-bold', tone.text)}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v) && v !== p.stock)
                            void patchProduct(p.id, { stock: Math.max(0, v) });
                        }}
                      />
                      <span className="shrink-0 text-caption text-muted">{p.unit}</span>
                    </div>
                    <span>
                      <ProductStatusBadge status={p.status} size="sm" />
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Mobile: one card per product, same editable fields stacked. */}
          <ul className="space-y-2.5 lg:hidden">
            {filtered.map((p) => {
              const tone = stockTone(p.stock, 10);
              return (
                <li key={p.id}>
                  <Card padding="sm">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!!selected[p.id]}
                        onChange={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
                        aria-label={`${p.name} tanlash`}
                        className="mt-1 h-4 w-4 shrink-0 accent-brand"
                      />
                      <span
                        aria-hidden
                        style={hueTint(p.hue)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm text-lg"
                      >
                        {p.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-semibold text-ink">{p.name}</p>
                        <p className="mt-0.5 truncate font-mono text-caption text-subtle">
                          {p.sku || '—'} · {categoryName(p.categoryId)}
                        </p>
                      </div>
                      <ProductStatusBadge status={p.status} size="sm" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Input
                        label="Narx (so'm)"
                        type="number"
                        mono
                        defaultValue={p.price}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v) && v !== p.price)
                            void patchProduct(p.id, { price: v });
                        }}
                      />
                      <Input
                        label={`Zaxira (${p.unit})`}
                        type="number"
                        mono
                        defaultValue={p.stock}
                        hint={tone.label}
                        className={clsx('font-bold', tone.text)}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v) && v !== p.stock)
                            void patchProduct(p.id, { stock: Math.max(0, v) });
                        }}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <AddProductModal
        isOpen={showAdd}
        categories={categories}
        onClose={() => setShowAdd(false)}
        onCreated={async () => {
          setShowAdd(false);
          await reload();
          toast({ title: "Mahsulot qo'shildi", variant: 'success' });
        }}
        onError={(msg) => toast({ title: 'Xatolik', description: msg, variant: 'error' })}
      />

      <BulkPriceModal
        isOpen={bulkPriceOpen}
        count={selectedCount}
        onClose={() => setBulkPriceOpen(false)}
        onApply={bulkChangePrice}
        onError={(msg) => toast({ title: 'Xatolik', description: msg, variant: 'error' })}
      />
    </div>
  );
}

function BulkPriceModal({
  isOpen,
  count,
  onClose,
  onApply,
  onError,
}: {
  isOpen: boolean;
  count: number;
  onClose: () => void;
  onApply: (mode: 'set' | 'pct', value: number) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<'set' | 'pct'>('set');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    setSaving(true);
    try {
      await onApply(mode, num);
      setValue('');
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Narxni ommaviy o'zgartirish"
      subtitle={`${count} ta mahsulotga qo'llaniladi`}
      size="sm"
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="O'zgartirish usuli" className="flex gap-2">
          {(
            [
              { key: 'set', label: 'Aniq narx' },
              { key: 'pct', label: 'Foizda (%)' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={mode === opt.key}
              onClick={() => setMode(opt.key)}
              className={clsx(
                'flex-1 rounded-ds-sm border py-2 text-caption font-bold transition-colors duration-fast',
                mode === opt.key
                  ? 'border-primary bg-mint-tint text-primary-text'
                  : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Input
          type="number"
          mono
          autoFocus
          label={mode === 'set' ? "Yangi narx (so'm)" : "O'zgarish foizi"}
          hint={mode === 'pct' ? 'Masalan: -10 yoki 15' : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            className="flex-1"
            disabled={!value}
            isLoading={saving}
            onClick={() => void submit()}
          >
            Qo&apos;llash
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const UNIT_OPTIONS = [
  { value: 'dona', label: 'dona' },
  { value: 'kg', label: 'kg' },
  { value: 'litr', label: 'litr' },
];

function AddProductModal({
  isOpen,
  categories,
  onClose,
  onCreated,
  onError,
}: {
  isOpen: boolean;
  categories: MarketCategory[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState<ProductUnit>('dona');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await marketApi.createProduct({
        name: name.trim(),
        sku: sku.trim() || undefined,
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        unit,
        categoryId: categoryId || undefined,
      });
      setName('');
      setSku('');
      setPrice('');
      setStock('');
      await onCreated();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yangi mahsulot" size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input
          label="Nomi"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Masalan: Guruch Lazer 1kg"
        />
        <Input
          label="SKU / Shtrix-kod"
          mono
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="GRC-1002"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Narx (so'm)"
            type="number"
            mono
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Zaxira"
            type="number"
            mono
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="0"
          />
          <Select
            label="Birlik"
            options={UNIT_OPTIONS}
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnit)}
          />
        </div>
        <Select
          label="Kategoriya"
          placeholder={categories.length ? 'Kategoriyani tanlang' : 'Kategoriya yo’q'}
          options={categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          hint={categories.length ? undefined : "Avval kategoriya qo'shing"}
        />

        <div className="flex justify-end gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={!name.trim()} isLoading={saving}>
            Qo&apos;shish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
