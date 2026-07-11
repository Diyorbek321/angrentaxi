'use client';

import { useEffect, useMemo, useState } from 'react';
import { marketApi, Product, StockMovement, Store } from '@/lib/api';

function photoBg(hue: number) {
  return { background: `linear-gradient(135deg,hsla(${hue},60%,45%,0.25),hsla(${hue},60%,30%,0.12))` };
}

function stockColor(stock: number, threshold: number) {
  return stock === 0 ? 'text-red-400' : stock <= threshold ? 'text-brand-yellow' : 'text-green-400';
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const load = async () => {
    const [p, m, s] = await Promise.all([marketApi.getProducts(), marketApi.getStockMovements(), marketApi.getStore()]);
    setProducts(p.data.data);
    setMovements(m.data.data);
    setStore(s.data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const threshold = store?.lowStockThreshold ?? 10;
  const outCount = products.filter((p) => p.stock === 0).length;
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= threshold).length;
  const needRestock = useMemo(
    () => products.filter((p) => p.stock <= threshold).sort((a, b) => a.stock - b.stock),
    [products, threshold]
  );

  const flashSaved = (id: string) => {
    setSaved((s) => ({ ...s, [id]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [id]: false })), 1300);
  };

  const bump = async (p: Product, delta: number) => {
    const next = Math.max(0, p.stock + delta);
    const res = await marketApi.updateProduct(p.id, { stock: next });
    setProducts((prev) => prev.map((x) => (x.id === p.id ? res.data.data : x)));
    flashSaved(p.id);
    const m = await marketApi.getStockMovements();
    setMovements(m.data.data);
  };

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div
          className="rounded-[14px] border border-red-500/25 px-[18px] py-4"
          style={{ background: 'linear-gradient(90deg,rgba(239,68,68,0.1),transparent)' }}
        >
          <div className="text-[12.5px] text-slate-400 font-semibold">Tugagan mahsulotlar</div>
          <div className="text-[28px] font-extrabold text-red-400 mt-1">{outCount}</div>
        </div>
        <div
          className="rounded-[14px] border border-brand-yellow/25 px-[18px] py-4"
          style={{ background: 'linear-gradient(90deg,rgba(250,204,21,0.1),transparent)' }}
        >
          <div className="text-[12.5px] text-slate-400 font-semibold">Kam qolgan (≤{threshold})</div>
          <div className="text-[28px] font-extrabold text-brand-yellow mt-1">{lowCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <div
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
        >
          <div className="px-[18px] py-[15px] border-b border-white/[0.06] text-sm font-bold">To&apos;ldirish kerak</div>
          {needRestock.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Barcha mahsulotlar yetarli</div>}
          {needRestock.map((p) => (
            <div key={p.id} className="flex items-center gap-3.5 px-[18px] py-[13px] border-b border-white/[0.04]">
              <div className="w-[38px] h-[38px] rounded-[10px] flex-shrink-0 flex items-center justify-center text-base" style={photoBg(p.hue)}>
                {p.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                <div className={`text-[11.5px] mt-0.5 font-bold ${stockColor(p.stock, threshold)}`}>
                  Qoldi: {p.stock} {p.unit}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => bump(p, -5)} className="w-[30px] h-[30px] rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-200 font-bold">
                  −
                </button>
                <span className="w-14 text-center bg-white/[0.04] border border-white/[0.09] rounded-lg py-1.5 text-sm font-extrabold">{p.stock}</span>
                <button
                  onClick={() => bump(p, 5)}
                  className="w-[30px] h-[30px] rounded-lg bg-brand-yellow/[0.12] border border-brand-yellow/25 text-brand-yellow font-bold"
                >
                  +
                </button>
                {saved[p.id] && <span className="text-green-500 animate-pop">✓</span>}
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
        >
          <div className="px-[18px] py-[15px] border-b border-white/[0.06] text-sm font-bold">Zaxira harakati</div>
          <div className="py-1.5">
            {movements.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Harakat yo&apos;q</div>}
            {movements.map((m) => {
              const up = m.delta > 0;
              return (
                <div key={m.id} className="flex items-center gap-3 px-[18px] py-[11px]">
                  <div
                    className={`w-[30px] h-[30px] rounded-lg flex-shrink-0 flex items-center justify-center text-[13px] font-extrabold ${
                      up ? 'bg-green-500/[0.14] text-green-400' : 'bg-red-500/[0.12] text-red-400'
                    }`}
                  >
                    {up ? '↑' : '↓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{m.product.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {m.note} · {new Date(m.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className={`text-[12.5px] font-extrabold ${up ? 'text-green-400' : 'text-red-400'}`}>
                    {up ? '+' : ''}
                    {m.delta}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
