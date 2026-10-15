import { MapPin, MessageSquareWarning, Phone } from 'lucide-react';
import type { FoodOrder } from '@/lib/api';
import { advanceLabelFor } from '@/lib/order-status';
import { formatPhone, formatTime, shortId } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { MoneyText } from '@/components/ui/MoneyText';
import { KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { customerNameOf, customerPhoneOf } from './OrderCard';

export function OrderDrawer({
  order,
  busy,
  onClose,
  onAdvance,
  onReject,
}: {
  order: FoodOrder | null;
  busy: boolean;
  onClose: () => void;
  onAdvance: () => void;
  onReject: () => void;
}) {
  if (!order) return null;
  const advanceLabel = advanceLabelFor(order);
  const phone = customerPhoneOf(order);

  return (
    <Drawer
      isOpen
      onClose={onClose}
      width="md"
      title={<>Buyurtma <span className="font-mono">{shortId(order.id)}</span></>}
      subtitle={
        <span className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} size="sm" />
          <span className="num text-xs text-muted">{formatTime(order.createdAt)}</span>
        </span>
      }
      footer={
        (order.status === 'new' || advanceLabel) && (
          <div className="flex w-full gap-2">
            {order.status === 'new' && (
              <Button variant="danger-ghost" size="lg" onClick={onReject}>
                Rad etish
              </Button>
            )}
            {advanceLabel && (
              <Button size="lg" className="flex-1" isLoading={busy} onClick={onAdvance}>
                {advanceLabel}
              </Button>
            )}
          </div>
        )
      }
    >
      <KeyValueList className="rounded-ds-sm border border-line px-3 py-2.5">
        <KeyValue label="Mijoz">
          <span className="font-semibold">{customerNameOf(order)}</span>
        </KeyValue>
        <KeyValue label="Telefon">
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="num inline-flex items-center gap-1.5 text-primary-text hover:underline underline-offset-4"
            >
              <Phone size={13} aria-hidden />
              {formatPhone(phone)}
            </a>
          ) : (
            '—'
          )}
        </KeyValue>
        <KeyValue label="Manzil">
          <span className="inline-flex items-start gap-1.5">
            <MapPin size={13} aria-hidden className="mt-0.5 shrink-0 text-subtle" />
            {order.deliveryAddress || '—'}
          </span>
        </KeyValue>
      </KeyValueList>

      {order.note && (
        <div className="rounded-ds-sm border border-override/40 bg-override-tint px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-override-dark dark:text-override-light">
            <MessageSquareWarning size={13} aria-hidden />
            Mijoz izohi
          </p>
          <p className="mt-0.5 text-body font-semibold text-ink">{order.note}</p>
        </div>
      )}

      {order.rejectReason && (
        <div className="rounded-ds-sm border border-danger/30 bg-danger-tint px-3 py-2.5">
          <p className="text-xs font-semibold text-danger-dark dark:text-danger-light">Rad etish sababi</p>
          <p className="mt-0.5 text-body text-ink">{order.rejectReason}</p>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-subtle">Tarkibi</h3>
        <ul className="mt-1 divide-y divide-line">
          {order.items.map((it, i) => (
            <li key={`${it.dishId}-${i}`} className="flex items-center gap-3 py-2.5 text-body">
              <span className="num w-8 shrink-0 font-semibold text-ink">{it.qty}×</span>
              <span className="flex-1 text-ink">{it.name}</span>
              <MoneyText value={it.qty * it.price} className="text-muted" />
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-body text-muted">
            Toʻlov: <span className="font-semibold text-ink">{order.paymentMethod === 'card' ? 'Karta' : 'Naqd'}</span>
          </span>
          <MoneyText value={order.totalPrice} className="text-h2 text-ink" />
        </div>
      </div>
    </Drawer>
  );
}
