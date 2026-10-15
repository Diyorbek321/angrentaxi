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
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { PARCEL_SIZE_LABELS, parcelInfo } from '@/lib/parcel';
import { formatDateTime, formatPhone, formatRating, shortId } from '@/lib/format';

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
      .catch(() => setError('Buyurtmani yuklab boʻlmadi'))
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
      toast({ title: `Buyurtma ${shortId(order.id)} bekor qilindi`, variant: 'info' });
    } catch {
      toast({
        title: 'Buyurtmani bekor qilib boʻlmadi',
        description: 'Qaytadan urinib koʻring.',
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
      toast({ title: `Buyurtma ${shortId(order.id)} yakunlandi`, variant: 'success' });
    } catch {
      toast({
        title: 'Buyurtmani yakunlab boʻlmadi',
        description: 'Qaytadan urinib koʻring.',
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
        <PageHeader title="Buyurtma" breadcrumbs={[{ label: 'Buyurtmalar', href: '/orders' }, { label: 'Buyurtma' }]} />
        <Card padding="none">
          <ErrorState
            title={error ?? 'Buyurtma topilmadi'}
            message="Tarmoq xatosi, eskirgan havola yoki oʻchirilgan buyurtma boʻlishi mumkin."
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
    { label: 'Yaratildi', ts: order.createdAt },
    { label: 'Qabul qilindi', ts: order.acceptedAt },
    { label: 'Yoʻlga chiqdi', ts: order.startedAt },
    { label: order.cancelledAt ? 'Bekor qilindi' : 'Yakunlandi', ts: finished },
  ];

  return (
    <PageBody width="narrow">
      <PageHeader
        breadcrumbs={[{ label: 'Buyurtmalar', href: '/orders' }, { label: shortId(order.id) }]}
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="font-mono">{shortId(order.id)}</span>
            <OrderStatusBadge status={order.status} dot />
          </span>
        }
        description={<span className="num">{formatDateTime(order.createdAt, { withYear: true })} da yaratilgan</span>}
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
                Qoʻlda aralashuv
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
                Yakunlash
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
                Bekor qilish
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard
          title="Mijoz"
          actions={
            order.passenger?.phone ? (
              <Button
                href={`tel:${order.passenger.phone}`}
                variant="secondary"
                size="sm"
                leftIcon={<Phone size={13} aria-hidden />}
              >
                Qoʻngʻiroq
              </Button>
            ) : undefined
          }
        >
          <KeyValueList>
            <KeyValue label="Ism">{order.passenger?.name || '—'}</KeyValue>
            <KeyValue label="Telefon">
              <span className="num">{formatPhone(order.passenger?.phone)}</span>
            </KeyValue>
          </KeyValueList>
        </DetailCard>

        {/* Parcel: who receives it. When the driver's PIN locks, the dispatcher
            phones this number before completing the ride from here. */}
        {parcel && (
          <DetailCard title="Posilka">
            <KeyValueList>
              <KeyValue label="Qabul qiluvchi">{parcel.recipientName ?? '—'}</KeyValue>
              <KeyValue label="Telefon">
                <a href={`tel:${parcel.recipientPhone}`} className="num text-primary-text hover:underline">
                  {formatPhone(parcel.recipientPhone)}
                </a>
              </KeyValue>
              <KeyValue label="Nima">{parcel.itemDescription}</KeyValue>
              <KeyValue label="Oʻlcham">{PARCEL_SIZE_LABELS[parcel.size]}</KeyValue>
            </KeyValueList>
          </DetailCard>
        )}

        <DeliveryExtrasCard order={order} />

        <DetailCard title="Haydovchi">
          {order.driver ? (
            <KeyValueList>
              <KeyValue label="Ism">{order.driver.name || 'Ism kiritilmagan'}</KeyValue>
              <KeyValue label="Telefon">
                <span className="num">{formatPhone(order.driver.phone)}</span>
              </KeyValue>
              <KeyValue label="Mashina">
                <span className="inline-flex items-center gap-2">
                  {order.driver.carModel}
                  <PlateNumber plate={order.driver.carNumber} />
                </span>
              </KeyValue>
              <KeyValue label="Reyting">
                <span className="num inline-flex items-center gap-1">
                  <Star size={12} className="text-primary" fill="currentColor" aria-hidden />
                  {formatRating(order.driver.rating)}
                </span>
              </KeyValue>
            </KeyValueList>
          ) : (
            <p className="text-[13px] text-subtle">
              {order.status === 'searching' ? 'Tizim haydovchi qidirmoqda.' : 'Haydovchi tayinlanmagan.'}
            </p>
          )}
        </DetailCard>

        <DetailCard title="Marshrut">
          <div className="space-y-3 text-[13px]">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-mint-deep shrink-0 ring-2 ring-mint/25" />
              <div className="min-w-0">
                <p className="text-xs text-subtle mb-0.5">Olib ketish</p>
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
                <p className="text-xs text-subtle mb-0.5">Tashlab ketish</p>
                <p className="text-ink">{order.dropoffAddress ?? '—'}</p>
                <p className="num text-[11px] text-subtle mt-0.5">
                  {order.dropoffLocation.coordinates[1].toFixed(6)},{' '}
                  {order.dropoffLocation.coordinates[0].toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        </DetailCard>

        <DetailCard title="Toʻlov">
          <KeyValueList>
            <KeyValue label="Toʻlov turi">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</KeyValue>
            <KeyValue label="Tarif">{order.tariff?.name ?? '—'}</KeyValue>
            <KeyValue label="Taxminiy">
              <MoneyText value={order.estimatedPrice} approx={order.finalPrice == null} />
            </KeyValue>
            <KeyValue label="Yakuniy">
              <MoneyText value={order.finalPrice} className="font-semibold" />
            </KeyValue>
          </KeyValueList>
        </DetailCard>

        <DetailCard title="Vaqt belgilari" className="md:col-span-2">
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
              <p className="text-xs text-subtle mb-1">Izoh</p>
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
        title="Buyurtma bekor qilinsinmi?"
        description={
          <>
            <span className="font-mono">{shortId(order.id)}</span> bekor qilinadi.
            Buni ortga qaytarib boʻlmaydi.
          </>
        }
        confirmLabel="Bekor qilish"
        cancelLabel="Yoʻq"
        tone="danger"
        isPending={isCancelling}
      />
      <ConfirmDialog
        isOpen={confirming === 'complete'}
        onClose={() => setConfirming(null)}
        onConfirm={handleComplete}
        title="Buyurtma yakunlansinmi?"
        description={
          <>
            <span className="font-mono">{shortId(order.id)}</span> yakunlangan deb
            belgilanadi va yoʻlovchidan haq undiriladi.
          </>
        }
        confirmLabel="Yakunlash"
        tone="default"
        isPending={isCompleting}
      />
    </PageBody>
  );
}
