'use client';

import { useState } from 'react';
import { Check, MapPin, Phone, StickyNote, Truck, Store as StoreIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  customerName,
  formatDateTime,
  formatMoney,
  formatPhone,
  shortId,
} from '@/lib/format';
import { advanceLabel, DELIVERY_MODE_LABEL } from '@/lib/orderStatus';
import { marketApi, type MarketOrder } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/ui/Toast';

export interface OrderDetailModalProps {
  order: MarketOrder;
  onClose: () => void;
  /** Hands the server's updated order back so the board stays in sync. */
  onUpdated: (order: MarketOrder) => void;
}

export function OrderDetailModal({ order, onClose, onUpdated }: OrderDetailModalProps) {
  const { toast } = useToast();
  const [packingIndex, setPackingIndex] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const packedCount = order.items.filter((i) => i.packed).length;
  const nextLabel = advanceLabel(order.status);
  const phone = order.customerPhone ?? order.customer?.phone ?? null;
  const DeliveryIcon = order.deliveryMode === 'self' ? StoreIcon : Truck;

  const togglePack = async (index: number) => {
    setPackingIndex(index);
    try {
      const res = await marketApi.togglePackItem(order.id, index);
      onUpdated(res.data.data);
    } catch {
      toast({
        title: 'Belgilab bo‘lmadi',
        description: 'Qayta urinib ko‘ring.',
        variant: 'error',
      });
    } finally {
      setPackingIndex(null);
    }
  };

  const advance = async () => {
    setAdvancing(true);
    try {
      const res = await marketApi.advanceOrder(order.id);
      onUpdated(res.data.data);
      toast({ title: 'Buyurtma holati yangilandi', variant: 'success' });
      onClose();
    } catch {
      toast({
        title: 'Holatni o‘zgartirib bo‘lmadi',
        description: 'Qayta urinib ko‘ring.',
        variant: 'error',
      });
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      title={`Buyurtma ${shortId(order.id)}`}
      subtitle={formatDateTime(order.createdAt)}
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <div className="text-sm">
            <span className="text-muted">Jami: </span>
            <span className="font-mono font-bold text-ink tabular-nums">
              {formatMoney(order.totalPrice)}
            </span>
          </div>
          {/* One primary action. The backend only moves an order one step at a
              time, so there is never a second forward button to offer. */}
          {nextLabel ? (
            <Button onClick={advance} isLoading={advancing}>
              {nextLabel}
            </Button>
          ) : (
            <span className="text-sm text-muted">Bu buyurtma yakunlangan</span>
          )}
        </div>
      }
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <StatusBadge status={order.status} dot />
        <span className="text-xs text-muted font-mono tabular-nums">
          Yig‘ildi: {packedCount}/{order.items.length}
        </span>
      </div>

      {/* Customer */}
      <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 space-y-2">
        <p className="text-sm font-semibold text-ink">{customerName(order.customer)}</p>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-2 text-sm font-mono text-primary-700 dark:text-primary-300 hover:underline"
          >
            <Phone size={13} />
            {formatPhone(phone)}
          </a>
        )}
        <p className="flex items-start gap-2 text-sm text-muted">
          <MapPin size={13} className="shrink-0 mt-0.5 text-subtle" />
          {order.deliveryAddress}
        </p>
        <p className="flex items-center gap-2 text-xs text-muted">
          <DeliveryIcon size={13} className="text-subtle" />
          {DELIVERY_MODE_LABEL[order.deliveryMode]}
        </p>
      </div>

      {order.note && (
        <div className="mt-3 rounded-xl border border-warn/30 bg-warn/[0.08] p-3.5 flex items-start gap-2.5">
          <StickyNote size={15} className="shrink-0 mt-0.5 text-warn-dark dark:text-warn-light" />
          <div>
            <p className="text-xs font-semibold text-warn-dark dark:text-warn-light">
              Mijoz izohi
            </p>
            <p className="text-sm text-ink mt-0.5 leading-relaxed">{order.note}</p>
          </div>
        </div>
      )}

      {/* Pack list */}
      <p className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
        Yig‘ish ro‘yxati
      </p>
      <ul className="rounded-xl border border-line divide-y divide-line overflow-hidden">
        {order.items.map((item, index) => (
          <li key={`${item.productId}-${index}`}>
            <button
              type="button"
              onClick={() => togglePack(index)}
              disabled={packingIndex === index}
              aria-pressed={item.packed}
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors',
                'hover:bg-surface-2 disabled:opacity-60 disabled:cursor-wait',
                item.packed && 'bg-primary/[0.05]'
              )}
            >
              <span
                className={cn(
                  'h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors',
                  item.packed
                    ? 'bg-primary border-primary text-[#04231A]'
                    : 'border-line-strong bg-surface'
                )}
              >
                {item.packed && <Check size={12} strokeWidth={3.5} />}
              </span>

              <span className="flex-1 min-w-0">
                <span
                  className={cn(
                    'block text-sm font-medium truncate',
                    item.packed ? 'text-muted line-through' : 'text-ink'
                  )}
                >
                  {item.name}
                </span>
                <span className="block text-xs text-subtle font-mono tabular-nums mt-0.5">
                  {formatMoney(item.price)} × {item.qty}
                </span>
              </span>

              <span className="shrink-0 font-mono text-sm font-semibold text-ink tabular-nums">
                {formatMoney(item.price * item.qty)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
