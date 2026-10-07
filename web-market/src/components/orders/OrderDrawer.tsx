'use client';

import { useState } from 'react';
import { Check, MapPin, MessageSquareText, Phone, Truck } from 'lucide-react';
import { clsx } from 'clsx';
import { marketApi, MarketOrder } from '@/lib/api';
import {
  ADVANCE_LABEL,
  DELIVERY_MODE_LABEL,
  TERMINAL_LABEL,
  orderCustomerName,
  orderCustomerPhone,
} from '@/lib/order-status';
import { errorMessage, formatRelative, formatTime, money } from '@/lib/utils';
import { courierState, CourierTone } from '@/lib/courier';
import { StatusBadge } from '@/components/StatusBadge';
import { VendorCashStrip } from '@/components/VendorCashStrip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';

export interface OrderDrawerProps {
  order: MarketOrder | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}

/**
 * Buyurtma detali — sotuvchining hamma savoliga bitta ekranda javob:
 * nima, nechta, kimga, qayerga, kim yetkazadi, mijoz nima dedi.
 * Holat faqat BITTA oldinga tugma bilan o'zgaradi (zinapoya, sakrash yo'q).
 */
export function OrderDrawer({ order, onClose, onChanged, onError }: OrderDrawerProps) {
  const [busy, setBusy] = useState(false);
  const [togglingIndex, setTogglingIndex] = useState<number | null>(null);

  if (!order) return null;

  const packedCount = order.items.filter((i) => i.packed).length;
  const advanceLabel = ADVANCE_LABEL[order.status];
  const phone = orderCustomerPhone(order);

  const togglePack = async (index: number) => {
    setTogglingIndex(index);
    try {
      await marketApi.togglePackItem(order.id, index);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setTogglingIndex(null);
    }
  };

  const redispatch = async () => {
    setBusy(true);
    try {
      await marketApi.redispatchOrder(order.id);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const decideCash = async (received: boolean) => {
    setBusy(true);
    try {
      await marketApi.cashReceived(order.id, received);
      await onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
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
      title={`Buyurtma #${order.id.slice(0, 6)}`}
      subtitle={`${orderCustomerName(order)} · ${formatRelative(order.createdAt)} (${formatTime(order.createdAt)})`}
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold text-muted">Jami summa</span>
            <span className="font-mono text-h3 tabular-nums text-ink">
              {money(order.totalPrice)}
            </span>
          </div>
          {advanceLabel ? (
            <Button className="w-full" size="lg" isLoading={busy} onClick={() => void advance()}>
              {advanceLabel}
            </Button>
          ) : (
            <p className="py-2 text-center text-body font-semibold text-muted">
              {TERMINAL_LABEL[order.status]}
            </p>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {/* Yetkazish rejimi — haqiqiy sozlama (`deliveryMode`): kim
              yetkazishini karta o'zi aytadi, taxmin qoldirmaydi. */}
          <Badge variant="default" size="sm">
            <Truck size={11} aria-hidden className="shrink-0" />
            {DELIVERY_MODE_LABEL[order.deliveryMode]}
          </Badge>
        </div>
        <span className="font-mono text-caption tabular-nums font-semibold text-muted">
          Yig&apos;ildi: {packedCount}/{order.items.length}
        </span>
      </div>

      {order.status === 'shipped' && order.deliveryMode === 'platform' && (
        <CourierStrip order={order} busy={busy} onRedispatch={() => void redispatch()} />
      )}

      {/* Naqd + platforma kuryeri: kuryer tovar pulini do'konga to'laydi. */}
      {order.deliveryMode === 'platform' &&
        (order.status === 'shipped' || order.status === 'delivered') && (
          <VendorCashStrip order={order} busy={busy} onDecide={(r) => void decideCash(r)} />
        )}

      {/* Mijoz izohi — xatolarning 1-manbai, shuning uchun ro'yxatdan OLDIN
          va ko'zga tashlanadigan blokda. */}
      {order.note && (
        <div className="rounded-ds-sm border border-info/40 bg-info-tint p-3">
          <p className="flex items-center gap-1.5 text-micro uppercase text-info-deep dark:text-info-light">
            <MessageSquareText size={12} aria-hidden />
            Mijoz izohi
          </p>
          <p className="mt-1 text-body font-semibold text-ink">{order.note}</p>
        </div>
      )}

      <div className="space-y-2">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-3 rounded-ds-sm border border-line bg-surface-2/60 p-3 transition-colors duration-fast hover:bg-surface-2"
          >
            <Phone size={15} aria-hidden className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block text-micro uppercase text-muted">Mijoz telefoni</span>
              <span className="mt-0.5 block font-mono text-body font-bold text-primary-text">
                {phone}
              </span>
            </span>
          </a>
        )}
        {order.deliveryAddress && (
          <div className="flex items-start gap-3 rounded-ds-sm border border-line bg-surface-2/60 p-3">
            <MapPin size={15} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-micro uppercase text-muted">Yetkazish manzili</p>
              <p className="mt-0.5 text-body text-ink">{order.deliveryAddress}</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-micro uppercase text-muted">
          Yig&apos;ish ro&apos;yxati — {order.items.length} ta mahsulot
        </p>
        <ul className="space-y-1">
          {order.items.map((it, index) => (
            <li key={`${it.productId}-${index}`}>
              <button
                type="button"
                onClick={() => void togglePack(index)}
                aria-pressed={it.packed}
                disabled={togglingIndex !== null}
                className="flex w-full items-center gap-3 rounded-ds-sm px-2.5 py-2.5 text-left transition-colors duration-fast hover:bg-surface-2 disabled:cursor-wait"
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
                <span className="min-w-0 flex-1">
                  <span
                    className={clsx(
                      'block truncate text-body font-semibold',
                      it.packed ? 'text-muted line-through' : 'text-ink'
                    )}
                  >
                    {it.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-caption tabular-nums text-subtle">
                    {money(it.price)} × {it.qty}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-body tabular-nums font-bold text-ink">
                  {money(it.price * it.qty)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  );
}

const courierToneClasses: Record<CourierTone, string> = {
  waiting: 'border-info/40 bg-info-tint text-info-deep dark:text-info-light',
  active: 'border-mint-deep/40 bg-mint-tint text-primary-text',
  done: 'border-line bg-surface-2 text-muted',
  failed: 'border-danger/40 bg-danger-tint text-danger-deep dark:text-danger-light',
};

/**
 * Platforma kuryeri. "Kuryer topilmadi" qizil va tugma bilan: sotuvchi
 * boshqa oynani qidirmasdan shu yerdan qayta chaqiradi.
 */
function CourierStrip({
  order,
  busy,
  onRedispatch,
}: {
  order: MarketOrder;
  busy: boolean;
  onRedispatch: () => void;
}) {
  const state = courierState(order.delivery);
  const driver = order.delivery?.driverName;
  const driverPhone = order.delivery?.driverPhone;

  return (
    <div role="status" className={clsx('rounded-ds-sm border p-3', courierToneClasses[state.tone])}>
      <p className="flex items-center gap-1.5 text-body font-semibold">
        <Truck size={14} aria-hidden />
        {state.label}
      </p>
      {state.tone === 'active' && (driver || driverPhone) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-caption text-ink">
          {driver && <span>{driver}</span>}
          {driverPhone && (
            <a href={`tel:${driverPhone}`} className="inline-flex items-center gap-1 font-mono hover:underline">
              <Phone size={12} aria-hidden />
              {driverPhone}
            </a>
          )}
        </p>
      )}
      {state.canRedispatch && (
        <Button variant="secondary" className="mt-2 w-full" isLoading={busy} onClick={onRedispatch}>
          Kuryerni qayta chaqirish
        </Button>
      )}
    </div>
  );
}
