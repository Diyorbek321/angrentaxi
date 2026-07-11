'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Wallet, Clock, UtensilsCrossed } from 'lucide-react';
import { foodApi, DashboardData } from '@/lib/api';
import { money } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    foodApi.getDashboard().then((res) => setData(res.data.data));
  }, []);

  if (!data) {
    return <div className="text-slate-500 text-sm">Yuklanmoqda...</div>;
  }

  const stats = [
    { label: 'Bugungi buyurtmalar', value: String(data.todayOrdersCount), dot: '#60A5FA', icon: ClipboardList },
    { label: 'Bugungi tushum', value: money(data.todayRevenue), unit: '', dot: '#FACC15', icon: Wallet },
    { label: "O'rt. tayyorlash", value: String(data.avgPrepMinutes), unit: 'daq', dot: '#FB923C', icon: Clock },
    { label: 'Faol taomlar', value: String(data.activeDishesCount), dot: '#10B981', icon: UtensilsCrossed },
  ];

  return (
    <div className="max-w-[1180px] mx-auto flex flex-col gap-[22px]">
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {stats.map((s) => (
          <div key={s.label} className="bg-[#111827] border border-white/[0.07] rounded-[18px] p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.dot }} />
              <s.icon className="h-5 w-5 text-slate-700" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[30px] font-bold tracking-tight">{s.value}</span>
              {s.unit && <span className="text-[13px] text-slate-500 font-semibold">{s.unit}</span>}
            </div>
            <div className="text-[13px] text-slate-400 font-semibold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#111827] border border-white/[0.07] rounded-[18px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-[18px] border-b border-white/[0.06]">
          <h3 className="text-[15px] font-bold">So&apos;nggi buyurtmalar</h3>
          <button onClick={() => router.push('/dashboard/orders')} className="text-[13px] font-semibold text-slate-300 hover:text-white">
            Barchasi →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr className="text-left text-slate-500 text-[11.5px] font-bold uppercase tracking-wide">
                <th className="px-5 py-3">№</th>
                <th className="px-5 py-3">Mijoz</th>
                <th className="px-5 py-3">Taomlar</th>
                <th className="px-5 py-3">Summa</th>
                <th className="px-5 py-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id} className="border-t border-white/[0.05]">
                  <td className="px-5 py-3.5 font-mono text-slate-300">
                    <span className="text-slate-500">#</span>
                    {o.id.slice(0, 6)}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-sm">{o.customer}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-[13px]">{o.itemsCount} ta</td>
                  <td className="px-5 py-3.5 font-mono">{money(o.totalPrice)}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500 text-sm">
                    Hali buyurtma yo&apos;q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
