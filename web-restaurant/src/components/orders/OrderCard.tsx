import { Banknote, CreditCard, MapPin, MessageSquareWarning, Phone } from 'lucide-react';
import type { FoodOrder } from '@/lib/api';
import { advanceLabelFor } from '@/lib/order-status';
import { formatPhone, formatPrepTimer, formatTime, fullName, shortId } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/Button';
import { MoneyText } from '@/components/ui/MoneyText';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { VendorCashStrip } from '@/components/VendorCashStrip';
import type { VendorSettlementContext } from '@/lib/vendor-cash';
import { CourierStrip } from './CourierStrip';
import { AddressShortLine, CustomerCancelNotice, DiscountLines } from './OrderExtras';
import { PrepTimerChip } from './PrepTimerChip';
import { t } from '@/locales';

export interface OrderCardProps {
  order: FoodOrder;
  /** Oshxona ekrani: katta shrift va tegish maydonlari. */
  kiosk: boolean;
  now: number;
  busy: boolean;
  onOpen: () => void;
  onAdvance: () => void;
  onReject: () => void;
  onRedispatch: () => void;
  onCashDecision: (received: boolean) => void;
  /** Hisob-kitob rejimi + restoran komissiyasi (lib/vendor-cash.ts). */
  settlement?: VendorSettlementContext;
}

export function customerPhoneOf(order: FoodOrder): string | null {
  return order.customerPhone ?? order.customer?.phone ?? null;
}

export function customerNameOf(order: FoodOrder): string {
  return fullName(order.customer?.firstName, order.customer?.lastName, t().orders.card.customerFallback);
}

/**
 * Buyurtma kartasi oshxonaning savollariga BOSMASDAN javob beradi: raqam va
 * vaqt, taymer, mijoz, taomlar soni bilan, mijoz izohi (xatolarning №1
 * manbai — baland), summa, to'lov turi. Holat zinapoyasi — har doim kartaning
 * pastida turgan bitta oldinga tugma.
 */
export function OrderCard({
  order,
  kiosk,
  now,
  busy,
  onOpen,
  onAdvance,
  onReject,
  onRedispatch,
  onCashDecision,
  settlement,
}: OrderCardProps) {
  const m = t();
  const c = m.orders.card;
  const timer = formatPrepTimer(order, now);
  const advanceLabel = advanceLabelFor(order);
  const isNew = order.status === 'new';
  const isDone = order.status === 'delivered' || order.status === 'cancelled';
  const phone = customerPhoneOf(order);
  const no = shortId(order.id);

  return (
    <article
      aria-label={c.aria(order.id.slice(0, 6))}
      className={cn(
        'flex flex-col rounded-ds-md border bg-surface shadow-card',
        kiosk ? 'p-5' : 'p-4',
        // Yangi buyurtma ko'zga tashlanadi: info chegara + halqa — o'tkazib yuborib bo'lmaydi.
        isNew ? 'border-info/60 ring-1 ring-info/30' : 'border-line'
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              'rounded-ds-xs font-mono font-semibold text-ink transition-colors hover:text-primary-text',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              kiosk ? 'text-h1' : 'text-title'
            )}
          >
            {no}
            <span className="sr-only">{c.openDetails}</span>
          </button>
          <p className={cn('text-muted', kiosk ? 'text-body' : 'text-xs')}>
            {c.receivedBefore}
            <span className="num">{formatTime(order.createdAt)}</span>
            {c.receivedAfter}
          </p>
        </div>
        {timer && <PrepTimerChip timer={timer} large={kiosk} />}
        {isDone && <OrderStatusBadge status={order.status} size="sm" />}
      </header>

      <div className={cn('mt-3 flex flex-wrap items-center gap-x-3 gap-y-0.5', kiosk ? 'text-body-lg' : 'text-body')}>
        <span className="font-semibold text-ink">{customerNameOf(order)}</span>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="num inline-flex items-center gap-1 text-[13px] text-primary-text hover:underline underline-offset-4"
          >
            <Phone size={12} aria-hidden />
            {formatPhone(phone)}
          </a>
        )}
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
        <MapPin size={13} className="shrink-0" aria-hidden />
        <span className="truncate">{order.deliveryAddress || '—'}</span>
      </p>
      <AddressShortLine details={order.addressDetails} className="mt-0.5" />
      <CustomerCancelNotice order={order} className="mt-3" />

      {/* Taomlar ro'yxati — oshxona bosmasdan ko'radi. */}
      <ul className={cn('mt-3 flex flex-col gap-1 border-t border-line pt-3', kiosk ? 'text-h3 font-medium' : 'text-body')}>
        {order.items.map((it, i) => (
          <li key={`${it.dishId}-${i}`} className="flex items-baseline gap-2">
            <span className={cn('num shrink-0 font-semibold text-ink', kiosk ? 'w-12' : 'w-8')}>{it.qty}×</span>
            <span className="min-w-0 flex-1 text-ink">{it.name}</span>
          </li>
        ))}
      </ul>

      {order.note && (
        <div className="mt-3 rounded-ds-sm border border-override/40 bg-override-tint px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-override-dark dark:text-override-light">
            <MessageSquareWarning size={13} aria-hidden />
            {c.customerNote}
          </p>
          <p className={cn('mt-0.5 font-semibold text-ink', kiosk ? 'text-body-lg' : 'text-body')}>{order.note}</p>
        </div>
      )}

      {order.rejectReason && (
        <div className="mt-3 rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2.5">
          <p className="text-xs font-semibold text-danger-dark dark:text-danger-light">{c.rejectReason}</p>
          <p className="mt-0.5 text-body text-ink">{order.rejectReason}</p>
        </div>
      )}

      <DiscountLines order={order} className="mt-3 border-t border-line pt-3" />

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
          {order.paymentMethod === 'card' ? <CreditCard size={13} aria-hidden /> : <Banknote size={13} aria-hidden />}
          {order.paymentMethod === 'card' ? c.card : c.cash}
        </span>
        <MoneyText value={order.totalPrice} className={cn('font-semibold text-ink', kiosk ? 'text-h2' : 'text-title')} />
      </div>

      {order.status === 'ready' && (
        <CourierStrip order={order} large={kiosk} busy={busy} onRedispatch={onRedispatch} />
      )}

      {/* Naqd: kuryer tovar pulini toʻlaydi — sotuvchi tasdiqlaydi yoki nizo. */}
      {(order.status === 'ready' || order.status === 'delivered') && (
        <VendorCashStrip
          order={order}
          busy={busy}
          onDecide={onCashDecision}
          large={kiosk}
          settlement={settlement}
        />
      )}

      {/* Holat zinapoyasi: BITTA oldinga tugma, har doim kartaning pastida. */}
      {advanceLabel && (
        <div className="mt-4 flex gap-2">
          <Button
            size="kitchen"
            className={cn('flex-1', kiosk && 'min-h-[56px] text-h3')}
            isLoading={busy}
            onClick={onAdvance}
          >
            {advanceLabel}
          </Button>
          {isNew && (
            <Button
              size="kitchen"
              variant="danger-ghost"
              className={cn(kiosk && 'min-h-[56px] text-h3')}
              disabled={busy}
              onClick={onReject}
              aria-label={c.rejectAria(no)}
            >
              {c.reject}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
