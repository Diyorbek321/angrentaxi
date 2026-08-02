'use client';

import { useEffect, useState } from 'react';
import {
  Car,
  Clock,
  Eye,
  History,
  MapPin,
  Phone,
  Receipt,
  Star,
  User,
} from 'lucide-react';
import { getOrders, Order } from '@/lib/api';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import {
  formatDateTime,
  formatMoney,
  formatMoneyApprox,
  formatPhone,
  formatRating,
  formatRelative,
  shortId,
} from '@/lib/format';

const HISTORY_LIMIT = 5;

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle mb-2">
        <span className="text-muted">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

/** Passenger's recent orders, so the operator has context before calling. */
function PassengerHistory({ order }: { order: Order }) {
  const [history, setHistory] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const phone = order.passenger?.phone;
    if (!phone) {
      setHistory([]);
      return;
    }

    setHistory(null);
    setFailed(false);

    getOrders({ search: phone, limit: HISTORY_LIMIT + 1, page: 1 })
      .then((res) => {
        if (cancelled) return;
        setHistory(res.data.filter((o) => o.id !== order.id).slice(0, HISTORY_LIMIT));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [order.id, order.passenger?.phone]);

  if (failed) {
    return <p className="text-xs text-subtle">Mijoz tarixini yuklab boʻlmadi.</p>;
  }

  if (history == null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return <p className="text-xs text-subtle">Bu mijozning boshqa buyurtmasi topilmadi.</p>;
  }

  return (
    <ul className="divide-y divide-line rounded-lg border border-line overflow-hidden">
      {history.map((h) => (
        <li key={h.id} className="flex items-center gap-2 px-3 py-2 bg-surface">
          <span className="font-mono text-[11px] text-muted shrink-0">{shortId(h.id)}</span>
          <OrderStatusBadge status={h.status} size="sm" />
          <span className="ml-auto text-[11px] text-subtle shrink-0">
            {formatDateTime(h.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Read-only by design. Inspecting an order must never turn into a way to
 * assign a driver — manual assignment lives behind the deliberate amber
 * override flow only (Exceptions, or the explicit button on a card).
 */
export function OrderDetailDrawer({ order, isOpen, onClose }: OrderDetailDrawerProps) {
  if (!order) return null;

  const t = order.tariff;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      width="lg"
      title={`Buyurtma ${shortId(order.id)}`}
      subtitle={
        <span className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} size="sm" dot />
          <span className="text-subtle">{formatRelative(order.createdAt)}</span>
        </span>
      }
    >
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
        <Eye size={14} className="text-muted shrink-0" />
        <p className="text-xs text-muted leading-snug">
          Faqat koʻrish uchun. Haydovchi tayinlash tizim tomonidan avtomatik bajariladi —
          aralashuv faqat Istisnolar boʻlimidan yoki kartadagi «Qoʻlda aralashuv» tugmasidan.
        </p>
      </div>

      <Section icon={<User size={12} />} title="Mijoz">
        <div className="rounded-lg border border-line bg-surface px-3 py-2.5 flex items-center gap-3">
          <Avatar name={order.passenger?.name} size="md" tone="muted" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">
              {order.passenger?.name ?? 'Mijoz'}
            </p>
            <p className="font-mono text-xs text-muted">{formatPhone(order.passenger?.phone)}</p>
          </div>
          {order.passenger?.phone && (
            <a
              href={`tel:${order.passenger.phone}`}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <Phone size={13} />
              Qoʻngʻiroq
            </a>
          )}
        </div>
      </Section>

      <Section icon={<MapPin size={12} />} title="Marshrut">
        <div className="rounded-lg border border-line bg-surface px-3 py-2.5 space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shrink-0 ring-2 ring-primary/25" />
            <div className="min-w-0">
              <p className="text-sm text-ink">{order.pickupAddress ?? '—'}</p>
              <p className="font-mono text-[11px] text-subtle">
                {order.pickupLocation?.coordinates
                  ? `${order.pickupLocation.coordinates[1].toFixed(5)}, ${order.pickupLocation.coordinates[0].toFixed(5)}`
                  : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin size={14} className="text-danger mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-ink">{order.dropoffAddress ?? '—'}</p>
              <p className="font-mono text-[11px] text-subtle">
                {order.dropoffLocation?.coordinates
                  ? `${order.dropoffLocation.coordinates[1].toFixed(5)}, ${order.dropoffLocation.coordinates[0].toFixed(5)}`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section icon={<Car size={12} />} title="Haydovchi">
        {order.driver ? (
          <div className="rounded-lg border border-line bg-surface px-3 py-2.5 flex items-center gap-3">
            <Avatar name={order.driver.name} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{order.driver.name}</p>
              <p className="text-xs text-muted truncate">
                {order.driver.carModel} ·{' '}
                <span className="font-mono">{order.driver.carNumber}</span>
              </p>
            </div>
            <span className="ml-auto flex items-center gap-1 text-xs text-muted shrink-0">
              <Star size={12} className="text-primary" fill="currentColor" />
              {formatRating(order.driver.rating)}
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line px-3 py-3">
            <p className="text-xs text-subtle">
              {order.status === 'searching'
                ? 'Tizim eng yaqin haydovchini qidirmoqda.'
                : 'Haydovchi tayinlanmagan.'}
            </p>
          </div>
        )}
      </Section>

      <Section icon={<Receipt size={12} />} title="Narx tafsiloti">
        <div className="rounded-lg border border-line bg-surface px-3 py-1.5 divide-y divide-line">
          <Row label="Tarif" value={t?.name ?? '—'} />
          <Row label="Boshlangʻich narx" value={<span className="font-mono">{formatMoney(t?.basePrice)}</span>} />
          <Row label="Har km uchun" value={<span className="font-mono">{formatMoney(t?.pricePerKm)}</span>} />
          <Row label="Har daqiqa uchun" value={<span className="font-mono">{formatMoney(t?.pricePerMin)}</span>} />
          <Row label="Minimal narx" value={<span className="font-mono">{formatMoney(t?.minPrice)}</span>} />
          {t?.surgeMultiplier != null && t.surgeMultiplier !== 1 && (
            <Row
              label="Oshirilgan koeffitsient"
              value={<Badge variant="override" size="sm">×{t.surgeMultiplier}</Badge>}
            />
          )}
          <Row label="Toʻlov turi" value={PAYMENT_METHOD_LABELS[order.paymentMethod]} />
          <Row
            label={order.finalPrice != null ? 'Yakuniy narx' : 'Taxminiy narx'}
            value={
              <span className="font-mono font-semibold text-ink">
                {order.finalPrice != null
                  ? formatMoney(order.finalPrice)
                  : formatMoneyApprox(order.estimatedPrice)}
              </span>
            }
          />
        </div>
      </Section>

      {order.note && (
        <Section icon={<Receipt size={12} />} title="Izoh">
          <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink whitespace-pre-wrap">
            {order.note}
          </p>
        </Section>
      )}

      <Section icon={<Clock size={12} />} title="Vaqt belgilari">
        <div className="rounded-lg border border-line bg-surface px-3 py-1.5 divide-y divide-line">
          <Row label="Yaratildi" value={<span className="font-mono">{formatDateTime(order.createdAt)}</span>} />
          {/* acceptedAt/startedAt/completedAt are not separate columns on the
              backend today — rendered only when the API actually sends them. */}
          {order.acceptedAt && (
            <Row label="Qabul qilindi" value={<span className="font-mono">{formatDateTime(order.acceptedAt)}</span>} />
          )}
          {order.startedAt && (
            <Row label="Yoʻlga chiqdi" value={<span className="font-mono">{formatDateTime(order.startedAt)}</span>} />
          )}
          {order.completedAt && (
            <Row label="Yakunlandi" value={<span className="font-mono">{formatDateTime(order.completedAt)}</span>} />
          )}
          {order.cancelledAt && (
            <Row label="Bekor qilindi" value={<span className="font-mono">{formatDateTime(order.cancelledAt)}</span>} />
          )}
          <Row label="Oxirgi yangilanish" value={<span className="font-mono">{formatDateTime(order.updatedAt)}</span>} />
        </div>
      </Section>

      <Section icon={<History size={12} />} title="Mijozning oxirgi buyurtmalari">
        <PassengerHistory order={order} />
      </Section>
    </Drawer>
  );
}
