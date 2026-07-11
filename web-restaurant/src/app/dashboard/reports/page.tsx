'use client';

import { useEffect, useState } from 'react';
import { foodApi, ReportsData } from '@/lib/api';
import { money } from '@/lib/utils';

export default function ReportsPage() {
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    foodApi.getReports(range).then((res) => setData(res.data.data));
  }, [range]);

  if (!data) {
    return <div className="text-slate-500 text-sm">Yuklanmoqda...</div>;
  }

  const maxRevenue = Math.max(...data.revenue.map((r) => r.total), 1);
  const maxHourly = Math.max(...data.hourly.map((h) => h.count), 1);
  const peakHour = data.hourly.reduce((best, h) => (h.count > best.count ? h : best), data.hourly[0]);
  const maxDish = data.topDishes[0]?.qty || 1;

  return (
    <div className="max-w-[1180px] mx-auto flex flex-col gap-[18px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-[15px] font-bold">So&apos;nggi {range} kun bo&apos;yicha ko&apos;rsatkichlar</h3>
        <div className="flex gap-0.5 bg-[#111827] border border-white/[0.08] rounded-[11px] p-[3px]">
          {[7, 30].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r as 7 | 30)}
              className={`px-3.5 py-1.5 rounded-[9px] text-[13px] font-semibold ${
                range === r ? 'bg-brand-yellow text-brand-black' : 'text-slate-400'
              }`}
            >
              {r} kun
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <PayoutTile label="Jami tushum" value={money(data.payout.gross)} />
        <PayoutTile label={`Komissiya (${data.payout.commissionRate}%)`} value={`−${money(data.payout.commission)}`} color="#F87171" />
        <PayoutTile label="Sof to'lov" value={money(data.payout.net)} highlight />
        <PayoutTile label="Buyurtmalar" value={String(data.payout.orders)} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="bg-[#111827] border border-white/[0.07] rounded-2xl p-5">
          <h4 className="text-sm font-bold mb-[18px]">Tushum dinamikasi</h4>
          <div className="flex items-end gap-2.5 h-[180px]">
            {data.revenue.map((r, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="font-mono text-[11px] text-slate-400">{Math.round(r.total / 1000)}k</span>
                <div className="w-full h-full flex items-end">
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${Math.max(2, (r.total / maxRevenue) * 100)}%`, background: 'linear-gradient(180deg,#FACC15,#F59E0B)' }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-semibold">{r.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111827] border border-white/[0.07] rounded-2xl p-5">
          <h4 className="text-sm font-bold mb-[18px]">Eng ko&apos;p sotilgan taomlar</h4>
          <div className="flex flex-col gap-4">
            {data.topDishes.length === 0 && <div className="text-slate-500 text-sm">Hali ma&apos;lumot yo&apos;q</div>}
            {data.topDishes.map((t) => (
              <div key={t.name}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[13px] font-semibold">{t.name}</span>
                  <span className="font-mono text-[13px] text-slate-400">{t.qty}</span>
                </div>
                <div className="bg-white/[0.06] rounded-full h-1.5">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(t.qty / maxDish) * 100}%`, background: 'linear-gradient(90deg,#FACC15,#F59E0B)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#111827] border border-white/[0.07] rounded-2xl p-5">
        <h4 className="text-sm font-bold mb-[18px]">Soatlar bo&apos;yicha buyurtmalar hajmi</h4>
        <div className="flex items-end gap-1.5 h-[150px]">
          {data.hourly.map((h) => (
            <div key={h.hour} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <div className="w-full h-full flex items-end">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max(2, (h.count / maxHourly) * 100)}%`,
                    background: h.hour === peakHour.hour ? '#FACC15' : 'rgba(96,165,250,0.55)',
                  }}
                />
              </div>
              <span className="font-mono text-[10px] text-slate-500">{h.hour}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PayoutTile({ label, value, color, highlight }: { label: string; value: string; color?: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-2xl p-[18px] border"
      style={
        highlight
          ? { background: 'linear-gradient(135deg,rgba(250,204,21,0.14),rgba(250,204,21,0.03))', borderColor: 'rgba(250,204,21,0.35)' }
          : { background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }
      }
    >
      <div className="text-[12.5px] font-semibold" style={{ color: highlight ? '#FACC15' : '#94A3B8' }}>
        {label}
      </div>
      <div className="font-mono text-[22px] font-bold mt-1.5" style={{ color: color ?? (highlight ? '#FACC15' : undefined) }}>
        {value}
      </div>
    </div>
  );
}
