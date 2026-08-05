'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Phone,
  Star,
  User,
  UserCog,
} from 'lucide-react';
import { getOrderById, cancelOrder, completeOrder, Order } from '@/lib/api';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { AssignDriverModal } from '@/components/dispatch/AssignDriverModal';
import { useDispatchData } from '@/components/dispatch/DispatchDataContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  formatRating,
  shortId,
} from '@/lib/format';

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-line last:border-0">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <span className="text-sm text-ink text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-5 py-5 space-y-5">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
        <Skeleton className="h-32 rounded-xl md:col-span-2" />
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  // Drivers come from the shell provider — no second live-drivers request.
  const { drivers } = useDispatchData();

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getOrderById(id)
      .then(setOrder)
      .catch(() => setError('Buyurtma topilmadi'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!order || !confirm('Bu buyurtma bekor qilinsinmi?')) return;
    setIsCancelling(true);
    try {
      const updated = await cancelOrder(order.id, 'Cancelled by dispatcher');
      setOrder(updated);
    } catch {
      alert('Buyurtmani bekor qilib boʻlmadi');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleComplete = async () => {
    if (!order || !confirm('Buyurtma yakunlandi deb belgilansinmi?')) return;
    setIsCompleting(true);
    try {
      const updated = await completeOrder(order.id);
      setOrder(updated);
    } catch {
      alert('Buyurtmani yakunlab boʻlmadi');
    } finally {
      setIsCompleting(false);
    }
  };

  const canAssign = order && ['created', 'searching'].includes(order.status) && !order.driver;
  const canReassign = order && ['accepted', 'arrived'].includes(order.status) && !!order.driver;
  const canCancel = order && ['created', 'searching', 'accepted', 'arrived'].includes(order.status);
  const canComplete = order && order.status === 'in_progress';

  if (isLoading) return <DetailSkeleton />;

  if (error || !order) {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <ErrorState
          title={error ?? 'Buyurtma topilmadi'}
          message="Havola eskirgan yoki buyurtma oʻchirilgan boʻlishi mumkin."
          onRetry={() => router.back()}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-5 space-y-5">
        {/* Back + header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              leftIcon={<ArrowLeft size={14} />}
            >
              Orqaga
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-ink font-mono">{shortId(order.id)}</h1>
                <OrderStatusBadge status={order.status} dot />
              </div>
              <p className="text-xs text-muted mt-0.5">
                {formatDate(order.createdAt)} · {formatDateTime(order.createdAt)} da yaratilgan
              </p>
            </div>
          </div>

          {/* Actions — assignment is an amber, deliberate exception */}
          <div className="flex items-center gap-2 flex-wrap">
            {(canAssign || canReassign) && (
              <Button
                size="sm"
                variant="override"
                onClick={() => setAssignModalOpen(true)}
                leftIcon={<UserCog size={13} />}
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
              >
                Bekor qilish
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Passenger */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={15} className="text-muted" />
                Mijoz
              </CardTitle>
            </CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Avatar name={order.passenger?.name} size="md" tone="muted" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {order.passenger?.name ?? '—'}
                </p>
                <p className="font-mono text-xs text-muted">
                  {formatPhone(order.passenger?.phone)}
                </p>
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
          </Card>

          {/* Driver */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car size={15} className="text-muted" />
                Haydovchi
              </CardTitle>
            </CardHeader>
            {order.driver ? (
              <>
                <InfoRow label="Ism" value={order.driver.name} />
                <InfoRow
                  label="Telefon"
                  value={<span className="font-mono">{formatPhone(order.driver.phone)}</span>}
                />
                <InfoRow
                  label="Mashina"
                  value={
                    <>
                      {order.driver.carModel} —{' '}
                      <span className="font-mono">{order.driver.carNumber}</span>
                    </>
                  }
                />
                <InfoRow
                  label="Reyting"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Star size={12} className="text-primary" fill="currentColor" />
                      {formatRating(order.driver.rating)}
                    </span>
                  }
                />
              </>
            ) : (
              <p className="text-sm text-subtle py-2">
                {order.status === 'searching'
                  ? 'Tizim haydovchi qidirmoqda.'
                  : 'Haydovchi tayinlanmagan.'}
              </p>
            )}
          </Card>

          {/* Route */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin size={15} className="text-muted" />
                Marshrut
              </CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-mint-deep shrink-0 ring-2 ring-mint/25" />
                <div className="min-w-0">
                  <p className="text-xs text-subtle mb-0.5">Olib ketish</p>
                  <p className="text-sm text-ink">{order.pickupAddress ?? '—'}</p>
                  <p className="text-[11px] text-subtle mt-0.5 font-mono">
                    {order.pickupLocation.coordinates[1].toFixed(6)},{' '}
                    {order.pickupLocation.coordinates[0].toFixed(6)}
                  </p>
                </div>
              </div>
              <div className="border-t border-line" />
              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-danger mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-subtle mb-0.5">Tashlab ketish</p>
                  <p className="text-sm text-ink">{order.dropoffAddress ?? '—'}</p>
                  <p className="text-[11px] text-subtle mt-0.5 font-mono">
                    {order.dropoffLocation.coordinates[1].toFixed(6)},{' '}
                    {order.dropoffLocation.coordinates[0].toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={15} className="text-muted" />
                Toʻlov
              </CardTitle>
            </CardHeader>
            <InfoRow label="Toʻlov turi" value={PAYMENT_METHOD_LABELS[order.paymentMethod]} />
            <InfoRow label="Tarif" value={order.tariff?.name ?? '—'} />
            <InfoRow
              label="Taxminiy"
              value={<span className="font-mono">{formatMoney(order.estimatedPrice)}</span>}
            />
            <InfoRow
              label="Yakuniy"
              value={
                <span className="font-mono font-semibold">
                  {order.finalPrice != null ? formatMoney(order.finalPrice) : '—'}
                </span>
              }
            />
          </Card>

          {/* Timeline */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={15} className="text-muted" />
                Vaqt belgilari
              </CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Yaratildi', ts: order.createdAt },
                { label: 'Qabul qilindi', ts: order.acceptedAt },
                { label: 'Yoʻlga chiqdi', ts: order.startedAt },
                {
                  label: order.cancelledAt ? 'Bekor qilindi' : 'Yakunlandi',
                  ts: order.cancelledAt ?? order.completedAt,
                },
              ].map(({ label, ts }) => (
                <div key={label}>
                  <p className="text-xs text-subtle">{label}</p>
                  <p className="text-sm text-ink mt-0.5 font-mono">
                    {ts ? formatDateTime(ts) : '—'}
                  </p>
                </div>
              ))}
            </div>
            {order.note && (
              <div className="mt-4 pt-4 border-t border-line">
                <p className="text-xs text-subtle mb-1">Izoh</p>
                <p className="text-sm text-ink whitespace-pre-wrap">{order.note}</p>
              </div>
            )}
          </Card>
        </div>
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
    </div>
  );
}
