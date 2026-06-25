'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  User,
  Car,
  CreditCard,
  Clock,
  Navigation,
  XCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
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
  formatDistance,
  formatDuration,
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
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-0 border-gray-100">
      <div className="mt-0.5 text-gray-400 shrink-0">{icon}</div>
      <div className="flex-1 flex items-start justify-between gap-4">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
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
      <div>
        <Header title="Buyurtma" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div>
      <Header title={`Buyurtma #${shortId(order.id)}`} />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Orqaga
          </Button>
          {canCancel && (
            <Button variant="destructive" size="sm" onClick={() => setShowCancelModal(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Bekor qilish
            </Button>
          )}
        </div>

        {/* Status banner */}
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 border border-gray-200">
          <OrderStatusBadge status={order.status} />
          <span className="text-sm text-gray-500">
            {formatDate(order.createdAt)}
            {order.completedAt && ` → ${formatDate(order.completedAt)}`}
          </span>
          {order.cancelReason && (
            <span className="ml-2 text-sm text-red-600">Sabab: {order.cancelReason}</span>
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
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <div className="flex-1 w-px bg-gray-200 min-h-[2rem]" />
                  <MapPin className="h-4 w-4 text-red-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-xs text-gray-500">Boshlang&apos;ich nuqta</p>
                    <p className="text-sm font-medium text-gray-900">{order.fromAddress}</p>
                    <p className="text-xs text-gray-400">
                      {order.fromLat.toFixed(5)}, {order.fromLng.toFixed(5)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Manzil</p>
                    <p className="text-sm font-medium text-gray-900">{order.toAddress}</p>
                    <p className="text-xs text-gray-400">
                      {order.toLat.toFixed(5)}, {order.toLng.toFixed(5)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3">
                <div className="text-center">
                  <Navigation className="mx-auto h-4 w-4 text-gray-400" />
                  <p className="mt-1 text-xs text-gray-500">Masofa</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDistance(order.distance)}
                  </p>
                </div>
                <div className="text-center">
                  <Clock className="mx-auto h-4 w-4 text-gray-400" />
                  <p className="mt-1 text-xs text-gray-500">Vaqt</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDuration(order.duration)}
                  </p>
                </div>
                <div className="text-center">
                  <CreditCard className="mx-auto h-4 w-4 text-gray-400" />
                  <p className="mt-1 text-xs text-gray-500">Narx</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(order.price)}
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
                value={<span className="text-lg font-bold text-gray-900">{formatCurrency(order.price)}</span>}
              />
            </CardContent>
          </Card>

          {/* Passenger */}
          <Card>
            <CardHeader>
              <CardTitle>Yo&apos;lovchi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                  {order.passenger.firstName?.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {getFullName(order.passenger.firstName, order.passenger.lastName)}
                  </p>
                  <p className="text-sm text-gray-500">{formatPhone(order.passenger.phone)}</p>
                </div>
              </div>
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="ID"
                value={<span className="font-mono text-xs">{shortId(order.passenger.id)}</span>}
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
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow text-brand-black font-bold text-lg">
                      {order.driver.firstName?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {getFullName(order.driver.firstName, order.driver.lastName)}
                      </p>
                      <p className="text-sm text-gray-500">{formatPhone(order.driver.phone)}</p>
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
                      <span className="font-mono text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded">
                        {order.driver.carNumber}
                      </span>
                    }
                  />
                </>
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">
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
