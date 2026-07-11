'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Wallet, AlertTriangle, Boxes } from 'lucide-react';
import { marketApi, DashboardData } from '@/lib/api';
import { money, formatTime } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    marketApi.getDashboard().then((res) => setData(res.data.data));
  }, []);

  if (!data) {
    return <div className="text-slate-500 text-sm">Yuklanmoqda...</div>;
  }

  const stats = [
    {
      label: 'Bugungi buyurtmalar',
      value: String(data.todayOrdersCount),
      sub: `${data.todayOrdersCount} ta bugun`,
      icon: ClipboardList,
      iconBg: 'bg-brand-yellow/10',
      iconColor: 'text-brand-yellow',
      subColor: 'text-slate-400',
    },
    {
      label: 'Bugungi tushum',
      value: money(data.todayRevenue),
      sub: 'Bugungi jami savdo',
      icon: Wallet,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-400',
      subColor: 'text-green-400',
    },
    {
      label: 'Tugagan mahsulotlar',
      value: String(data.outOfStockCount),
      sub: "Zudlik bilan to'ldiring",
      icon: AlertTriangle,
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      subColor: 'text-red-400',
    },
    {
      label: 'Aktiv mahsulotlar',
      value: String(data.activeProductsCount),
      sub: `${data.hiddenProductsCount} yashirilgan`,
      icon: Boxes,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400',
      subColor: 'text-slate-400',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-4 gap-4 mb-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/[0.07] p-[18px] pb-4"
            style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))' }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[12.5px] text-slate-400 font-semibold">{s.label}</span>
              <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center ${s.iconBg} ${s.iconColor}`}>
                <s.icon className="h-[18px] w-[18px]" />
              </div>
            </div>
            <div className="text-[26px] font-extrabold tracking-tight">{s.value}</div>
            <div className={`text-xs font-semibold mt-1.5 ${s.subColor}`}>{s.sub}</div>
          </div>
        ))}
      </div>

      {data.lowStock.length > 0 && (
        <div
          className="flex items-center gap-4 rounded-[14px] border border-red-500/30 px-[18px] py-[15px] mb-5"
          style={{ background: 'linear-gradient(90deg,rgba(239,68,68,0.12),rgba(239,68,68,0.03))' }}
        >
          <div className="w-10 h-10 rounded-[11px] bg-red-500/[0.18] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-bold text-red-300">
              Zaxira tugash arafasida — {data.lowStock.length} ta mahsulot
            </div>
            <div className="text-[12.5px] text-slate-400 mt-[3px] whitespace-nowrap overflow-hidden text-ellipsis">
              {data.lowStock.map((p) => `${p.name} (${p.stock} ${p.unit})`).join(' · ')}
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/stock')}
            className="flex-shrink-0 bg-red-500 text-white rounded-[10px] px-4 py-[9px] text-[12.5px] font-bold hover:bg-red-600"
          >
            To&apos;ldirish →
          </button>
        </div>
      )}

      <div className="grid grid-cols-[1.6fr_1fr] gap-4">
        <div
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
        >
          <div className="flex items-center justify-between px-[18px] py-4 border-b border-white/[0.06]">
            <span className="text-sm font-bold">So&apos;nggi buyurtmalar</span>
            <button onClick={() => router.push('/dashboard/orders')} className="text-brand-yellow text-[12.5px] font-bold">
              Barchasi
            </button>
          </div>
          <div>
            {data.recentOrders.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">Hali buyurtma yo&apos;q</div>
            )}
            {data.recentOrders.map((o) => (
              <div
                key={o.id}
                onClick={() => router.push('/dashboard/orders')}
                className="flex items-center gap-3.5 px-[18px] py-[13px] border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.025]"
              >
                <div className="text-[13px] font-bold w-16 text-slate-200">{o.id.slice(0, 6)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{o.customer}</div>
                  <div className="text-[11.5px] text-slate-500 mt-0.5">
                    {o.itemsCount} ta mahsulot · {formatTime(o.createdAt)}
                  </div>
                </div>
                <div className="text-[13px] font-bold text-slate-200">{money(o.totalPrice)}</div>
                <StatusBadge status={o.status} />
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl border border-white/[0.07] p-[18px]"
          style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
        >
          <div className="text-sm font-bold mb-4">Bugungi sotuvlar</div>
          {data.bestSellers.length === 0 && <div className="text-slate-500 text-sm">Hali ma&apos;lumot yo&apos;q</div>}
          {data.bestSellers.map((b, i) => {
            const maxSold = data.bestSellers[0]?.sold || 1;
            const pct = Math.round((b.sold / maxSold) * 100);
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
      </div>
    </div>
  );
}
