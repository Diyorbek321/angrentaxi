'use client';

import { useEffect, useState } from 'react';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { foodApi, Dish, MenuCategory } from '@/lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const load = async () => {
    const [c, d] = await Promise.all([foodApi.getCategories(), foodApi.getDishes()]);
    setCategories(c.data.data);
    setDishes(d.data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    await foodApi.createCategory({ name, sortOrder: categories.length });
    setNewName('');
    await load();
  };

  const startRename = (c: MenuCategory) => {
    setRenamingId(c.id);
    setRenameVal(c.name);
  };

  const commitRename = async () => {
    if (renamingId && renameVal.trim()) {
      await foodApi.updateCategory(renamingId, { name: renameVal.trim() });
    }
    setRenamingId(null);
    await load();
  };

  const remove = async (id: string) => {
    await foodApi.deleteCategory(id);
    await load();
  };

  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-3.5">
      <div className="flex gap-2.5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Yangi kategoriya nomi"
          className="flex-1 bg-[#111827] border border-white/[0.08] text-slate-100 px-3.5 py-[11px] rounded-[11px] text-sm outline-none focus:border-brand-yellow"
        />
        <button
          onClick={create}
          className="inline-flex items-center gap-1.5 bg-brand-yellow text-brand-black rounded-[11px] px-4.5 font-bold text-[13.5px]"
        >
          <Plus className="h-4 w-4" />
          Qo&apos;shish
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 bg-[#111827] border border-white/[0.07] rounded-[13px] px-3.5 py-3">
            <GripVertical className="h-[18px] w-[18px] text-slate-600 cursor-grab" />
            {renamingId === c.id ? (
              <input
                autoFocus
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                className="flex-1 bg-brand-dark border border-brand-yellow/50 rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none"
              />
            ) : (
              <span className="flex-1 text-[14.5px] font-bold">{c.name}</span>
            )}
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {dishes.filter((d) => d.categoryId === c.id).length} ta taom
            </span>
            <button
              onClick={() => startRename(c)}
              className="w-8 h-8 rounded-lg text-slate-500 flex items-center justify-center hover:text-brand-yellow hover:bg-white/5"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => remove(c.id)}
              className="w-8 h-8 rounded-lg text-slate-500 flex items-center justify-center hover:text-red-400 hover:bg-white/5"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
