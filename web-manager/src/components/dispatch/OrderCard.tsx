'use client';

import { useState } from 'react';
import { Ban, Car, CheckCircle2, Clock, MapPin, Phone, Star, UserCog } from 'lucide-react';
import { Order, cancelOrder, completeOrder } from '@/lib/api';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { ORDER_STATUS_ACCENT, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatMoney, formatMoneyApprox, formatPhone, formatRating, formatRelative, shortId } from '@/lib/format';
import { AUTO_MATCH_WINDOW_MS, SearchProgress } from './SearchProgress';
import { useNow } from './useNow';

interface OrderCardProps {
  order: Order;
  onAssignDriver: (order: Order) => void;
  onOrderUpdated: (order: Order) => void;
  onOrderCancelled: (orderId: string) => void;
  /** Opens the read-only detail drawer. */
  onOpenDetails: (order: Order) => void;
  selected?: boolean;
}

export function OrderCard({
  order,
  onAssignDriver,
  onOrderUpdated,
  onOrderCancelled,
  onOpenDetails,
  selected = false,
}: OrderCardProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  // Elapsed time gates the manual override, but Date.now() must not be read
  // during render — it differs between server and client output.
  const now = useNow(5000);

  // While an order is inside its automatic-matching window, keep the manual
  // override hidden so dispatchers aren't tempted to shortcut the algorithm
  // on every order. Once the window has passed, MatchingService has either
  // found a driver or is about to give up, so an override stops competing
  // with a search that's still meaningfully in progress.
  const pastAutoMatchWindow =
    now != null && now - new Date(order.createdAt).getTime() > AUTO_MATCH_WINDOW_MS;

  const canAssign =
    !order.driver &&
    (order.status === 'created' || (order.status === 'searching' && pastAutoMatchWindow));
  const canReassign = ['accepted', 'arrived'].includes(order.status) && !!order.driver;
  const canCancel = ['created', 'searching', 'accepted', 'arrived'].includes(order.status);
  const canComplete = order.status === 'in_progress';
  const hasActions = canAssign || canReassign || canCancel || canComplete;

  const handleCancel = async () => {
    if (!confirm('Bu buyurtma bekor qilinsinmi?')) return;
    setIsCancelling(true);
    try {
      const updated = await cancelOrder(order.id, 'Cancelled by dispatcher');
      onOrderCancelled(updated.id);
    } catch (err) {
      console.error('Cancel failed:', err);
      alert('Buyurtmani bekor qilib boʻlmadi');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Buyurtma yakunlandi deb belgilansinmi?')) return;
    setIsCompleting(true);
    try {
      const updated = await completeOrder(order.id);
      onOrderUpdated(updated);
    } catch (err) {
      console.error('Complete failed:', err);
      alert('Buyurtmani yakunlab boʻlmadi');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Card
      padding="none"
      selected={selected}
      className="overflow-hidden cursor-pointer hover:border-line-strong transition-colors"
      onClick={() => onOpenDetails(order)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails(order);
        }
      }}
    >
      <div className={`h-0.5 w-full ${ORDER_STATUS_ACCENT[order.status]}`} />

      <div className="p-3.5 space-y-3">
        {/* Header: id, status, age */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-semibold text-muted">{shortId(order.id)}</span>
            <OrderStatusBadge status={order.status} size="sm" dot />
          </div>
          <span className="flex items-center gap-1 text-[11px] text-subtle shrink-0">
            <Clock size={11} />
            {formatRelative(order.createdAt)}
          </span>
        </div>

        {/* Passenger */}
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={order.passenger?.name} size="xs" tone="muted" />
          <span className="text-sm font-medium text-ink truncate">
            {order.passenger?.name ?? 'Mijoz'}
          </span>
          <span className="ml-auto flex items-center gap-1 text-[11px] font-mono text-muted shrink-0">
            <Phone size={11} />
            {formatPhone(order.passenger?.phone)}
          </span>
        </div>

        {/* Route */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-mint-deep shrink-0 ring-2 ring-mint/25" />
            <p className="text-xs text-muted leading-snug line-clamp-2">{order.pickupAddress ?? '—'}</p>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={13} className="text-danger mt-0.5 shrink-0" />
            <p className="text-xs text-muted leading-snug line-clamp-2">{order.dropoffAddress ?? '—'}</p>
          </div>
        </div>

        {/* Automatic search progress — only while the algorithm is working */}
        {order.status === 'searching' && !order.driver && (
          <SearchProgress createdAt={order.createdAt} />
        )}

        {/* Assigned driver */}
        {order.driver ? (
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 border border-line px-2.5 py-2">
            <Avatar name={order.driver.name} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink truncate">{order.driver.name}</p>
              <p className="text-[11px] font-mono text-subtle truncate">{order.driver.carNumber}</p>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-muted shrink-0">
              <Star size={11} className="text-primary" fill="currentColor" />
              {formatRating(order.driver.rating)}
            </span>
          </div>
        ) : (
          order.status !== 'searching' && (
            <div className="rounded-lg border border-dashed border-line px-2.5 py-2">
              <p className="text-[11px] text-subtle">Haydovchi hali tayinlanmagan</p>
            </div>
          )
        )}

        {/* Tariff + price */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-subtle min-w-0">
            <Car size={12} className="shrink-0" />
            <span className="truncate">{order.tariff?.name ?? '—'}</span>
            <span className="text-line-strong">·</span>
            <span className="shrink-0">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
          </span>
          <span className="font-mono font-semibold text-ink shrink-0">
            {order.finalPrice != null
              ? formatMoney(order.finalPrice)
              : formatMoneyApprox(order.estimatedPrice)}
          </span>
        </div>

        {/* Actions — deliberately quiet. Assignment is the algorithm's job;
            anything here is an exception, so nothing is a primary button. */}
        {hasActions && (
          <div
            className="flex flex-wrap gap-2 pt-0.5"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            {(canAssign || canReassign) && (
              <Button
                size="sm"
                variant="override"
                onClick={() => onAssignDriver(order)}
                leftIcon={<UserCog size={13} />}
                className="flex-1"
              >
                Qoʻlda aralashuv
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleComplete}
                isLoading={isCompleting}
                leftIcon={<CheckCircle2 size={13} />}
                className="flex-1"
              >
                Yakunlash
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="danger"
                onClick={handleCancel}
                isLoading={isCancelling}
                leftIcon={<Ban size={13} />}
                className={canAssign || canReassign || canComplete ? '' : 'flex-1'}
              >
                Bekor qilish
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
