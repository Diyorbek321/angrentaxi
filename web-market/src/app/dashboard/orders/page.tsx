'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { marketApi, MarketOrder, MarketOrderStatus } from '@/lib/api';
import { money, formatTime } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';

const TABS: Array<{ key: 'all' | MarketOrderStatus; label: string }> = [
  { key: 'all', label: 'Barchasi' },
  { key: 'new', label: 'Yangi' },
  { key: 'packing', label: "Yig'ilmoqda" },
  { key: 'shipped', label: 'Yuborildi' },
  { key: 'delivered', label: 'Yetkazildi' },
  { key: 'cancelled', label: 'Bekor' },
];

const ADVANCE_LABEL: Record<string, string> = {
  new: "Yig'ishni boshlash",
  packing: 'Yuborildi deb belgilash',
  shipped: 'Yetkazildi deb belgilash',
  delivered: 'Yakunlangan',
  cancelled: 'Bekor qilingan',
};

function orderName(o: MarketOrder): string {
  const name = [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ').trim();
  return name || o.customerPhone || 'Mijoz';
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [tab, setTab] = useState<'all' | MarketOrderStatus>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const load = async () => {
    const res = await marketApi.getOrders();
    setOrders(res.data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => (tab === 'all' ? orders : orders.filter((o) => o.status === tab)),
    [orders, tab]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected = filtered.length > 0 && filtered.every((o) => selected[o.id]);

  const toggleAll = () => {
    const next = { ...selected };
    filtered.forEach((o) => (next[o.id] = !allSelected));
    setSelected(next);
  };

  const bulkPack = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([id]) => id);
    await Promise.all(
      ids
        .map((id) => orders.find((o) => o.id === id))
        .filter((o): o is MarketOrder => !!o && o.status === 'new')
        .map((o) => marketApi.advanceOrder(o.id))
    );
    setSelected({});
    await load();
  };

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-[18px] flex-wrap">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-[10px] px-[14px] py-2 text-[12.5px] font-bold flex items-center gap-[7px] border ${
                active ? 'bg-brand-yellow/[0.12] border-brand-yellow/[0.35] text-brand-yellow' : 'bg-white/[0.03] border-white/[0.07] text-slate-400'
              }`}
            >
              {t.label}
              <span className={`text-[11px] px-[7px] rounded-[7px] ${active ? 'bg-brand-yellow/20 text-brand-yellow' : 'bg-white/[0.06] text-slate-500'}`}>
                {counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          {selectedCount > 0 && (
            <button
              onClick={bulkPack}
              className="bg-brand-yellow text-brand-dark rounded-[10px] px-[15px] py-[9px] text-[12.5px] font-extrabold flex items-center gap-[7px]"
            >
              <Check className="h-[15px] w-[15px]" strokeWidth={2.4} />
              {selectedCount} ta yig&apos;ildi deb belgilash
            </button>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))' }}
      >
        <div className="grid grid-cols-[44px_90px_1fr_120px_130px_130px] gap-3 px-[18px] py-3 border-b border-white/[0.08] text-[11.5px] font-bold text-slate-500 uppercase tracking-wide">
          <div>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-brand-yellow" />
          </div>
          <div>Buyurtma</div>
          <div>Mijoz</div>
          <div>Mahsulot</div>
          <div>Summa</div>
          <div>Holat</div>
        </div>

        {filtered.length === 0 && (
          <div className="p-[50px] text-center text-slate-500 text-sm">Bu holatda buyurtma yo&apos;q</div>
        )}

        {filtered.map((o) => (
          <div
            key={o.id}
            onClick={() => setOpenOrderId(o.id)}
            className="grid grid-cols-[44px_90px_1fr_120px_130px_130px] gap-3 px-[18px] py-[14px] border-b border-white/[0.04] items-center cursor-pointer hover:bg-white/[0.025]"
          >
            <div onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={!!selected[o.id]}
                onChange={() => setSelected((s) => ({ ...s, [o.id]: !s[o.id] }))}
                className="w-4 h-4 accent-brand-yellow"
              />
            </div>
            <div className="text-[13px] font-bold">{o.id.slice(0, 6)}</div>
            <div className="text-[13px] font-semibold min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{orderName(o)}</div>
            <div className="text-[12.5px] text-slate-400">
              {o.items.reduce((s, i) => s + i.qty, 0)} ta · {formatTime(o.createdAt)}
            </div>
            <div className="text-[13px] font-bold">{money(o.totalPrice)}</div>
            <div>
              <StatusBadge status={o.status} />
            </div>
          </div>
        ))}
      </div>

      {openOrder && (
        <OrderDrawer
          order={openOrder}
          onClose={() => setOpenOrderId(null)}
          onChanged={async () => {
            await load();
          }}
        />
      )}
    </div>
  );
}

function OrderDrawer({
  order,
  onClose,
  onChanged,
}: {
  order: MarketOrder;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const packedCount = order.items.filter((i) => i.packed).length;
  const canAdvance = order.status === 'new' || order.status === 'packing' || order.status === 'shipped';

  const togglePack = async (index: number) => {
    await marketApi.togglePackItem(order.id, index);
    await onChanged();
  };

  const advance = async () => {
    await marketApi.advanceOrder(order.id);
    await onChanged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40">
      <div onClick={onClose} className="absolute inset-0 bg-black/60 animate-fade-in" />
      <div
        className="absolute top-0 right-0 bottom-0 w-[440px] bg-brand-dark border-l border-white/[0.08] flex flex-col animate-slideIn"
        style={{ boxShadow: '-24px 0 60px rgba(0,0,0,0.4)' }}
      >
        <div className="px-[22px] py-5 border-b border-white/[0.07] flex items-center justify-between">
          <div>
            <div className="text-[17px] font-extrabold">Buyurtma {order.id.slice(0, 6)}</div>
            <div className="text-[12.5px] text-slate-500 mt-0.5">
              {orderName(order)} · {formatTime(order.createdAt)}
            </div>
          </div>
          <button onClick={onClose} className="w-[34px] h-[34px] rounded-[9px] bg-white/[0.05] text-slate-400 flex items-center justify-center">
            <X className="h-[17px] w-[17px]" />
          </button>
        </div>

        <div className="px-[22px] py-[18px] border-b border-white/[0.07] flex items-center justify-between">
          <StatusBadge status={order.status} />
          <div className="text-[12.5px] text-slate-400 font-semibold">
            Yig&apos;ildi: {packedCount}/{order.items.length}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wide px-2.5 pt-3 pb-2">Yig&apos;ish ro&apos;yxati</div>
          {order.items.map((it, index) => (
            <div
              key={index}
              onClick={() => togglePack(index)}
              className="flex items-center gap-[13px] px-2.5 py-[13px] rounded-[11px] cursor-pointer hover:bg-white/[0.03]"
            >
              <span
                className={`w-[22px] h-[22px] rounded-[7px] flex-shrink-0 border-2 flex items-center justify-center text-brand-dark ${
                  it.packed ? 'bg-green-500 border-green-500' : 'border-white/[0.18]'
                }`}
              >
                {it.packed && <Check className="h-[13px] w-[13px]" strokeWidth={3.4} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[13.5px] font-semibold ${it.packed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{it.name}</div>
              </div>
              <div className="text-[13px] font-extrabold text-slate-400">×{it.qty}</div>
            </div>
          ))}
        </div>

        <div className="px-[22px] py-4 border-t border-white/[0.07]">
          <div className="flex items-center justify-between mb-[14px]">
            <span className="text-[13px] text-slate-400 font-semibold">Jami summa</span>
            <span className="text-[19px] font-extrabold">{money(order.totalPrice)}</span>
          </div>
          {canAdvance ? (
            <button onClick={advance} className="w-full bg-brand-yellow text-brand-dark rounded-xl py-[13px] text-sm font-extrabold hover:bg-yellow-300">
              {ADVANCE_LABEL[order.status]}
            </button>
          ) : (
            <div className="w-full text-center py-[13px] text-sm font-bold text-slate-500">{ADVANCE_LABEL[order.status]}</div>
          )}
        </div>
      </div>
    </div>
  );
}
