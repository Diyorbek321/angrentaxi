'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardList,
  MapPin,
  User,
  Car,
  CreditCard,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Avatar } from '@/components/ui/Avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { ordersApi, Order } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  formatCurrency,
  formatDate,
  formatPhone,
  getFullName,
  shortId,
} from '@/lib/utils';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '@/lib/constants';

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 border-b border-divider py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="mt-0.5 shrink-0 text-subtle" aria-hidden="true">
        {icon}
      </div>
      <div className="flex flex-1 items-start justify-between gap-4">
        <span className="text-body text-muted">{label}</span>
        <span className="text-right text-body font-medium text-ink">{value}</span>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await ordersApi.getById(orderId);
        setOrder(res.data.data);
      } catch {
        // Yo'naltirish avvalgidek qoladi; `loadError` esa yo'naltirish
        // amalga oshguncha (yoki u ishlamasa) bo'sh ekran o'rniga
        // tushunarli xato holatini ko'rsatadi.
        setLoadError('Buyurtma maʼlumotlarini yuklab boʻlmadi');
        toast({ title: 'Xatolik', description: 'Buyurtma ma\'lumotlarini yuklashda xatolik', variant: 'error' });
        router.push('/dashboard/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, router, toast]);

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

  const canCancel =
    order &&
    !['completed', 'cancelled'].includes(order.status);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Buyurtma" icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />} />
        <SkeletonCards count={2} height="h-64" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Buyurtma"
          icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/orders')}
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
            >
              Buyurtmalarga qaytish
            </Button>
          }
        />
        <ErrorState
          message={loadError ?? 'Buyurtma topilmadi'}
          onRetry={() => router.refresh()}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={`Buyurtma #${shortId(order.id)}`}
        icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
              Orqaga
            </Button>
            {canCancel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                leftIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
              >
                Bekor qilish
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-6">
        {/* Status banner */}
        <div className="flex flex-wrap items-center gap-3 rounded-ds-md border border-line bg-surface-2 p-4">
          <OrderStatusBadge status={order.status} />
          <span className="text-body text-muted">
            {formatDate(order.createdAt)}
            {order.completedAt && ` → ${formatDate(order.completedAt)}`}
          </span>
          {order.cancelReason && (
            <span className="text-body text-danger-deep dark:text-danger-light">
              Sabab: {order.cancelReason}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Route */}
          <Card>
            <CardHeader>
              <CardTitle>Yo&apos;nalish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-1">
                  {/* Boshlanish nuqtasi — yorug' fonda ko'rinishi shart bo'lgan
                      mint, shuning uchun `mint-deep` (3.37:1), `mint` emas. */}
                  <div className="h-3 w-3 rounded-full bg-mint-deep" aria-hidden="true" />
                  <div className="min-h-[2rem] w-px flex-1 bg-line" aria-hidden="true" />
                  <MapPin className="h-4 w-4 text-danger-deep dark:text-danger-light" aria-hidden="true" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-caption text-subtle">Boshlang&apos;ich nuqta</p>
                    <p className="text-body font-medium text-ink">{order.pickupAddress ?? '—'}</p>
                    <p className="text-caption text-subtle">
                      {order.pickupLocation.coordinates[1].toFixed(5)}, {order.pickupLocation.coordinates[0].toFixed(5)}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-subtle">Manzil</p>
                    <p className="text-body font-medium text-ink">{order.dropoffAddress ?? '—'}</p>
                    <p className="text-caption text-subtle">
                      {order.dropoffLocation.coordinates[1].toFixed(5)}, {order.dropoffLocation.coordinates[0].toFixed(5)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-ds-md bg-surface-2 p-3">
                <div className="text-center">
                  <CreditCard className="mx-auto h-4 w-4 text-subtle" aria-hidden="true" />
                  <p className="mt-1 text-caption text-subtle">Narx</p>
                  <p className="text-body font-semibold text-ink">
                    {formatCurrency(order.finalPrice ?? order.estimatedPrice)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment info */}
          <Card>
            <CardHeader>
              <CardTitle>To&apos;lov ma&apos;lumotlari</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow
                icon={<CreditCard className="h-4 w-4" />}
                label="To'lov usuli"
                value={PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}
              />
              <InfoRow
                icon={<CreditCard className="h-4 w-4" />}
                label="Tarif"
                value={order.tariff.name}
              />
              <InfoRow
                icon={<CreditCard className="h-4 w-4" />}
                label="Narx"
                value={<span className="text-h3 font-bold text-ink">{formatCurrency(order.finalPrice ?? order.estimatedPrice)}</span>}
              />
            </CardContent>
          </Card>

          {/* Passenger */}
          <Card>
            <CardHeader>
              <CardTitle>Yo&apos;lovchi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-4">
                <Avatar
                  name={getFullName(order.passenger.firstName, order.passenger.lastName)}
                  size="md"
                  tone="mint"
                />
                <div>
                  <p className="font-semibold text-ink">
                    {getFullName(order.passenger.firstName, order.passenger.lastName)}
                  </p>
                  <p className="text-body text-muted">{formatPhone(order.passenger.phone)}</p>
                </div>
              </div>
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="ID"
                value={<span className="font-mono text-caption">{shortId(order.passenger.id)}</span>}
              />
            </CardContent>
          </Card>

          {/* Driver */}
          <Card>
            <CardHeader>
              <CardTitle>Haydovchi</CardTitle>
            </CardHeader>
            <CardContent>
              {order.driver ? (
                <>
                  <div className="mb-4 flex items-center gap-4">
                    <Avatar
                      name={getFullName(order.driver.firstName, order.driver.lastName)}
                      size="md"
                      tone="mint"
                    />
                    <div>
                      <p className="font-semibold text-ink">
                        {getFullName(order.driver.firstName, order.driver.lastName)}
                      </p>
                      <p className="text-body text-muted">{formatPhone(order.driver.phone)}</p>
                    </div>
                  </div>
                  <InfoRow
                    icon={<Car className="h-4 w-4" />}
                    label="Avtomobil"
                    value={order.driver.carModel}
                  />
                  <InfoRow
                    icon={<Car className="h-4 w-4" />}
                    label="Raqam"
                    value={
                      <span className="rounded-ds-xs border border-line bg-surface-2 px-2 py-0.5 font-mono text-caption font-semibold text-ink">
                        {order.driver.carNumber}
                      </span>
                    }
                  />
                </>
              ) : (
                <p className="py-4 text-center text-body text-subtle">
                  Haydovchi tayinlanmagan
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buyurtmani bekor qilish</DialogTitle>
            <DialogDescription>
              Bekor qilish sababini kiriting. Bu yo&apos;lovchi va haydovchiga ko&apos;rsatiladi.
            </DialogDescription>
          </DialogHeader>
          <Input
            label="Sabab"
            placeholder="Bekor qilish sababini kiriting..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Ortga
            </Button>
            <Button
              variant="destructive"
              isLoading={cancelLoading}
              disabled={!cancelReason.trim()}
              onClick={handleCancel}
            >
              Bekor qilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
