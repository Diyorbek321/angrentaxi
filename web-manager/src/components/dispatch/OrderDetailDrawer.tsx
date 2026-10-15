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
import { MoneyText } from '@/components/ui/MoneyText';
import { KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { PlateNumber } from '@/components/ui/PlateNumber';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import {
  formatDateTime,
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
      <h3 className="flex items-center gap-1.5 text-micro uppercase text-subtle mb-2">
        <span className="text-muted">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
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
    <ul className="divide-y divide-line rounded-ds-xs border border-line overflow-hidden">
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
      <div className="flex items-center gap-2 rounded-ds-xs border border-line bg-surface-2/60 px-3 py-2">
        <Eye size={14} className="text-muted shrink-0" />
        <p className="text-xs text-muted leading-snug">
          Faqat koʻrish uchun. Haydovchi tayinlash tizim tomonidan avtomatik bajariladi —
          aralashuv faqat Istisnolar boʻlimidan yoki kartadagi «Qoʻlda aralashuv» tugmasidan.
        </p>
      </div>

      <Section icon={<User size={12} />} title="Mijoz">
        <div className="rounded-ds-xs border border-line bg-surface px-3 py-2.5 flex items-center gap-3">
          <Avatar name={order.passenger?.name} size="md" tone="muted" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">
              {order.passenger?.name || 'Mijoz'}
            </p>
            <p className="num text-xs text-muted">{formatPhone(order.passenger?.phone)}</p>
          </div>
          {order.passenger?.phone && (
            <a
              href={`tel:${order.passenger.phone}`}
              className="ml-auto inline-flex items-center gap-1.5 rounded-ds-xs border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <Phone size={13} />
              Qoʻngʻiroq
            </a>
          )}
        </div>
      </Section>

      <Section icon={<MapPin size={12} />} title="Marshrut">
        <div className="rounded-ds-xs border border-line bg-surface px-3 py-2.5 space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-mint-deep shrink-0 ring-2 ring-mint/25" />
            <div className="min-w-0">
              <p className="text-sm text-ink">{order.pickupAddress ?? '—'}</p>
              <p className="num text-[11px] text-subtle">
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
              <p className="num text-[11px] text-subtle">
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
          <div className="rounded-ds-xs border border-line bg-surface px-3 py-2.5 flex items-center gap-3">
            <Avatar name={order.driver.name} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{order.driver.name || 'Ism kiritilmagan'}</p>
              <p className="text-xs text-muted truncate">
                {order.driver.carModel} ·{' '}
                <PlateNumber plate={order.driver.carNumber} />
              </p>
            </div>
            <span className="ml-auto flex items-center gap-1 text-xs text-muted shrink-0">
              <Star size={12} className="text-primary" fill="currentColor" />
              {formatRating(order.driver.rating)}
            </span>
          </div>
        ) : (
          <div className="rounded-ds-xs border border-dashed border-line px-3 py-3">
            <p className="text-xs text-subtle">
              {order.status === 'searching'
                ? 'Tizim eng yaqin haydovchini qidirmoqda.'
                : 'Haydovchi tayinlanmagan.'}
            </p>
          </div>
        )}
      </Section>

      <Section icon={<Receipt size={12} />} title="Narx tafsiloti">
        <KeyValueList className="rounded-ds-xs border border-line bg-surface px-3 py-2">
          <KeyValue label="Tarif">{t?.name ?? '—'}</KeyValue>
          <KeyValue label="Boshlangʻich narx"><MoneyText value={t?.basePrice} /></KeyValue>
          <KeyValue label="Har km uchun"><MoneyText value={t?.pricePerKm} /></KeyValue>
          <KeyValue label="Har daqiqa uchun"><MoneyText value={t?.pricePerMin} /></KeyValue>
          <KeyValue label="Minimal narx"><MoneyText value={t?.minPrice} /></KeyValue>
          {t?.surgeMultiplier != null && t.surgeMultiplier !== 1 && (
            <KeyValue label="Oshirilgan koeffitsient">
              <Badge variant="info" size="sm">
                ×{t.surgeMultiplier}
              </Badge>
            </KeyValue>
          )}
          <KeyValue label="Toʻlov turi">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</KeyValue>
          <KeyValue label={order.finalPrice != null ? 'Yakuniy narx' : 'Taxminiy narx'}>
            {order.finalPrice != null ? (
              <MoneyText value={order.finalPrice} className="font-semibold text-ink" />
            ) : (
              <MoneyText value={order.estimatedPrice} approx className="font-semibold text-ink" />
            )}
          </KeyValue>
        </KeyValueList>
      </Section>

      {order.note && (
        <Section icon={<Receipt size={12} />} title="Izoh">
          <p className="rounded-ds-xs border border-line bg-surface px-3 py-2.5 text-sm text-ink whitespace-pre-wrap">
            {order.note}
          </p>
        </Section>
      )}

      <Section icon={<Clock size={12} />} title="Vaqt belgilari">
        <KeyValueList className="rounded-ds-xs border border-line bg-surface px-3 py-2">
          <KeyValue label="Yaratildi"><span className="num">{formatDateTime(order.createdAt)}</span></KeyValue>
          {/* acceptedAt/startedAt/completedAt are not separate columns on the
              backend today — rendered only when the API actually sends them. */}
          {order.acceptedAt && (
            <KeyValue label="Qabul qilindi"><span className="num">{formatDateTime(order.acceptedAt)}</span></KeyValue>
          )}
          {order.startedAt && (
            <KeyValue label="Yoʻlga chiqdi"><span className="num">{formatDateTime(order.startedAt)}</span></KeyValue>
          )}
          {order.completedAt && (
            <KeyValue label="Yakunlandi"><span className="num">{formatDateTime(order.completedAt)}</span></KeyValue>
          )}
          {order.cancelledAt && (
            <KeyValue label="Bekor qilindi"><span className="num">{formatDateTime(order.cancelledAt)}</span></KeyValue>
          )}
          <KeyValue label="Oxirgi yangilanish"><span className="num">{formatDateTime(order.updatedAt)}</span></KeyValue>
        </KeyValueList>
      </Section>

      <Section icon={<History size={12} />} title="Mijozning oxirgi buyurtmalari">
        <PassengerHistory order={order} />
      </Section>
    </Drawer>
  );
}
