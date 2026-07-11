'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { marketApi, MarketCategory } from '@/lib/api';

function photoBg(hue: number) {
  return { background: `linear-gradient(135deg,hsla(${hue},60%,45%,0.25),hsla(${hue},60%,30%,0.12))` };
}

const HUES = [45, 200, 25, 280, 150, 320];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🛒');

  const load = async () => {
    const res = await marketApi.getCategories();
    setCategories(res.data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (c: MarketCategory) => {
    await marketApi.updateCategory(c.id, { isActive: !c.isActive });
    await load();
  };

  const remove = async (id: string) => {
    await marketApi.deleteCategory(id);
    await load();
  };

  const create = async () => {
    if (!name) return;
    await marketApi.createCategory({ name, emoji, sortOrder: categories.length });
    setName('');
    setEmoji('🛒');
    setShowAdd(false);
    await load();
  };

  return (
    <div className="animate-fade-in max-w-[680px]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-500 font-semibold">Kategoriyalarni boshqarish</span>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="bg-brand-yellow text-brand-dark rounded-[11px] px-4 py-2.5 text-[12.5px] font-extrabold flex items-center gap-[7px] hover:bg-yellow-300"
        >
          <Plus className="h-[15px] w-[15px]" strokeWidth={2.6} />
          Kategoriya
        </button>
      </div>

      {showAdd && (
        <div className="flex items-center gap-2.5 mb-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3.5">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-14 text-center bg-white/[0.04] border border-white/[0.09] rounded-lg px-2 py-2 text-lg"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kategoriya nomi"
            className="flex-1 bg-white/[0.04] border border-white/[0.09] rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-brand-yellow outline-none"
          />
          <button onClick={create} className="bg-brand-yellow text-brand-dark rounded-lg px-4 py-2 text-sm font-bold">
            Saqlash
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {categories.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3.5 rounded-[14px] border border-white/[0.07] px-[18px] py-[15px]"
            style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
          >
            <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-lg" style={photoBg(HUES[i % HUES.length])}>
              {c.emoji}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">{c.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{c.isActive ? 'Faol' : "O'chirilgan"}</div>
            </div>
            <label className="relative inline-flex cursor-pointer">
              <span
                onClick={() => toggle(c)}
                className={`w-[38px] h-[22px] rounded-full block relative transition-colors ${c.isActive ? 'bg-brand-yellow' : 'bg-white/[0.12]'}`}
              >
                <span
                  className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all"
                  style={{ left: c.isActive ? '18px' : '2px' }}
                />
              </span>
            </label>
            <button onClick={() => remove(c.id)} className="w-8 h-8 rounded-[9px] bg-white/[0.04] text-slate-500 flex items-center justify-center hover:text-red-400">
              <Trash2 className="h-[15px] w-[15px]" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
