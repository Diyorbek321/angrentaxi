'use client';

import { useEffect, useState } from 'react';
import { Clock, Pencil, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { foodApi, Dish, MenuCategory } from '@/lib/api';
import { money } from '@/lib/utils';

export default function MenuPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [modalDish, setModalDish] = useState<Dish | 'new' | null>(null);

  const load = async () => {
    const [d, c] = await Promise.all([foodApi.getDishes(), foodApi.getCategories()]);
    setDishes(d.data.data);
    setCategories(c.data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';
  const filtered = dishes.filter((d) => catFilter === 'all' || d.categoryId === catFilter);

  const toggleAvail = async (d: Dish) => {
    const res = await foodApi.updateDish(d.id, { isAvailable: !d.isAvailable });
    setDishes((prev) => prev.map((x) => (x.id === d.id ? res.data.data : x)));
  };

  const remove = async (id: string) => {
    await foodApi.deleteDish(id);
    await load();
  };

  return (
    <div className="max-w-[1180px] mx-auto flex flex-col gap-[18px]">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 overflow-x-auto flex-1">
          <FilterChip label="Barchasi" active={catFilter === 'all'} onClick={() => setCatFilter('all')} />
          {categories.map((c) => (
            <FilterChip key={c.id} label={c.name} active={catFilter === c.id} onClick={() => setCatFilter(c.id)} />
          ))}
        </div>
        <button
          onClick={() => setModalDish('new')}
          className="inline-flex items-center gap-[7px] bg-brand-yellow text-brand-black rounded-[11px] px-4 py-2.5 text-[13.5px] font-bold whitespace-nowrap shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:bg-yellow-300"
        >
          <Plus className="h-4 w-4" />
          Yangi taom qo&apos;shish
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <div className="w-16 h-16 rounded-[18px] bg-[#111827] border border-white/[0.07] flex items-center justify-center mx-auto mb-4 text-slate-700">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <div className="text-[15px] font-bold text-slate-400">Bu bo&apos;limda taom yo&apos;q</div>
          <div className="text-[13px] mt-1">Yangi taom qo&apos;shish uchun yuqoridagi tugmani bosing</div>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {filtered.map((d) => (
          <div
            key={d.id}
            className="bg-[#111827] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col"
            style={{ opacity: d.isAvailable ? 1 : 0.62 }}
          >
            <div className="h-[130px] bg-gradient-to-br from-[#1F2937] to-[#151d2e] flex items-center justify-center text-slate-700 relative">
              <UtensilsCrossed className="h-8 w-8" />
              <span className="absolute top-2.5 left-2.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/50 text-slate-400 border border-white/[0.08]">
                {categoryName(d.categoryId)}
              </span>
            </div>
            <div className="p-3.5 flex flex-col gap-2 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[14.5px] font-bold leading-tight">{d.name}</div>
                <span className="font-mono text-sm font-bold text-brand-yellow whitespace-nowrap">{money(d.price)}</span>
              </div>
              <div className="text-xs text-slate-500 leading-snug min-h-[34px]">{d.description}</div>
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold"
                  style={{ color: d.isAvailable ? '#10B981' : '#F87171' }}
                >
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: 'currentColor' }} />
                  {d.isAvailable ? 'Mavjud' : 'Tugagan'}
                </span>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {d.prepMinutes} daq
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 pt-3 border-t border-white/[0.06]">
                <button
                  onClick={() => toggleAvail(d)}
                  className="w-10 h-[22px] rounded-full p-0.5 flex-shrink-0 flex items-center transition-colors"
                  style={{ background: d.isAvailable ? '#10B981' : 'rgba(255,255,255,0.14)', justifyContent: d.isAvailable ? 'flex-end' : 'flex-start' }}
                >
                  <span className="w-[18px] h-[18px] rounded-full bg-white block" />
                </button>
                <span className="flex-1" />
                <button
                  onClick={() => setModalDish(d)}
                  className="w-[34px] h-[34px] rounded-[9px] bg-white/5 border border-white/[0.08] text-slate-400 flex items-center justify-center hover:text-brand-yellow"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(d.id)}
                  className="w-[34px] h-[34px] rounded-[9px] bg-white/5 border border-white/[0.08] text-slate-400 flex items-center justify-center hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalDish && (
        <DishModal
          dish={modalDish === 'new' ? null : modalDish}
          categories={categories}
          onClose={() => setModalDish(null)}
          onSaved={async () => {
            setModalDish(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-[7px] rounded-full text-[13px] font-semibold whitespace-nowrap border ${
        active ? 'border-brand-yellow bg-brand-yellow text-brand-black' : 'border-white/[0.08] text-slate-400'
      }`}
    >
      {label}
    </button>
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
  const [name, setName] = useState(dish?.name ?? '');
  const [description, setDescription] = useState(dish?.description ?? '');
  const [price, setPrice] = useState(dish ? String(dish.price) : '');
  const [prep, setPrep] = useState(dish ? String(dish.prepMinutes) : '12');
  const [categoryId, setCategoryId] = useState(dish?.categoryId ?? categories[0]?.id ?? '');
  const [tags, setTags] = useState(dish?.tags.join(', ') ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name,
      description: description || undefined,
      price: Number(price) || 0,
      prepMinutes: Number(prep) || 10,
      categoryId: categoryId || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (dish) {
        await foodApi.updateDish(dish.id, payload);
      } else {
        await foodApi.createDish(payload);
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5">
      <div onClick={onClose} className="absolute inset-0 bg-black/65 animate-fade-in" />
      <div className="relative w-[480px] max-w-full max-h-[90vh] overflow-y-auto bg-brand-dark border border-white/[0.09] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4.5">
          <h3 className="text-[17px] font-extrabold">{dish ? 'Taomni tahrirlash' : "Yangi taom qo'shish"}</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-[10px] border border-white/[0.08] text-slate-400 flex items-center justify-center">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="flex flex-col gap-3.5">
          <Field label="Nomi">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Klassik Burger" className="input" />
          </Field>
          <Field label="Tavsif">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Qisqa tavsif"
              className="input resize-y"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Narxi (so'm)">
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="32000" className="input" />
            </Field>
            <Field label="Tayyorlash (daq)">
              <input type="number" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="12" className="input" />
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
          <Field label="Teglar (vergul bilan)">
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Achchiq, Gluten" className="input" />
          </Field>
        </div>
        <div className="flex gap-2.5 mt-5.5">
          <button onClick={onClose} className="flex-1 border border-white/[0.12] text-slate-400 rounded-xl py-3 text-sm font-bold">
            Bekor qilish
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex-1 bg-brand-yellow text-brand-black rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-yellow-300"
          >
            Saqlash
          </button>
        </div>
      </div>
      <style jsx>{`
        .input {
          width: 100%;
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
        }
        .input:focus {
          border-color: #facc15;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-slate-400 font-semibold">{label}</span>
      {children}
    </label>
  );
}
