'use client';

import { useMemo, useState } from 'react';
import { Check, ClipboardList, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, MarketOrder, MarketOrderStatus } from '@/lib/api';
import { money, formatTime, errorMessage } from '@/lib/utils';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Tabs, type TabItem } from '@/components/ui/Tabs';

type TabKey = 'all' | MarketOrderStatus;

const TAB_LABELS: Array<{ value: TabKey; label: string }> = [
  { value: 'all', label: 'Barchasi' },
  { value: 'new', label: 'Yangi' },
  { value: 'packing', label: "Yig'ilmoqda" },
  { value: 'shipped', label: 'Yuborildi' },
  { value: 'delivered', label: 'Yetkazildi' },
  { value: 'cancelled', label: 'Bekor' },
];

const ADVANCE_LABEL: Record<MarketOrderStatus, string> = {
  new: "Yig'ishni boshlash",
  packing: 'Yuborildi deb belgilash',
  shipped: 'Yetkazildi deb belgilash',
  delivered: 'Yakunlangan',
  cancelled: 'Bekor qilingan',
};

const ROW_GRID = 'grid grid-cols-[36px_84px_minmax(0,1fr)_120px_130px_140px] gap-3 items-center';

function orderName(o: MarketOrder): string {
  const name = [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ').trim();
  return name || o.customerPhone || 'Mijoz';
}

export default function OrdersPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isRefreshing, error, reload } = useAsyncData<MarketOrder[]>(async () => {
    const res = await marketApi.getOrders();
    return res.data.data;
  });

  const orders = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(
    () => (tab === 'all' ? orders : orders.filter((o) => o.status === tab)),
    [orders, tab]
  );

  const tabs: readonly TabItem<TabKey>[] = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return TAB_LABELS.map((t) => ({ ...t, count: counts[t.value] ?? 0 }));
  }, [orders]);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const selectedCount = selectedIds.length;
  const allSelected = filtered.length > 0 && filtered.every((o) => selected[o.id]);

  const toggleAll = () => {
    const next = { ...selected };
    filtered.forEach((o) => (next[o.id] = !allSelected));
    setSelected(next);
  };

  const bulkPack = async () => {
    setBusy(true);
    try {
      // Only `new` orders can be advanced into packing; anything else in the
      // selection is skipped rather than pushed a stage further by accident.
      const targets = selectedIds
        .map((id) => orders.find((o) => o.id === id))
        .filter((o): o is MarketOrder => !!o && o.status === 'new');
      await Promise.all(targets.map((o) => marketApi.advanceOrder(o.id)));
      setSelected({});
      await reload();
      toast({ title: `${targets.length} ta buyurtma yangilandi`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Xatolik', description: errorMessage(err), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;

  return (
    <div>
      <PageHeader
        title="Buyurtmalar"
        description="Yangi va faol buyurtmalarni boshqaring"
        icon={<ClipboardList size={18} aria-hidden />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void reload()}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={13} aria-hidden />}
          >
            Yangilash
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs items={tabs} value={tab} onChange={setTab} size="sm" />
        {selectedCount > 0 && (
          <Button
            size="sm"
            className="ml-auto"
            isLoading={busy}
            onClick={() => void bulkPack()}
            leftIcon={<Check size={14} aria-hidden />}
          >
            {selectedCount} ta yig&apos;ildi deb belgilash
          </Button>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : error && orders.length === 0 ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Bu holatda buyurtma yo'q"
            description="Boshqa holatni tanlang yoki yangi buyurtma kelishini kuting."
          />
        </Card>
      ) : (
        <>
          {/* Desktop: dense table. */}
          <Card padding="none" className="hidden overflow-hidden lg:block">
            <div
              className={clsx(
                ROW_GRID,
                'border-b border-line bg-surface-2/60 px-4 py-2.5 text-micro uppercase text-muted'
              )}
            >
              <span>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Hammasini tanlash"
                  className="h-4 w-4 accent-brand"
                />
              </span>
              <span>Buyurtma</span>
              <span>Mijoz</span>
              <span>Mahsulot</span>
              <span>Summa</span>
              <span>Holat</span>
            </div>
            <ul className="divide-y divide-divider">
              {filtered.map((o) => (
                <li
                  key={o.id}
                  className={clsx(
                    ROW_GRID,
                    'px-4 py-3 transition-colors duration-fast hover:bg-surface-2/50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!!selected[o.id]}
                    onChange={() => setSelected((s) => ({ ...s, [o.id]: !s[o.id] }))}
                    aria-label={`${o.id.slice(0, 6)} buyurtmasini tanlash`}
                    className="h-4 w-4 accent-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setOpenOrderId(o.id)}
                    className="text-left font-mono text-caption font-bold text-primary-text hover:underline"
                  >
                    {o.id.slice(0, 6)}
                  </button>
                  <span className="truncate text-body font-semibold text-ink">{orderName(o)}</span>
                  <span className="text-caption text-muted">
                    {o.items.reduce((s, i) => s + i.qty, 0)} ta · {formatTime(o.createdAt)}
                  </span>
                  <span className="font-mono text-body font-bold text-ink">{money(o.totalPrice)}</span>
                  <span>
                    <StatusBadge status={o.status} size="sm" />
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Mobile: the same rows as cards — a 6-column grid is unusable here. */}
          <ul className="space-y-2.5 lg:hidden">
            {filtered.map((o) => (
              <li key={o.id}>
                <Card padding="none" className="overflow-hidden">
                  {/* A real button, not a clickable div — the row has to be
                      reachable and activatable from the keyboard. */}
                  <button
                    type="button"
                    onClick={() => setOpenOrderId(o.id)}
                    className="w-full p-3 text-left transition-colors duration-fast hover:bg-surface-2/60"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-body font-semibold text-ink">
                          {orderName(o)}
                        </span>
                        <span className="mt-0.5 block font-mono text-caption text-muted">
                          #{o.id.slice(0, 6)} · {formatTime(o.createdAt)}
                        </span>
                      </span>
                      <StatusBadge status={o.status} size="sm" />
                    </span>
                    <span className="mt-2.5 flex items-center justify-between gap-3">
                      <span className="text-caption text-muted">
                        {o.items.reduce((s, i) => s + i.qty, 0)} ta mahsulot
                      </span>
                      <span className="font-mono text-body font-bold text-ink">
                        {money(o.totalPrice)}
                      </span>
                    </span>
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <OrderDrawer
        order={openOrder}
        onClose={() => setOpenOrderId(null)}
        onChanged={reload}
        onError={(msg) => toast({ title: 'Xatolik', description: msg, variant: 'error' })}
      />
    </div>
  );
}

function OrderDrawer({
  order,
  onClose,
  onChanged,
  onError,
}: {
  order: MarketOrder | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!order) return null;

  const packedCount = order.items.filter((i) => i.packed).length;
  const canAdvance =
    order.status === 'new' || order.status === 'packing' || order.status === 'shipped';

  const togglePack = async (index: number) => {
    try {
      await marketApi.togglePackItem(order.id, index);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err));
    }
  };

  const advance = async () => {
    setBusy(true);
    try {
      await marketApi.advanceOrder(order.id);
      await onChanged();
      onClose();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={`Buyurtma ${order.id.slice(0, 6)}`}
      subtitle={`${orderName(order)} · ${formatTime(order.createdAt)}`}
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold text-muted">Jami summa</span>
            <span className="font-mono text-h3 text-ink">{money(order.totalPrice)}</span>
          </div>
          {canAdvance ? (
            <Button className="w-full" size="lg" isLoading={busy} onClick={() => void advance()}>
              {ADVANCE_LABEL[order.status]}
            </Button>
          ) : (
            <p className="py-2 text-center text-body font-semibold text-muted">
              {ADVANCE_LABEL[order.status]}
            </p>
          )}
        </div>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={order.status} />
        <span className="text-caption font-semibold text-muted">
          Yig&apos;ildi: {packedCount}/{order.items.length}
        </span>
      </div>

      {order.deliveryAddress && (
        <div className="rounded-ds-sm border border-line bg-surface-2/60 p-3">
          <p className="text-micro uppercase text-muted">Yetkazish manzili</p>
          <p className="mt-1 text-body text-ink">{order.deliveryAddress}</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-micro uppercase text-muted">Yig&apos;ish ro&apos;yxati</p>
        <ul className="space-y-1">
          {order.items.map((it, index) => (
            <li key={`${it.productId}-${index}`}>
              <button
                type="button"
                onClick={() => void togglePack(index)}
                aria-pressed={it.packed}
                className="flex w-full items-center gap-3 rounded-ds-sm px-2.5 py-2.5 text-left transition-colors duration-fast hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className={clsx(
                    'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-ds-xs border-2',
                    it.packed ? 'border-primary bg-primary text-white' : 'border-line-strong'
                  )}
                >
                  {it.packed && <Check size={13} strokeWidth={3.2} />}
                </span>
                <span
                  className={clsx(
                    'min-w-0 flex-1 truncate text-body font-semibold',
                    it.packed ? 'text-muted line-through' : 'text-ink'
                  )}
                >
                  {it.name}
                </span>
                <span className="shrink-0 font-mono text-caption font-bold text-muted">
                  ×{it.qty}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  );
}
