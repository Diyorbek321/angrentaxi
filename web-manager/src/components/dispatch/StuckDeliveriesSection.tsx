'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PackageCheck, PhoneCall } from 'lucide-react';
import { getStuckDeliveries, StuckDelivery } from '@/lib/api';
import { stuckReasonLabels, upsertStuckDelivery } from '@/lib/delivery-incident';
import { SOCKET_EVENTS, subscribeToSocket } from '@/lib/socket';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { formatDateTime, formatPhone, shortId } from '@/lib/format';
import { t } from '@/locales';

const POLL_MS = 30_000;

/**
 * Osilib qolgan yetkazishlar (INCIDENT-POLICY §2): kuryer safari juda uzoq
 * davom etmoqda yoki kuryer joylashuvi eskirgan. Ro'yxat so'rov bilan
 * yangilanadi, yangi signal esa `delivery:stuck` socket'i bilan darhol keladi.
 * Dispetcher kuryerga qo'ng'iroq qiladi yoki safarni ochib qaror qiladi.
 */
export function StuckDeliveriesSection() {
  const [items, setItems] = useState<StuckDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const m = t().dispatch.stuckDeliveries;

  const load = useCallback(async () => {
    try {
      setItems(await getStuckDeliveries());
      setError(null);
    } catch (err) {
      console.error('Failed to load stuck deliveries:', err);
      setError(t().dispatch.stuckDeliveries.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Server har safar uchun bir marta yuboradi — keyingi so'rovgacha kutmaymiz.
  useEffect(
    () =>
      subscribeToSocket((socket) => {
        const onStuck = (payload: StuckDelivery) => {
          if (payload?.orderId) setItems((prev) => upsertStuckDelivery(prev, payload));
        };
        socket.on(SOCKET_EVENTS.DELIVERY_STUCK, onStuck);
        return () => {
          socket.off(SOCKET_EVENTS.DELIVERY_STUCK, onStuck);
        };
      }),
    []
  );

  const reasonLabels = stuckReasonLabels();
  const serviceLabels = t().lib.serviceType as Record<string, string>;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-h3 text-ink">{m.title}</h2>
        {items.length > 0 && (
          <Badge variant="danger" size="sm">
            {items.length}
          </Badge>
        )}
      </div>
      {error && items.length > 0 && (
        <RetryBanner message={error} onRetry={load} keepsLastData className="mb-3" />
      )}
      {error && items.length === 0 ? (
        <Card padding="none">
          <ErrorState compact title={error} onRetry={load} />
        </Card>
      ) : loading ? (
        <SkeletonCards count={2} height="h-[76px]" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            compact
            variant="cleared"
            icon={<PackageCheck aria-hidden />}
            title={m.emptyTitle}
            description={m.emptyDesc}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((s) => (
            <Card key={s.orderId} className="border-danger/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink">
                      {serviceLabels[s.serviceType] ?? s.serviceType}
                    </span>
                    <span className="font-mono text-[11px] text-muted">{shortId(s.orderId)}</span>
                    {s.returning && (
                      <Badge variant="danger" size="sm">
                        {t().lib.deliveryIncident.returning}
                      </Badge>
                    )}
                    {s.reasons.map((r) => (
                      <Badge key={r} variant="muted-danger" size="sm">
                        {reasonLabels[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {s.pickupAddress ?? '—'} → {s.dropoffAddress ?? '—'}
                  </p>
                  <p className="num mt-0.5 text-[11px] text-subtle">
                    {s.driverName || m.courier}
                    {s.startedAt && ` · ${m.startedAt(formatDateTime(s.startedAt))}`}
                    {` · ${m.lastLocation(s.locationUpdatedAt ? formatDateTime(s.locationUpdatedAt) : '—')}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {s.driverPhone && (
                    <Button
                      href={`tel:${s.driverPhone}`}
                      variant="secondary"
                      size="sm"
                      leftIcon={<PhoneCall size={13} aria-hidden />}
                    >
                      {formatPhone(s.driverPhone)}
                    </Button>
                  )}
                  <Link href={`/orders/${s.orderId}`} className="text-primary-text hover:underline">
                    {m.openTrip}
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
