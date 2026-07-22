'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { marketApi, MarketCategory, Product, ProductStatus, ProductUnit } from '@/lib/api';

const STATUS_META: Record<ProductStatus, { label: string; bg: string; color: string }> = {
  active: { label: 'Faol', bg: 'bg-green-500/[0.14]', color: 'text-green-400' },
  out: { label: 'Tugagan', bg: 'bg-red-500/[0.14]', color: 'text-red-400' },
  hidden: { label: 'Yashirilgan', bg: 'bg-slate-400/[0.14]', color: 'text-slate-400' },
};

function photoBg(hue: number) {
  return { background: `linear-gradient(135deg,hsla(${hue},60%,45%,0.25),hsla(${hue},60%,30%,0.12))` };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const [p, c] = await Promise.all([marketApi.getProducts(), marketApi.getCategories()]);
    setProducts(p.data.data);
    setCategories(c.data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  const flashSaved = (id: string) => {
    setSaved((s) => ({ ...s, [id]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [id]: false })), 1300);
  };

  const updatePrice = async (id: string, price: number) => {
    const res = await marketApi.updateProduct(id, { price });
    setProducts((prev) => prev.map((p) => (p.id === id ? res.data.data : p)));
    flashSaved(`${id}-price`);
  };

  const updateStock = async (id: string, stock: number) => {
    const res = await marketApi.updateProduct(id, { stock: Math.max(0, stock) });
    setProducts((prev) => prev.map((p) => (p.id === id ? res.data.data : p)));
    flashSaved(`${id}-stock`);
  };

  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([id]) => id);

  const bulkSetStatus = async (status: ProductStatus) => {
    const ids = selectedIds;
    await marketApi.bulkUpdateProducts(ids, status);
    setSelected({});
    await load();
  };

  // No dedicated bulk-price backend endpoint — applies the same per-product
  // update the inline price field already uses, just looped over the
  // selection (exact value, or a % adjustment floored at 0).
  const bulkChangePrice = async (mode: 'set' | 'pct', value: number) => {
    await Promise.all(
      selectedIds.map((id) => {
        const product = products.find((p) => p.id === id);
        if (!product) return Promise.resolve();
        const newPrice =
          mode === 'set' ? Math.max(0, value) : Math.max(0, Math.round(product.price * (1 + value / 100)));
        return marketApi.updateProduct(id, { price: newPrice });
      })
    );
    setBulkPriceOpen(false);
    setSelected({});
    await load();
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2.5 mb-[18px]">
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 bg-brand-yellow/[0.08] border border-brand-yellow/25 rounded-[11px] py-1.5 pl-3.5 pr-1.5">
            <span className="text-[12.5px] font-bold text-brand-yellow">{selectedCount} tanlandi</span>
            <button onClick={() => bulkSetStatus('active')} className="bg-green-500/[0.15] text-green-400 rounded-lg px-[11px] py-1.5 text-xs font-bold">
              Faollashtirish
            </button>
            <button onClick={() => bulkSetStatus('hidden')} className="bg-white/[0.06] text-slate-400 rounded-lg px-[11px] py-1.5 text-xs font-bold">
              Yashirish
            </button>
            <button
              onClick={() => setBulkPriceOpen(true)}
              className="bg-white/[0.06] text-slate-400 rounded-lg px-[11px] py-1.5 text-xs font-bold"
            >
              Narxni o&apos;zgartirish
            </button>
          </div>
        )}
        <div className="ml-auto flex gap-[9px]">
          <button
            onClick={() => setShowAdd(true)}
            className="bg-brand-yellow text-brand-dark rounded-[11px] px-[17px] py-2.5 text-sm font-extrabold flex items-center gap-2 hover:bg-yellow-300"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
            Mahsulot qo&apos;shish
          </button>
        </div>
      </div>

      <div
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
      >
        <div className="grid grid-cols-[40px_2.2fr_1fr_1.1fr_1.1fr_1fr] gap-3.5 px-[18px] py-3 border-b border-white/[0.08] text-[11.5px] font-bold text-slate-500 uppercase tracking-wide">
          <div />
          <div>Mahsulot</div>
          <div>Kategoriya</div>
          <div>Narx (so&apos;m)</div>
          <div>Zaxira</div>
          <div>Holat</div>
        </div>

        {products.map((p) => {
          const sm = STATUS_META[p.status];
          const stockBorder = p.stock === 0 ? 'border-red-500/40' : p.stock <= 10 ? 'border-brand-yellow/40' : 'border-white/[0.09]';
          const stockColor = p.stock === 0 ? 'text-red-400' : p.stock <= 10 ? 'text-brand-yellow' : 'text-green-400';
          return (
            <div
              key={p.id}
              className="grid grid-cols-[40px_2.2fr_1fr_1.1fr_1.1fr_1fr] gap-3.5 px-[18px] py-3 border-b border-white/[0.04] items-center"
            >
              <input
                type="checkbox"
                checked={!!selected[p.id]}
                onChange={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
                className="w-4 h-4 accent-brand-yellow"
              />
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[10px] flex-shrink-0 flex items-center justify-center text-lg" style={photoBg(p.hue)}>
                  {p.emoji}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{p.sku}</div>
                </div>
              </div>
              <div className="text-[12.5px] text-slate-400">{categoryName(p.categoryId)}</div>
              <div className="relative flex items-center gap-1.5">
                <input
                  type="number"
                  defaultValue={p.price}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v !== p.price) updatePrice(p.id, v);
                  }}
                  className="w-[88px] bg-white/[0.04] border border-white/[0.09] rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-200 focus:border-brand-yellow outline-none"
                />
                {saved[`${p.id}-price`] && <Check />}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={p.stock}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v !== p.stock) updateStock(p.id, v);
                  }}
                  className={`w-16 bg-white/[0.04] border ${stockBorder} rounded-lg px-2.5 py-1.5 text-sm font-extrabold ${stockColor} focus:border-brand-yellow outline-none`}
                />
                <span className="text-[11.5px] text-slate-500">{p.unit}</span>
                {saved[`${p.id}-stock`] && <Check />}
              </div>
              <div>
                <span className={`text-[11.5px] font-bold px-[11px] py-1.5 rounded-lg ${sm.bg} ${sm.color}`}>{sm.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <AddProductModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      )}

      {bulkPriceOpen && (
        <BulkPriceModal
          count={selectedCount}
          onClose={() => setBulkPriceOpen(false)}
          onApply={bulkChangePrice}
        />
      )}
    </div>
  );
}

function BulkPriceModal({
  count,
  onClose,
  onApply,
}: {
  count: number;
  onClose: () => void;
  onApply: (mode: 'set' | 'pct', value: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<'set' | 'pct'>('set');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setSaving(true);
    try {
      await onApply(mode, num);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
      <div onClick={onClose} className="absolute inset-0 bg-black/65 animate-fade-in" />
      <div className="relative w-[400px] max-w-full bg-brand-dark border border-white/[0.09] rounded-2xl p-6">
        <h3 className="text-[17px] font-extrabold mb-1.5">Narxni ommaviy o&apos;zgartirish</h3>
        <p className="text-[13px] text-slate-400 mb-4.5">{count} ta mahsulotga qo&apos;llaniladi</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('set')}
            className={`flex-1 rounded-[9px] py-2 text-[12.5px] font-bold border ${
              mode === 'set' ? 'border-brand-yellow/50 text-brand-yellow bg-brand-yellow/10' : 'border-white/[0.08] text-slate-400'
            }`}
          >
            Aniq narx
          </button>
          <button
            onClick={() => setMode('pct')}
            className={`flex-1 rounded-[9px] py-2 text-[12.5px] font-bold border ${
              mode === 'pct' ? 'border-brand-yellow/50 text-brand-yellow bg-brand-yellow/10' : 'border-white/[0.08] text-slate-400'
            }`}
          >
            Foizda (%)
          </button>
        </div>

        <Field label={mode === 'set' ? "Yangi narx (so'm)" : 'O‘zgarish foizi (masalan -10 yoki 15)'}>
          <input className="input" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>

        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose} className="flex-1 border border-white/[0.12] text-slate-400 rounded-xl py-3 text-sm font-bold">
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={!value || saving}
            className="flex-1 bg-brand-yellow text-brand-black rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Qo‘llanmoqda...' : "Qo'llash"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Check() {
  return <span className="text-green-500 animate-pop">✓</span>;
}

function AddProductModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: MarketCategory[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState<ProductUnit>('dona');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name) return;
    setSaving(true);
    try {
      await marketApi.createProduct({
        name,
        sku: sku || undefined,
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        unit,
        categoryId: categoryId || undefined,
      });
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div onClick={onClose} className="absolute inset-0 bg-black/70 animate-fade-in" />
      <div
        className="relative w-[560px] max-h-[90vh] overflow-y-auto bg-brand-dark border border-white/[0.09] rounded-[20px] animate-pop"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}
      >
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between">
          <span className="text-[17px] font-extrabold">Yangi mahsulot</span>
          <button onClick={onClose} className="w-[34px] h-[34px] rounded-[9px] bg-white/[0.05] text-slate-400 flex items-center justify-center">
            <X className="h-[17px] w-[17px]" />
          </button>
        </div>
        <div className="px-6 py-[22px] flex flex-col gap-[15px]">
          <Field label="Nomi">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: Guruch Lazer 1kg"
              className="input"
            />
          </Field>
          <Field label="SKU / Shtrix-kod">
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="GRC-1002" className="input font-mono" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Narx (so'm)">
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="input font-bold" />
            </Field>
            <Field label="Zaxira">
              <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" className="input font-bold" />
            </Field>
            <Field label="Birlik">
              <select value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)} className="input">
                <option value="dona">dona</option>
                <option value="kg">kg</option>
                <option value="litr">litr</option>
              </select>
            </Field>
          </div>
          <Field label="Kategoriya">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="px-6 py-[18px] border-t border-white/[0.07] flex justify-end gap-2.5">
          <button onClick={onClose} className="bg-white/[0.05] border border-white/[0.08] text-slate-200 rounded-[11px] px-5 py-[11px] text-sm font-bold">
            Bekor qilish
          </button>
          <button
            onClick={save}
            disabled={saving || !name}
            className="bg-brand-yellow text-brand-dark rounded-[11px] px-6 py-[11px] text-sm font-extrabold disabled:opacity-50 hover:bg-yellow-300"
          >
            Qo&apos;shish
          </button>
        </div>
      </div>
      <style jsx>{`
        .input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          padding: 10px 13px;
          color: #e5e7eb;
          font-size: 13px;
        }
        .input:focus {
          outline: none;
          border-color: #facc15;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 font-semibold block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
