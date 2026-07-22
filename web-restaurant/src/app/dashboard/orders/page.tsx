'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, Maximize2, MapPin, Phone, User, X } from 'lucide-react';
import { foodApi, FoodOrder, FoodOrderStatus } from '@/lib/api';
import { money } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { useKiosk } from '@/lib/kiosk-context';

const COLUMNS: Array<{ key: FoodOrderStatus; title: string; color: string }> = [
  { key: 'new', title: 'Yangi', color: '#60A5FA' },
  { key: 'preparing', title: 'Tayyorlanmoqda', color: '#FB923C' },
  { key: 'ready', title: "Tayyor / Kuryer kutilmoqda", color: '#10B981' },
  { key: 'delivered', title: 'Yetkazildi', color: '#64748B' },
];

const NEXT: Record<string, FoodOrderStatus | undefined> = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};

const ADVANCE_LABEL: Record<string, string> = {
  new: "Qabul qilib tayyorlashga o'tkazish",
  preparing: 'Tayyor deb belgilash',
  ready: 'Yetkazildi deb belgilash',
};

const REJECT_REASONS = [
  'Ingredientlar tugagan',
  'Oshxona band',
  'Ish vaqti tugadi',
  'Manzil yetkazib berish zonasidan tashqarida',
  'Boshqa sabab',
];

function slaInfo(order: FoodOrder): { text: string; color: string } | null {
  if (order.status !== 'new' && order.status !== 'preparing') return null;
  const prepSeconds = Math.max(...order.items.map((i) => i.prepMinutes), 1) * 60;
  const elapsed = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
  const remaining = Math.max(0, Math.round(prepSeconds - elapsed));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const color = remaining <= 120 ? '#F87171' : remaining <= 300 ? '#FB923C' : '#10B981';
  return { text: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, color };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const { kiosk, setKiosk } = useKiosk();

  const load = async () => {
    const res = await foodApi.getOrders();
    setOrders(res.data.data);
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const columns = useMemo(
    () =>
      COLUMNS.map((c) => ({
        ...c,
        orders: orders.filter((o) => o.status === c.key),
      })),
    [orders]
  );

  const accept = async (id: string) => {
    await foodApi.acceptOrder(id);
    await load();
  };

  const advance = async (id: string) => {
    await foodApi.advanceOrder(id);
    await load();
  };

  const handleDrop = async (id: string, targetStatus: FoodOrderStatus) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    if (order.status === 'new' && targetStatus === 'preparing') return accept(id);
    if (NEXT[order.status] === targetStatus) return advance(id);
    // Dropping backwards or skipping a stage isn't a valid kitchen transition.
  };

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;

  return (
    <div className="h-full flex flex-col">
      {!kiosk && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setKiosk(true)}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-slate-300 rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold hover:bg-white/10"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Kiosk mode
          </button>
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-2 flex-1 items-start">
        {columns.map((col) => (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) handleDrop(id, col.key);
            }}
            className="flex-shrink-0 w-[300px] bg-[#0D1526] border border-white/[0.06] rounded-2xl p-3.5 flex flex-col gap-2.5 max-h-full"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-[9px] h-[9px] rounded-full" style={{ background: col.color, boxShadow: `0 0 8px ${col.color}` }} />
              <span className="text-[13.5px] font-bold flex-1">{col.title}</span>
              <span className="font-mono text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{col.orders.length}</span>
            </div>
            <div className="flex flex-col gap-2.5 overflow-y-auto">
              {col.orders.length === 0 && (
                <div className="py-6 px-3 text-center text-slate-600 text-[12.5px] border-[1.5px] border-dashed border-white/[0.08] rounded-xl">
                  Bo&apos;sh
                </div>
              )}
              {col.orders.map((order) => {
                const sla = slaInfo(order);
                const itemsCount = order.items.reduce((s, i) => s + i.qty, 0);
                return (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', order.id)}
                    onClick={() => setOpenOrderId(order.id)}
                    className="bg-[#111827] border border-white/[0.08] rounded-[14px] p-3.5 cursor-pointer hover:border-brand-yellow/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">
                        <span className="text-slate-500">#</span>
                        {order.id.slice(0, 6)}
                      </span>
                      {sla && (
                        <span className="font-mono text-xs font-bold inline-flex items-center gap-1" style={{ color: sla.color }}>
                          <Clock className="h-3.5 w-3.5" />
                          {sla.text}
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] font-semibold mt-2">
                      {[order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || order.customerPhone}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{order.deliveryAddress}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[0.06]">
                      <span className="text-xs text-slate-400">{itemsCount} ta taom</span>
                      <span className="font-mono text-sm font-bold text-brand-yellow">{money(order.totalPrice)}</span>
                    </div>
                    {order.status === 'new' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            accept(order.id);
                          }}
                          className="flex-1 bg-green-500 text-green-950 rounded-[9px] py-2 text-[12.5px] font-bold"
                        >
                          Qabul qilish
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRejectId(order.id);
                          }}
                          className="bg-red-400/[0.12] text-red-400 border border-red-400/30 rounded-[9px] px-3 py-2 text-[12.5px] font-bold"
                        >
                          Rad
                        </button>
                      </div>
                    )}
                    {(order.status === 'preparing' || order.status === 'ready') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          advance(order.id);
                        }}
                        className="w-full mt-3 bg-brand-yellow text-brand-black rounded-[9px] py-2.5 text-[12.5px] font-bold"
                      >
                        {ADVANCE_LABEL[order.status]}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {openOrder && (
        <OrderDrawer
          order={openOrder}
          onClose={() => setOpenOrderId(null)}
          onAccept={() => accept(openOrder.id)}
          onAdvance={() => advance(openOrder.id)}
          onReject={() => {
            setRejectId(openOrder.id);
            setOpenOrderId(null);
          }}
        />
      )}

      {rejectId && (
        <RejectModal
          onCancel={() => setRejectId(null)}
          onConfirm={async (reason) => {
            await foodApi.rejectOrder(rejectId, reason);
            setRejectId(null);
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
  onAccept,
  onAdvance,
  onReject,
}: {
  order: FoodOrder;
  onClose: () => void;
  onAccept: () => void;
  onAdvance: () => void;
  onReject: () => void;
}) {
  const next = NEXT[order.status];
  return (
    <div className="fixed inset-0 z-[70]">
      <div onClick={onClose} className="absolute inset-0 bg-black/55 animate-fade-in" />
      <aside className="absolute top-0 right-0 bottom-0 w-[420px] max-w-[92vw] bg-brand-dark border-l border-white/[0.08] flex flex-col animate-slideIn">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
          <div>
            <div className="font-mono text-lg font-bold">
              <span className="text-slate-500">#</span>
              {order.id.slice(0, 6)}
            </div>
            <div className="mt-1.5">
              <StatusBadge status={order.status} />
            </div>
          </div>
          <button onClick={onClose} className="w-[38px] h-[38px] rounded-[10px] border border-white/[0.08] text-slate-400 flex items-center justify-center">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5 text-slate-400 text-[13px]">
              <User className="h-4 w-4" />
              <span className="text-slate-200 font-semibold">
                {[order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || 'Mijoz'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-400 text-[13px]">
              <Phone className="h-4 w-4" />
              <span className="font-mono">{order.customerPhone ?? order.customer?.phone}</span>
            </div>
            <div className="flex items-start gap-2.5 text-slate-400 text-[13px]">
              <MapPin className="h-4 w-4 mt-0.5" />
              <span>{order.deliveryAddress}</span>
            </div>
          </div>

          {order.note && (
            <div className="bg-orange-400/10 border border-orange-400/30 rounded-xl p-3.5 flex gap-2.5">
              <div className="text-[11px] font-bold text-orange-400 uppercase tracking-wide">Maxsus izoh</div>
              <div className="text-[13px]">{order.note}</div>
            </div>
          )}

          {order.rejectReason && (
            <div className="bg-red-400/10 border border-red-400/30 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Rad etilgan sabab</div>
              <div className="text-[13px] mt-1">{order.rejectReason}</div>
            </div>
          )}

          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Tarkibi</div>
            <div className="flex flex-col gap-0.5">
              {order.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2.5 py-2.5 border-b border-white/[0.05]">
                  <span className="font-mono text-sm font-bold text-brand-yellow w-8">{it.qty}</span>
                  <span className="flex-1 text-sm">{it.name}</span>
                  <span className="font-mono text-[13px] text-slate-400">{money(it.qty * it.price)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3.5">
              <span className="text-[13px] text-slate-400">
                To&apos;lov: <span className="text-slate-200 font-semibold">{order.paymentMethod === 'card' ? 'Karta' : 'Naqd'}</span>
              </span>
              <span className="font-mono text-lg font-bold text-brand-yellow">{money(order.totalPrice)}</span>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-white/[0.07] flex gap-2.5">
          {order.status === 'new' && (
            <button onClick={onReject} className="flex-shrink-0 bg-red-400/[0.12] text-red-400 border border-red-400/30 rounded-xl px-4 py-3 text-sm font-bold">
              Rad etish
            </button>
          )}
          {next && (
            <button
              onClick={order.status === 'new' ? onAccept : onAdvance}
              className="flex-1 bg-brand-yellow text-brand-black rounded-xl py-3 text-sm font-bold hover:bg-yellow-300"
            >
              {ADVANCE_LABEL[order.status]}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function RejectModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5">
      <div onClick={onCancel} className="absolute inset-0 bg-black/65 animate-fade-in" />
      <div className="relative w-[420px] max-w-full bg-brand-dark border border-white/[0.09] rounded-2xl p-6">
        <h3 className="text-[17px] font-extrabold mb-1.5">Buyurtmani rad etish</h3>
        <p className="text-[13px] text-slate-400 mb-4.5">Rad etish sababini tanlang. Mijozga xabar yuboriladi.</p>
        <div className="flex flex-col gap-2 mb-5">
          {REJECT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`text-left px-3.5 py-3 rounded-xl text-[13.5px] font-semibold border ${
                reason === r ? 'border-red-400/50 text-red-400 bg-red-400/5' : 'border-white/[0.07] text-slate-300 bg-white/[0.03]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2.5">
          <button onClick={onCancel} className="flex-1 border border-white/[0.12] text-slate-400 rounded-xl py-3 text-sm font-bold">
            Bekor qilish
          </button>
          <button
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason}
            className="flex-1 bg-red-400 text-red-950 rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          >
            Rad etish
          </button>
        </div>
      </div>
    </div>
  );
}
