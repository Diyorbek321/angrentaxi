'use client';

import { useEffect, useState } from 'react';
import { marketApi, ReportsData } from '@/lib/api';
import { money } from '@/lib/utils';

const PALETTE = ['#FACC15', '#60A5FA', '#4ADE80', '#A78BFA', '#F472B6', '#38BDF8'];

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    marketApi.getReports().then((res) => setData(res.data.data));
  }, []);

  if (!data) {
    return <div className="text-slate-500 text-sm">Yuklanmoqda...</div>;
  }

  const maxRevenue = Math.max(...data.weeklyRevenue.map((d) => d.total), 1);
  const weekTotal = data.weeklyRevenue.reduce((s, d) => s + d.total, 0);

  let cumulative = 0;
  const donutStops = data.categoryBreakdown.map((c, i) => {
    const from = cumulative;
    cumulative += c.pct;
    return `${PALETTE[i % PALETTE.length]} ${from}% ${cumulative}%`;
  });
  const donut = donutStops.length ? `conic-gradient(${donutStops.join(',')})` : 'rgba(255,255,255,0.06)';

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-[1.5fr_1fr] gap-4 mb-4">
        <div
          className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-sm font-bold">Haftalik tushum</div>
              <div className="text-[22px] font-extrabold mt-1 tracking-tight">
                {money(weekTotal)}
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3.5 h-[150px] pt-2.5">
            {data.weeklyRevenue.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full max-w-[34px] rounded-t-[7px]"
                  style={{
                    height: `${Math.max(4, Math.round((d.total / maxRevenue) * 100))}%`,
                    background: i === 5 ? 'linear-gradient(180deg,#FACC15,#F59E0B)' : 'rgba(250,204,21,0.35)',
                  }}
                />
                <span className="text-[11px] text-slate-500 font-semibold">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
        >
          <div className="text-sm font-bold mb-4">Kategoriya bo&apos;yicha</div>
          {data.categoryBreakdown.length === 0 ? (
            <div className="text-slate-500 text-sm">Hali ma&apos;lumot yo&apos;q</div>
          ) : (
            <div className="flex items-center gap-5">
              <div className="w-[120px] h-[120px] rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: donut }}>
                <div className="w-[72px] h-[72px] rounded-full bg-brand-dark flex flex-col items-center justify-center">
                  <span className="text-lg font-extrabold">{data.categoryBreakdown.length}</span>
                  <span className="text-[9.5px] text-slate-500 font-semibold">kategoriya</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-[11px]">
                {data.categoryBreakdown.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-[12.5px] font-semibold flex-1">{c.name}</span>
                    <span className="text-[12.5px] font-bold text-slate-400">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-2xl border border-white/[0.07] p-5"
          style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
        >
          <div className="text-sm font-bold mb-4">Eng ko&apos;p sotilganlar</div>
          {data.bestSellers.length === 0 && <div className="text-slate-500 text-sm">Hali ma&apos;lumot yo&apos;q</div>}
          {data.bestSellers.map((b, i) => {
            const max = data.bestSellers[0]?.sold || 1;
            const pct = Math.round((b.sold / max) * 100);
            return (
              <div key={b.name} className="flex items-center gap-3 mb-3.5">
                <div className="w-[26px] h-[26px] rounded-lg bg-brand-yellow/10 text-brand-yellow text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{b.name}</div>
                  <div className="h-[5px] rounded-full bg-white/[0.06] mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-yellow to-amber-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-xs font-bold text-slate-400">{b.sold}</div>
              </div>
            );
          })}
        </div>

        <div
          className="rounded-2xl border border-white/[0.07] p-5 flex flex-col justify-center items-center text-center"
          style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
        >
          <div className="text-[13px] text-slate-400 font-semibold">Zaxira aylanishi</div>
          <div
            className="w-[130px] h-[130px] rounded-full my-4 flex items-center justify-center"
            style={{
              background: `conic-gradient(#22C55E 0% ${Math.min(100, data.stockTurnover * 10)}%, rgba(255,255,255,0.06) ${Math.min(
                100,
                data.stockTurnover * 10
              )}% 100%)`,
            }}
          >
            <div className="w-24 h-24 rounded-full bg-brand-dark flex flex-col items-center justify-center">
              <span className="text-[26px] font-extrabold text-green-400">{data.stockTurnover}×</span>
              <span className="text-[10px] text-slate-500 font-semibold">jami</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 max-w-[200px]">
            Har bir mahsulot o&apos;rtacha {data.stockTurnover}x sotilgan / joriy zaxiraga nisbatan
          </div>
        </div>
      </div>
    </div>
  );
}
