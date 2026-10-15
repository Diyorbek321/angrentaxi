'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DetailCard, KeyValue, KeyValueList } from '@/components/ui/KeyValue';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { MoneyText } from '@/components/ui/MoneyText';
import { PlateNumber } from '@/components/ui/PlateNumber';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { orderPrice } from '@/components/orders/OrdersTable';
import { ordersApi, Order } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatPhone, fullName, shortId } from '@/lib/format';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '@/lib/constants';

const BACK_CRUMB = { label: 'Buyurtmalar', href: '/dashboard/orders' };

function formatCoords(p: Order['pickupLocation'] | undefined): string {
  if (!p?.coordinates) return '—';
  return `${p.coordinates[1].toFixed(5)}, ${p.coordinates[0].toFixed(5)}`;
}

function PersonBlock({
  firstName,
  lastName,
  phone,
}: {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  phone: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Avatar firstName={firstName} lastName={lastName} size="lg" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{fullName(firstName, lastName)}</p>
        <p className="num text-[13px] text-muted">{formatPhone(phone)}</p>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-5">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-5 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-32 mb-4" />
            <SkeletonText lines={4} />
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ordersApi.getById(orderId);
      setOrder(res.data.data);
      setLoadError(null);
    } catch {
      setLoadError('Buyurtma maʼlumotlarini yuklab boʻlmadi');
      toast({ title: 'Xatolik', description: "Buyurtma ma'lumotlarini yuklashda xatolik", variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, toast]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleCancel = async () => {
    if (!order || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      const res = await ordersApi.cancel(order.id, cancelReason);
      setOrder(res.data.data);
      setShowCancelModal(false);
      toast({ title: 'Buyurtma bekor qilindi', variant: 'success' });
    } catch {
      toast({ title: 'Xatolik', description: 'Buyurtmani bekor qilishda xatolik', variant: 'error' });
    } finally {
      setCancelLoading(false);
    }
  };

  if (isLoading && !order) return <DetailSkeleton />;

  if (!order) {
    return (
      <div className="px-4 sm:px-6 py-5">
        <PageHeader
          breadcrumbs={[BACK_CRUMB, { label: 'Buyurtma' }]}
          title="Buyurtma"
          actions={
            <Button variant="secondary" href="/dashboard/orders" leftIcon={<ArrowLeft size={14} aria-hidden />}>
              Buyurtmalarga qaytish
            </Button>
          }
        />
        <Card padding="none">
          <ErrorState message={loadError ?? 'Buyurtma topilmadi'} onRetry={fetchOrder} />
        </Card>
      </div>
    );
  }

  const canCancel = !['completed', 'cancelled'].includes(order.status);
  const id = shortId(order.id);

  return (
    <div className="px-4 sm:px-6 py-5">
      <PageHeader
        breadcrumbs={[BACK_CRUMB, { label: id }]}
        title={
          <span className="inline-flex items-center gap-2.5">
            Buyurtma <span className="font-mono">{id}</span>
            <OrderStatusBadge status={order.status} />
          </span>
        }
        description={
          <span className="num">
            {formatDateTime(order.createdAt, { withYear: true })}
            {order.completedAt && ` → ${formatDateTime(order.completedAt, { withYear: true })}`}
          </span>
        }
        actions={
          canCancel && (
            <Button
              variant="danger"
              onClick={() => setShowCancelModal(true)}
              leftIcon={<XCircle size={14} aria-hidden />}
            >
              Bekor qilish
            </Button>
          )
        }
      />

      {order.cancelReason && (
        <div className="mb-4 rounded-ds-md border border-danger/30 bg-danger-tint px-3 py-2 text-[13px] text-danger-dark dark:text-danger-light">
          Bekor qilish sababi: {order.cancelReason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailCard title="Yoʻnalish">
          <KeyValueList>
            <KeyValue label="Boshlangʻich nuqta">{order.pickupAddress ?? '—'}</KeyValue>
            <KeyValue label="Koordinata">
              <span className="num text-muted">{formatCoords(order.pickupLocation)}</span>
            </KeyValue>
            <KeyValue label="Manzil">{order.dropoffAddress ?? '—'}</KeyValue>
            <KeyValue label="Koordinata">
              <span className="num text-muted">{formatCoords(order.dropoffLocation)}</span>
            </KeyValue>
          </KeyValueList>
        </DetailCard>

        <DetailCard title="Toʻlov">
          <KeyValueList>
            <KeyValue label="Narx">
              <MoneyText value={orderPrice(order)} className="text-sm font-semibold" />
            </KeyValue>
            <KeyValue label="Toʻlov usuli">
              {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}
            </KeyValue>
            <KeyValue label="Tarif">{order.tariff?.name ?? '—'}</KeyValue>
          </KeyValueList>
        </DetailCard>

        <DetailCard title="Yoʻlovchi">
          <PersonBlock
            firstName={order.passenger.firstName}
            lastName={order.passenger.lastName}
            phone={order.passenger.phone}
          />
          <KeyValueList>
            <KeyValue label="ID">
              <span className="font-mono text-xs">{shortId(order.passenger.id)}</span>
            </KeyValue>
          </KeyValueList>
        </DetailCard>

        <DetailCard title="Haydovchi">
          {order.driver ? (
            <>
              <PersonBlock
                firstName={order.driver.firstName}
                lastName={order.driver.lastName}
                phone={order.driver.phone}
              />
              <KeyValueList>
                <KeyValue label="Avtomobil">{order.driver.carModel || '—'}</KeyValue>
                <KeyValue label="Davlat raqami">
                  <PlateNumber plate={order.driver.carNumber} />
                </KeyValue>
              </KeyValueList>
            </>
          ) : (
            <p className="py-4 text-center text-[13px] text-subtle">Haydovchi tayinlanmagan</p>
          )}
        </DetailCard>
      </div>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Buyurtmani bekor qilish"
        description="Sabab yoʻlovchi va haydovchiga koʻrsatiladi."
        tone="danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)} disabled={cancelLoading}>
              Ortga
            </Button>
            <Button
              variant="danger"
              isLoading={cancelLoading}
              disabled={!cancelReason.trim()}
              onClick={handleCancel}
            >
              Bekor qilish
            </Button>
          </>
        }
      >
        <Textarea
          label="Sabab"
          placeholder="Bekor qilish sababini kiriting…"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
        />
      </Modal>
    </div>
  );
}
