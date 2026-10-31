'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Ban, CheckCircle2, MapPin, Phone, Star, UserCog } from 'lucide-react';
import { getOrderById, cancelOrder, completeOrder, Order } from '@/lib/api';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { AssignDriverModal } from '@/components/dispatch/AssignDriverModal';
import { DeliveryExtrasCard } from '@/components/orders/DeliveryExtras';
import { useDispatchData } from '@/components/dispatch/DispatchDataContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MoneyText } from '@/components/ui/MoneyText';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlateNumber } from '@/components/ui/PlateNumber';
import { PageBody } from '@/components/ui/PageBody';
import { DetailCard, KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { paymentMethodLabels } from '@/lib/constants';
import { parcelSizeLabels, parcelInfo } from '@/lib/parcel';
import { formatDateTime, formatPhone, formatRating, nameFallback, shortId } from '@/lib/format';
import { t } from '@/locales';

function DetailSkeleton() {
  return (
    <PageBody width="narrow">
      <Skeleton className="h-3 w-40 mb-2" />
      <Skeleton className="h-7 w-56 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-ds-md" />
        ))}
        <Skeleton className="h-28 rounded-ds-md md:col-span-2" />
      </div>
    </PageBody>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const m = t();
  const d = m.orders.detail;
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [confirming, setConfirming] = useState<'cancel' | 'complete' | null>(null);
  const { toast } = useToast();
  // Drivers come from the shell provider — no second live-drivers request.
  const { drivers } = useDispatchData();

  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    getOrderById(id)
      .then((o) => {
        setOrder(o);
        setError(null);
      })
      .catch(() => setError(t().orders.detail.loadFailed))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // The destructive act itself is gated by a confirmation; the OUTCOME is a
  // toast — non-blocking, so the operator is not interrupted twice.
  const handleCancel = async () => {
    if (!order) return;
    setConfirming(null);
    setIsCancelling(true);
    try {
      const updated = await cancelOrder(order.id, 'Cancelled by dispatcher');
      setOrder(updated);
      toast({ title: d.cancelled(shortId(order.id)), variant: 'info' });
    } catch {
      toast({
        title: d.cancelFailed,
        description: d.tryAgain,
        variant: 'error',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleComplete = async () => {
    if (!order) return;
    setConfirming(null);
    setIsCompleting(true);
    try {
      const updated = await completeOrder(order.id);
      setOrder(updated);
      toast({ title: d.completed(shortId(order.id)), variant: 'success' });
    } catch {
      toast({
        title: d.completeFailed,
        description: d.tryAgain,
        variant: 'error',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const canAssign = order && ['created', 'searching'].includes(order.status) && !order.driver;
  const canReassign = order && ['accepted', 'arrived'].includes(order.status) && !!order.driver;
  const canCancel = order && ['created', 'searching', 'accepted', 'arrived'].includes(order.status);
  const canComplete = order && order.status === 'in_progress';

  if (isLoading && !order) return <DetailSkeleton />;

  if (error || !order) {
    return (
      <PageBody width="narrow">
        <PageHeader title={d.title} breadcrumbs={[{ label: m.orders.list.title, href: '/orders' }, { label: d.title }]} />
        <Card padding="none">
          <ErrorState
            title={error ?? d.notFound}
            message={d.notFoundHint}
            onRetry={load}
            retrying={isLoading}
          />
        </Card>
      </PageBody>
    );
  }

  const parcel = parcelInfo(order);

  const finished = order.cancelledAt ?? order.completedAt;
  const timeline = [
    { label: d.tlCreated, ts: order.createdAt },
    { label: d.tlAccepted, ts: order.acceptedAt },
    { label: d.tlStarted, ts: order.startedAt },
    { label: order.cancelledAt ? d.tlCancelled : d.tlCompleted, ts: finished },
  ];

  return (
    <PageBody width="narrow">
      <PageHeader
        breadcrumbs={[{ label: m.orders.list.title, href: '/orders' }, { label: shortId(order.id) }]}
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="font-mono">{shortId(order.id)}</span>
            <OrderStatusBadge status={order.status} dot />
          </span>
        }
        description={<span className="num">{d.createdAt(formatDateTime(order.createdAt, { withYear: true }))}</span>}
        actions={
          <>
            {/* Assignment is an amber, deliberate exception */}
            {(canAssign || canReassign) && (
              <Button
                size="sm"
                variant="override"
                onClick={() => setAssignModalOpen(true)}
                leftIcon={<UserCog size={13} aria-hidden />}
              >
                {d.manualOverride}
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirming('complete')}
                isLoading={isCompleting}
                leftIcon={<CheckCircle2 size={13} aria-hidden />}
              >
                {d.complete}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirming('cancel')}
                isLoading={isCancelling}
                leftIcon={<Ban size={13} aria-hidden />}
              >
                {m.common.cancel}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard
          title={d.customer}
          actions={
            order.passenger?.phone ? (
              <Button
                href={`tel:${order.passenger.phone}`}
                variant="secondary"
                size="sm"
                leftIcon={<Phone size={13} aria-hidden />}
              >
                {d.call}
              </Button>
            ) : undefined
          }
        >
          <KeyValueList>
            <KeyValue label={d.name}>{order.passenger?.name || '—'}</KeyValue>
            <KeyValue label={d.phone}>
              <span className="num">{formatPhone(order.passenger?.phone)}</span>
            </KeyValue>
          </KeyValueList>
        </DetailCard>

        {/* Parcel: who receives it. When the driver's PIN locks, the dispatcher
            phones this number before completing the ride from here. */}
        {parcel && (
          <DetailCard title={d.parcel}>
            <KeyValueList>
              <KeyValue label={d.recipient}>{parcel.recipientName ?? '—'}</KeyValue>
              <KeyValue label={d.phone}>
                <a href={`tel:${parcel.recipientPhone}`} className="num text-primary-text hover:underline">
                  {formatPhone(parcel.recipientPhone)}
                </a>
              </KeyValue>
              <KeyValue label={d.item}>{parcel.itemDescription}</KeyValue>
              <KeyValue label={d.size}>{parcelSizeLabels()[parcel.size]}</KeyValue>
            </KeyValueList>
          </DetailCard>
        )}

        <DeliveryExtrasCard order={order} />

        <DetailCard title={d.driver}>
          {order.driver ? (
            <KeyValueList>
              <KeyValue label={d.name}>{order.driver.name || nameFallback()}</KeyValue>
              <KeyValue label={d.phone}>
                <span className="num">{formatPhone(order.driver.phone)}</span>
              </KeyValue>
              <KeyValue label={d.car}>
                <span className="inline-flex items-center gap-2">
                  {order.driver.carModel}
                  <PlateNumber plate={order.driver.carNumber} />
                </span>
              </KeyValue>
              <KeyValue label={d.rating}>
                <span className="num inline-flex items-center gap-1">
                  <Star size={12} className="text-primary" fill="currentColor" aria-hidden />
                  {formatRating(order.driver.rating)}
                </span>
              </KeyValue>
            </KeyValueList>
          ) : (
            <p className="text-[13px] text-subtle">
              {order.status === 'searching' ? d.searchingDriver : d.noDriver}
            </p>
          )}
        </DetailCard>

        <DetailCard title={d.route}>
          <div className="space-y-3 text-[13px]">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-mint-deep shrink-0 ring-2 ring-mint/25" />
              <div className="min-w-0">
                <p className="text-xs text-subtle mb-0.5">{d.pickup}</p>
                <p className="text-ink">{order.pickupAddress ?? '—'}</p>
                <p className="num text-[11px] text-subtle mt-0.5">
                  {order.pickupLocation.coordinates[1].toFixed(6)},{' '}
                  {order.pickupLocation.coordinates[0].toFixed(6)}
                </p>
              </div>
            </div>
            <div className="border-t border-line" />
            <div className="flex items-start gap-2.5">
              <MapPin size={14} className="text-danger mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs text-subtle mb-0.5">{d.dropoff}</p>
                <p className="text-ink">{order.dropoffAddress ?? '—'}</p>
                <p className="num text-[11px] text-subtle mt-0.5">
                  {order.dropoffLocation.coordinates[1].toFixed(6)},{' '}
                  {order.dropoffLocation.coordinates[0].toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        </DetailCard>

        <DetailCard title={d.payment}>
          <KeyValueList>
            <KeyValue label={d.paymentMethod}>{paymentMethodLabels()[order.paymentMethod]}</KeyValue>
            <KeyValue label={d.tariff}>{order.tariff?.name ?? '—'}</KeyValue>
            <KeyValue label={d.estimated}>
              <MoneyText value={order.estimatedPrice} approx={order.finalPrice == null} />
            </KeyValue>
            <KeyValue label={d.final}>
              <MoneyText value={order.finalPrice} className="font-semibold" />
            </KeyValue>
          </KeyValueList>
        </DetailCard>

        <DetailCard title={d.timestamps} className="md:col-span-2">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {timeline.map(({ label, ts }) => (
              <div key={label}>
                <dt className="text-xs text-subtle">{label}</dt>
                <dd className="num text-[13px] text-ink mt-0.5">{ts ? formatDateTime(ts) : '—'}</dd>
              </div>
            ))}
          </dl>
          {order.note && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-xs text-subtle mb-1">{d.note}</p>
              <p className="text-[13px] text-ink whitespace-pre-wrap">{order.note}</p>
            </div>
          )}
        </DetailCard>
      </div>

      <AssignDriverModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        order={order}
        availableDrivers={drivers}
        onAssigned={(updated) => {
          setOrder(updated);
          setAssignModalOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={confirming === 'cancel'}
        onClose={() => setConfirming(null)}
        onConfirm={handleCancel}
        title={d.cancelConfirmTitle}
        description={
          <>
            <span className="font-mono">{shortId(order.id)}</span>{d.cancelConfirmBody}
          </>
        }
        confirmLabel={m.common.cancel}
        cancelLabel={m.common.no}
        tone="danger"
        isPending={isCancelling}
      />
      <ConfirmDialog
        isOpen={confirming === 'complete'}
        onClose={() => setConfirming(null)}
        onConfirm={handleComplete}
        title={d.completeConfirmTitle}
        description={
          <>
            <span className="font-mono">{shortId(order.id)}</span>{d.completeConfirmBody}
          </>
        }
        confirmLabel={d.complete}
        tone="default"
        isPending={isCompleting}
      />
    </PageBody>
  );
}
