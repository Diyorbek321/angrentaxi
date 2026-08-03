'use client';

import { MapPin, Package, Phone, Truck, Store as StoreIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { customerName, formatMoney, formatRelative, shortId } from '@/lib/format';
import { DELIVERY_MODE_SHORT } from '@/lib/orderStatus';
import type { MarketOrder } from '@/lib/api';

export function OrderCard({ order, onClick }: { order: MarketOrder; onClick: () => void }) {
  const isNew = order.status === 'new';
  const itemsCount = order.items.reduce((sum, i) => sum + i.qty, 0);
  const packedCount = order.items.filter((i) => i.packed).length;
  const phone = order.customerPhone ?? order.customer?.phone ?? null;
  const DeliveryIcon = order.deliveryMode === 'self' ? StoreIcon : Truck;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border bg-surface p-3 transition-colors',
        'hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        // An unanswered order wears the brand colour and a slow halo — the one
        // card on this board the vendor must not scroll past.
        isNew
          ? 'border-primary/45 shadow-glow-mint-sm animate-pulse-mint'
          : 'border-line shadow-card'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-muted">{shortId(order.id)}</span>
        <span className="text-[11px] text-subtle">{formatRelative(order.createdAt)}</span>
      </div>

      <p className="mt-1.5 text-sm font-semibold text-ink truncate">
        {customerName(order.customer)}
      </p>

      {phone && (
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted font-mono">
          <Phone size={11} className="shrink-0 text-subtle" />
          {phone}
        </p>
      )}

      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted line-clamp-2">
        <MapPin size={12} className="shrink-0 mt-0.5 text-subtle" />
        {order.deliveryAddress}
      </p>

      <div className="mt-2.5 pt-2.5 border-t border-line flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Package size={12} className="text-subtle" />
          <span className="font-mono tabular-nums">
            {order.status === 'packing' ? `${packedCount}/${order.items.length}` : itemsCount}
          </span>
          {order.status === 'packing' ? "yig'ildi" : 'dona'}
        </span>
        <span className="font-mono text-sm font-bold text-ink tabular-nums">
          {formatMoney(order.totalPrice)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-subtle">
        <DeliveryIcon size={11} />
        {DELIVERY_MODE_SHORT[order.deliveryMode]}
      </div>
    </button>
  );
}
